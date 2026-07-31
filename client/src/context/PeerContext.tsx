import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { createSHA256, type IHasher } from "hash-wasm";
import {
  type ConnectionStatus,
  type ConnectionType,
  type DataChannelMessage,
  type IncomingRequest,
  type PeerContextValue,
  type PeerRole,
  type QueueItem,
  type ReceivedFile,
  type SessionSummary,
  type SignalingMessage,
  type SpeedTestPhase,
  type SpeedTestResult,
  type TextEntry,
  type TransferMeta,
} from "../types";
import { PeerContext } from "./peer-context-instance";
import { createImagePreview } from "../lib/thumbnail";

const SIGNALING_SERVER = import.meta.env.VITE_SIGNALING_SERVER;
const CHUNK_SIZE = Number(import.meta.env.VITE_CHUNK_SIZE) * 1024 || 16 * 1024;
const MAX_ICE_RESTART_ATTEMPTS = 3;
const MAX_WS_RECONNECT_ATTEMPTS = 3;
const SPEED_SAMPLE_INTERVAL_MS = 250;
const MAX_TEXT_LENGTH = 10_000;
const SPEEDTEST_PAYLOAD_BYTES = 8 * 1024 * 1024;
const SPEEDTEST_TIMEOUT_MS = 30_000;
const PING_INTERVAL_MS = 3000;

type SignalingAction =
  | { type: "create_room" }
  | { type: "join_room"; code: string };

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [];

  const stunUrls = (import.meta.env.VITE_ICE_SERVERS || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  if (stunUrls.length > 0) {
    servers.push({ urls: stunUrls });
  }

  const turnUrls = (import.meta.env.VITE_TURN_URL || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  if (turnUrls.length > 0) {
    servers.push({
      urls: turnUrls,
      username: import.meta.env.VITE_TURN_USERNAME || undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined,
    });
  }

  return servers;
}

const TURN_CREDENTIALS_URL =
  SIGNALING_SERVER.replace(/^ws/, "http").replace(/\/ws\/?$/, "") +
  "/turn-credentials";

let cachedIceServers: RTCIceServer[] | null = null;

async function getIceServers(): Promise<RTCIceServer[]> {
  if (cachedIceServers) return cachedIceServers;

  const base = buildIceServers();
  try {
    const res = await fetch(TURN_CREDENTIALS_URL);
    if (res.ok) {
      const data = await res.json();
      const fetched: RTCIceServer[] = Array.isArray(data.iceServers)
        ? data.iceServers
        : data.iceServers
          ? [data.iceServers]
          : [];
      if (fetched.length > 0) {
        cachedIceServers = [...base, ...fetched];
        return cachedIceServers;
      }
    }
  } catch (err) {
    console.error("Failed to fetch TURN credentials:", err);
  }
  return base;
}

function safeFileName(name: string): string {
  return name.replace(/[/\\]/g, "_").replace(/^\.+/, "_") || "download";
}

async function detectConnectionType(pc: RTCPeerConnection): Promise<ConnectionType> {
  try {
    const stats = await pc.getStats();
    let pairId: string | null = null;

    stats.forEach((report) => {
      if (report.type === "transport" && report.selectedCandidatePairId) {
        pairId = report.selectedCandidatePairId;
      }
    });

    if (!pairId) {
      stats.forEach((report) => {
        if (
          report.type === "candidate-pair" &&
          (report.selected || (report.nominated && report.state === "succeeded"))
        ) {
          pairId = report.id;
        }
      });
    }

    if (!pairId) return null;

    const pair = stats.get(pairId);
    if (!pair) return null;

    const local = stats.get(pair.localCandidateId);
    const remote = stats.get(pair.remoteCandidateId);
    const isRelay = local?.candidateType === "relay" || remote?.candidateType === "relay";
    return isRelay ? "relay" : "direct";
  } catch {
    return null;
  }
}

const noop = () => {};

function sendSpeedTestPayload(
  channel: RTCDataChannel,
  id: string,
  phase: SpeedTestPhase,
  totalBytes: number,
  chunkSize: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      channel.send(JSON.stringify({ type: "speedtest_start", id, phase, totalBytes }));
    } catch (err) {
      reject(err as Error);
      return;
    }

    const fullChunk = new Uint8Array(chunkSize);
    crypto.getRandomValues(fullChunk);
    let sent = 0;

    const sendNext = () => {
      if (sent >= totalBytes) {
        try {
          channel.send(JSON.stringify({ type: "speedtest_end", id, phase }));
        } catch (err) {
          reject(err as Error);
          return;
        }
        resolve();
        return;
      }

      const size = Math.min(chunkSize, totalBytes - sent);
      const payload = size === chunkSize ? fullChunk.buffer : fullChunk.buffer.slice(0, size);

      try {
        channel.send(payload);
      } catch (err) {
        reject(err as Error);
        return;
      }
      sent += size;

      if (channel.bufferedAmount > chunkSize * 8) {
        channel.onbufferedamountlow = () => {
          channel.onbufferedamountlow = null;
          sendNext();
        };
        channel.bufferedAmountLowThreshold = chunkSize * 4;
      } else {
        sendNext();
      }
    };

    sendNext();
  });
}

interface PeerProviderProps {
  children: ReactNode;
}

export function PeerProvider({ children }: PeerProviderProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const roleRef = useRef<PeerRole>(null);
  const iceRestartAttemptsRef = useRef(0);
  const hadConnectedRef = useRef(false);
  const sessionStartRef = useRef<number | null>(null);

  const lastActionRef = useRef<SignalingAction | null>(null);
  const intentionalCloseRef = useRef(false);
  const wsReconnectAttemptsRef = useRef(0);

  const incomingChunksRef = useRef<ArrayBuffer[]>([]);
  const incomingMetaRef = useRef<TransferMeta | null>(null);
  const receivedChunksRef = useRef<number>(0);
  const recvSpeedSampleRef = useRef<{ time: number; bytes: number }>({
    time: 0,
    bytes: 0,
  });
  const recvHasherRef = useRef<IHasher | null>(null);
  const recvModeRef = useRef<"stream" | "memory">("memory");
  const writableRef = useRef<FileSystemWritableFileStream | null>(null);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const recvChainRef = useRef<Promise<void>>(Promise.resolve());

  const queueRef = useRef<QueueItem[]>([]);
  const filesByIdRef = useRef<Map<string, File>>(new Map());
  const processingRef = useRef(false);
  const pausedRef = useRef(false);
  const resumeFnRef = useRef<(() => void) | null>(null);
  const cancelledRef = useRef<Set<string>>(new Set());

  const speedTestRecvRef = useRef<{
    active: boolean;
    id: string;
    phase: SpeedTestPhase;
    bytes: number;
    startTime: number;
    totalBytes: number;
  }>({ active: false, id: "", phase: "up", bytes: 0, startTime: 0, totalBytes: 0 });
  const speedTestRunningRef = useRef(false);
  const speedTestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [roomCode, setRoomCode] = useState<string>("");
  const [role, setRole] = useState<PeerRole>(null);
  const [connectionType, setConnectionType] = useState<ConnectionType>(null);
  const [disconnectReason, setDisconnectReason] = useState<"peer_left" | null>(null);
  const [lastSessionSummary, setLastSessionSummary] = useState<SessionSummary | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const [sendProgress, setSendProgress] = useState<number>(0);
  const [sendSpeed, setSendSpeed] = useState<number>(0);
  const [sendFileName, setSendFileName] = useState<string | null>(null);

  const [recvProgress, setRecvProgress] = useState<number>(0);
  const [recvSpeed, setRecvSpeed] = useState<number>(0);
  const [recvFileName, setRecvFileName] = useState<string | null>(null);

  const [saveFolder, setSaveFolder] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [messages, setMessages] = useState<TextEntry[]>([]);

  const [pingMs, setPingMs] = useState<number | null>(null);
  const [speedTestRunning, setSpeedTestRunning] = useState(false);
  const [speedTestResult, setSpeedTestResult] = useState<SpeedTestResult | null>(null);

  const canStreamToDisk =
    typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

  const startWebRTCRef = useRef<() => Promise<void>>(null!);
  const handleOfferRef = useRef<(sdp: string) => Promise<void>>(null!);
  const handlePeerDisconnectRef = useRef<() => void>(null!);
  const setupDataChannelRef = useRef<(channel: RTCDataChannel) => void>(null!);
  const attemptIceRestartRef = useRef<() => Promise<void>>(null!);
  const processQueueRef = useRef<() => void>(null!);
  const openSocketRef = useRef<(action: SignalingAction) => void>(null!);

  const syncQueue = () => setQueue([...queueRef.current]);

  const handleSignalingMessage = useCallback(async (message: SignalingMessage) => {
    switch (message.type) {
      case "room_created": {
        setRoomCode(message.code);
        setStatus("waiting_for_peer");
        break;
      }

      case "room_joined": {
        roleRef.current = "answerer";
        setRole("answerer");
        setStatus("waiting_for_peer");
        break;
      }

      case "peer_joined": {
        roleRef.current = "offerer";
        setRole("offerer");
        setStatus("peer_joined");
        await startWebRTCRef.current();
        break;
      }

      case "offer": {
        await handleOfferRef.current(message.sdp);
        break;
      }

      case "answer": {
        if (!pcRef.current) break;
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: message.sdp }),
        );
        break;
      }

      case "ice": {
        if (!pcRef.current) break;
        await pcRef.current.addIceCandidate(
          new RTCIceCandidate(message.candidate),
        );
        break;
      }

      case "peer_disconnected": {
        handlePeerDisconnectRef.current();
        break;
      }

      case "error": {
        setErrorReason(message.message);
        setStatus("error");
        break;
      }
    }
  }, []);

  const handleSocketClose = useCallback(() => {
    if (intentionalCloseRef.current) {
      intentionalCloseRef.current = false;
      return;
    }

    const channelOpen = channelRef.current?.readyState === "open";

    if (wsReconnectAttemptsRef.current >= MAX_WS_RECONNECT_ATTEMPTS || !lastActionRef.current) {
      if (!channelOpen) handlePeerDisconnectRef.current();
      return;
    }

    wsReconnectAttemptsRef.current += 1;
    if (!channelOpen) setStatus("reconnecting");

    const backoff = 500 * 2 ** (wsReconnectAttemptsRef.current - 1);
    setTimeout(() => {
      if (lastActionRef.current) openSocketRef.current(lastActionRef.current);
    }, backoff);
  }, []);

  const openSocket = useCallback(
    (action: SignalingAction) => {
      lastActionRef.current = action;

      const ws = new WebSocket(SIGNALING_SERVER);
      wsRef.current = ws;

      ws.onopen = () => {
        wsReconnectAttemptsRef.current = 0;
        ws.send(JSON.stringify(action));
      };

      ws.onmessage = async (event) => {
        const message: SignalingMessage = JSON.parse(event.data);
        await handleSignalingMessage(message);
      };

      ws.onclose = () => {
        handleSocketClose();
      };

      ws.onerror = () => {};
    },
    [handleSignalingMessage, handleSocketClose],
  );

  const createRoom = useCallback(() => {
    setTransferError(null);
    setErrorReason(null);
    setDisconnectReason(null);
    setLastSessionSummary(null);
    setStatus("connecting");
    wsReconnectAttemptsRef.current = 0;
    openSocket({ type: "create_room" });
  }, [openSocket]);

  const joinRoom = useCallback((code: string) => {
    setTransferError(null);
    setErrorReason(null);
    setDisconnectReason(null);
    setLastSessionSummary(null);
    setStatus("connecting");
    wsReconnectAttemptsRef.current = 0;
    openSocket({ type: "join_room", code: code.toUpperCase() });
  }, [openSocket]);

  const setupDataChannel = (channel: RTCDataChannel) => {
    channel.onopen = () => {
      hadConnectedRef.current = true;
      sessionStartRef.current = Date.now();
      setStatus("p2p_connected");
    };

    channel.onclose = () => {
      handlePeerDisconnectRef.current();
    };

    const handleMeta = async (meta: TransferMeta) => {
      incomingMetaRef.current = meta;
      receivedChunksRef.current = 0;
      recvSpeedSampleRef.current = { time: performance.now(), bytes: 0 };
      setTransferError(null);
      setRecvProgress(0);
      setRecvFileName(meta.fileName);

      if (!recvHasherRef.current) {
        recvHasherRef.current = await createSHA256();
      }
      recvHasherRef.current.init();

      if (dirHandleRef.current) {
        try {
          const fileHandle = await dirHandleRef.current.getFileHandle(
            safeFileName(meta.fileName),
            { create: true },
          );
          writableRef.current = await fileHandle.createWritable();
          recvModeRef.current = "stream";
          return;
        } catch (err) {
          console.error("Falling back to in-memory receive:", err);
          writableRef.current = null;
        }
      }
      recvModeRef.current = "memory";
      incomingChunksRef.current = [];
    };

    const handleChunk = async (buffer: ArrayBuffer) => {
      const meta = incomingMetaRef.current;
      if (!meta) return;

      recvHasherRef.current?.update(new Uint8Array(buffer));

      if (recvModeRef.current === "stream" && writableRef.current) {
        await writableRef.current.write(buffer);
      } else {
        incomingChunksRef.current.push(buffer);
      }

      receivedChunksRef.current += 1;
      setRecvProgress(
        Math.round((receivedChunksRef.current / meta.totalChunks) * 100),
      );

      const sample = recvSpeedSampleRef.current;
      sample.bytes += buffer.byteLength;
      const now = performance.now();
      const elapsed = now - sample.time;
      if (elapsed >= SPEED_SAMPLE_INTERVAL_MS) {
        setRecvSpeed(Math.round((sample.bytes / elapsed) * 1000));
        sample.time = now;
        sample.bytes = 0;
      }
    };

    const finalizeReceive = async (checksum: string) => {
      const meta = incomingMetaRef.current;
      if (!meta) return;

      const digest = recvHasherRef.current?.digest("hex") ?? "";
      const ok = digest === checksum;

      if (ok) {
        if (recvModeRef.current === "stream" && writableRef.current) {
          await writableRef.current.close();
        } else {
          const blob = new Blob(incomingChunksRef.current, {
            type: meta.fileType,
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = meta.fileName;
          a.click();
          URL.revokeObjectURL(url);
        }
        setReceivedFiles((prev) => [
          {
            id: meta.id,
            fileName: meta.fileName,
            fileSize: meta.fileSize,
            fileType: meta.fileType,
            receivedAt: Date.now(),
          },
          ...prev,
        ]);
      } else {
        if (recvModeRef.current === "stream" && writableRef.current) {
          try {
            await writableRef.current.abort();
          } catch {
            noop();
          }
        }
        setTransferError(
          `"${meta.fileName}" failed its integrity check and was discarded. Ask the sender to try again.`,
        );
      }

      try {
        channel.send(JSON.stringify({ type: "ack", id: meta.id, ok }));
      } catch {
        noop();
      }

      writableRef.current = null;
      incomingChunksRef.current = [];
      incomingMetaRef.current = null;
      receivedChunksRef.current = 0;
      setRecvFileName(null);
      setRecvProgress(0);
      setRecvSpeed(0);
    };

    const handleData = async (data: string | ArrayBuffer) => {
      if (typeof data === "string") {
        const msg: DataChannelMessage = JSON.parse(data);

        if (msg.type === "speedtest_start") {
          speedTestRecvRef.current = {
            active: true,
            id: msg.id,
            phase: msg.phase,
            bytes: 0,
            startTime: performance.now(),
            totalBytes: msg.totalBytes,
          };
          return;
        }

        if (msg.type === "speedtest_end") {
          const rt = speedTestRecvRef.current;
          if (!rt.active || rt.id !== msg.id) return;
          rt.active = false;

          const elapsed = performance.now() - rt.startTime;
          const bytesPerSec = elapsed > 0 ? Math.round((rt.bytes / elapsed) * 1000) : 0;

          try {
            channel.send(JSON.stringify({ type: "speedtest_report", id: msg.id, phase: msg.phase, bytesPerSec }));
          } catch {
            noop();
          }

          if (msg.phase === "down") {
            setSpeedTestResult((prev) => ({ upBytesPerSec: prev?.upBytesPerSec ?? null, downBytesPerSec: bytesPerSec }));
            setSpeedTestRunning(false);
            speedTestRunningRef.current = false;
            if (speedTestTimeoutRef.current) {
              clearTimeout(speedTestTimeoutRef.current);
              speedTestTimeoutRef.current = null;
            }
          } else {
            sendSpeedTestPayload(channel, msg.id, "down", rt.totalBytes, CHUNK_SIZE).catch(noop);
          }
          return;
        }

        if (msg.type === "speedtest_report") {
          if (msg.phase === "up") {
            setSpeedTestResult((prev) => ({ upBytesPerSec: msg.bytesPerSec, downBytesPerSec: prev?.downBytesPerSec ?? null }));
          }
          return;
        }

        if (msg.type === "text") {
          setMessages((prev) => [
            ...prev,
            { id: msg.id, text: msg.text, direction: "received", at: Date.now() },
          ]);
          return;
        }

        if (msg.type === "request") {
          setIncomingRequests((prev) => [...prev, { batchId: msg.batchId, files: msg.files }]);
          return;
        }

        if (msg.type === "accept") {
          let anyApproved = false;
          queueRef.current.forEach((item) => {
            if (item.batchId === msg.batchId && item.status === "pending") {
              item.status = "queued";
              anyApproved = true;
            }
          });
          syncQueue();
          if (anyApproved) processQueueRef.current();
          return;
        }

        if (msg.type === "decline") {
          let anyDeclined = false;
          queueRef.current.forEach((item) => {
            if (item.batchId === msg.batchId && item.status === "pending") {
              item.status = "cancelled";
              filesByIdRef.current.delete(item.id);
              anyDeclined = true;
            }
          });
          syncQueue();
          if (anyDeclined) {
            setTransferError("The receiver declined your files.");
          }
          return;
        }

        if (msg.type === "meta") {
          await handleMeta(msg);
        } else if (msg.type === "complete") {
          await finalizeReceive(msg.checksum);
        } else if (msg.type === "cancel") {
          const name = incomingMetaRef.current?.fileName;
          if (writableRef.current) {
            try {
              await writableRef.current.abort();
            } catch {
              noop();
            }
            writableRef.current = null;
          }
          incomingChunksRef.current = [];
          incomingMetaRef.current = null;
          receivedChunksRef.current = 0;
          setRecvFileName(null);
          setRecvProgress(0);
          setRecvSpeed(0);
          setTransferError(
            name
              ? `The sender cancelled "${name}".`
              : "The sender cancelled the transfer.",
          );
        } else if (msg.type === "ack") {
          const item = queueRef.current.find((i) => i.id === msg.id);
          if (item && !msg.ok) {
            item.status = "error";
            syncQueue();
            setTransferError(
              `The receiver couldn't verify "${item.fileName}". It may be corrupted — try sending it again.`,
            );
          }
        }
        return;
      }

      const rt = speedTestRecvRef.current;
      if (rt.active) {
        rt.bytes += (data as ArrayBuffer).byteLength;
        return;
      }

      await handleChunk(data);
    };

    channel.onmessage = (event) => {
      const data = event.data as string | ArrayBuffer;
      recvChainRef.current = recvChainRef.current
        .then(() => handleData(data))
        .catch((err) => console.error("Receive error:", err));
    };
  };

  const acceptRequest = useCallback((batchId: string) => {
    setIncomingRequests((prev) => {
      const found = prev.find((r) => r.batchId === batchId);
      if (found) {
        try {
          channelRef.current?.send(JSON.stringify({ type: "accept", batchId }));
        } catch {
          noop();
        }
      }
      return prev.filter((r) => r.batchId !== batchId);
    });
  }, []);

  const declineRequest = useCallback((batchId: string) => {
    setIncomingRequests((prev) => {
      const found = prev.find((r) => r.batchId === batchId);
      if (found) {
        try {
          channelRef.current?.send(JSON.stringify({ type: "decline", batchId }));
        } catch {
          noop();
        }
      }
      return prev.filter((r) => r.batchId !== batchId);
    });
  }, []);

  const sendText = useCallback((text: string) => {
    const trimmed = text.trim().slice(0, MAX_TEXT_LENGTH);
    if (!trimmed) return;

    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") return;

    const id = crypto.randomUUID();
    try {
      channel.send(JSON.stringify({ type: "text", id, text: trimmed }));
    } catch {
      return;
    }

    setMessages((prev) => [...prev, { id, text: trimmed, direction: "sent", at: Date.now() }]);
  }, []);

  const runSpeedTest = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") return;
    if (speedTestRunningRef.current || processingRef.current || incomingMetaRef.current) return;

    speedTestRunningRef.current = true;
    setSpeedTestRunning(true);
    setSpeedTestResult(null);

    const id = crypto.randomUUID();

    speedTestTimeoutRef.current = setTimeout(() => {
      speedTestRunningRef.current = false;
      setSpeedTestRunning(false);
    }, SPEEDTEST_TIMEOUT_MS);

    sendSpeedTestPayload(channel, id, "up", SPEEDTEST_PAYLOAD_BYTES, CHUNK_SIZE).catch(() => {
      speedTestRunningRef.current = false;
      setSpeedTestRunning(false);
      if (speedTestTimeoutRef.current) {
        clearTimeout(speedTestTimeoutRef.current);
        speedTestTimeoutRef.current = null;
      }
    });
  }, []);

  const chooseSaveFolder = useCallback(async () => {
    if (typeof window.showDirectoryPicker !== "function") return;
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      dirHandleRef.current = handle;
      setSaveFolder(handle.name);
    } catch {
      noop();
    }
  }, []);

  const handlePeerDisconnect = () => {
    const wasConnected = hadConnectedRef.current;
    hadConnectedRef.current = false;

    const filesSent = queueRef.current.filter((item) => item.status === "done").length;
    const bytesSent = queueRef.current
      .filter((item) => item.status === "done")
      .reduce((sum, item) => sum + item.fileSize, 0);
    const filesReceived = receivedFiles.length;
    const bytesReceived = receivedFiles.reduce((sum, file) => sum + file.fileSize, 0);
    const durationMs = sessionStartRef.current ? Date.now() - sessionStartRef.current : 0;
    sessionStartRef.current = null;

    if (wasConnected && (filesSent > 0 || filesReceived > 0 || messages.length > 0)) {
      setLastSessionSummary({
        filesSent,
        bytesSent,
        filesReceived,
        bytesReceived,
        textMessages: messages.length,
        durationMs,
      });
    }

    pcRef.current?.close();
    pcRef.current = null;
    channelRef.current = null;
    roleRef.current = null;
    iceRestartAttemptsRef.current = 0;

    if (writableRef.current) {
      writableRef.current.abort().catch(noop);
      writableRef.current = null;
    }
    incomingChunksRef.current = [];
    incomingMetaRef.current = null;
    receivedChunksRef.current = 0;
    recvModeRef.current = "memory";
    recvChainRef.current = Promise.resolve();

    queueRef.current = [];
    filesByIdRef.current.clear();
    processingRef.current = false;
    pausedRef.current = false;
    resumeFnRef.current = null;
    cancelledRef.current.clear();

    speedTestRecvRef.current = { active: false, id: "", phase: "up", bytes: 0, startTime: 0, totalBytes: 0 };
    speedTestRunningRef.current = false;
    if (speedTestTimeoutRef.current) {
      clearTimeout(speedTestTimeoutRef.current);
      speedTestTimeoutRef.current = null;
    }
    setSpeedTestRunning(false);
    setSpeedTestResult(null);
    setPingMs(null);

    intentionalCloseRef.current = true;
    lastActionRef.current = null;
    wsReconnectAttemptsRef.current = 0;
    wsRef.current?.close();
    wsRef.current = null;

    setRole(null);
    setRoomCode("");
    setConnectionType(null);
    setSendProgress(0);
    setSendSpeed(0);
    setSendFileName(null);
    setRecvProgress(0);
    setRecvSpeed(0);
    setRecvFileName(null);
    setIsPaused(false);
    setQueue([]);
    setTransferError(null);
    setErrorReason(null);
    setReceivedFiles([]);
    setIncomingRequests([]);
    setMessages([]);
    setDisconnectReason(wasConnected ? "peer_left" : null);
    setStatus("idle");
  };

  const dismissDisconnectReason = useCallback(() => {
    setDisconnectReason(null);
  }, []);

  const dismissSessionSummary = useCallback(() => {
    setLastSessionSummary(null);
  }, []);

  const reset = useCallback(() => {
    handlePeerDisconnectRef.current();
  }, []);

  const processQueue = async () => {
    if (processingRef.current || pausedRef.current) return;

    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") return;

    const next = queueRef.current.find((item) => item.status === "queued");
    if (!next) return;

    const file = filesByIdRef.current.get(next.id);
    if (!file) return;

    processingRef.current = true;
    next.status = "sending";
    syncQueue();
    setSendFileName(next.fileName);
    setSendProgress(0);

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const remainingAfter = queueRef.current.filter(
      (item) => item.status === "queued",
    ).length;

    const meta: TransferMeta = {
      type: "meta",
      id: next.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      totalChunks,
      isLastInQueue: remainingAfter === 0,
    };
    channel.send(JSON.stringify(meta));

    const hasher = await createSHA256();
    hasher.init();

    const speedSample = { time: performance.now(), bytes: 0 };
    let offset = 0;
    let chunkIndex = 0;

    const advance = () => {
      processingRef.current = false;
      setSendFileName(null);
      const hasMore = queueRef.current.some((item) => item.status === "queued");
      if (hasMore) {
        processQueueRef.current();
      } else {
        setSendSpeed(0);
      }
    };

    const finishFile = () => {
      channel.send(
        JSON.stringify({
          type: "complete",
          id: next.id,
          checksum: hasher.digest("hex"),
        }),
      );
      next.status = "done";
      syncQueue();
      processingRef.current = false;
      setSendFileName(null);

      const hasMore = queueRef.current.some((item) => item.status === "queued");
      if (hasMore) {
        processQueueRef.current();
      } else {
        setSendSpeed(0);
      }
    };

    const finishCancel = () => {
      try {
        channel.send(JSON.stringify({ type: "cancel", id: next.id }));
      } catch {
        noop();
      }
      cancelledRef.current.delete(next.id);
      filesByIdRef.current.delete(next.id);
      next.status = "cancelled";
      syncQueue();
      advance();
    };

    const sendNextChunk = () => {
      if (cancelledRef.current.has(next.id)) {
        finishCancel();
        return;
      }

      if (pausedRef.current) {
        resumeFnRef.current = sendNextChunk;
        return;
      }

      if (offset >= file.size) {
        finishFile();
        return;
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const reader = new FileReader();

      reader.onload = () => {
        const buffer = reader.result as ArrayBuffer;
        channel.send(buffer);
        hasher.update(new Uint8Array(buffer));

        chunkIndex += 1;
        offset += CHUNK_SIZE;
        const pct = Math.round((chunkIndex / totalChunks) * 100);
        setSendProgress(pct);

        speedSample.bytes += buffer.byteLength;
        const now = performance.now();
        const elapsed = now - speedSample.time;
        if (elapsed >= SPEED_SAMPLE_INTERVAL_MS) {
          setSendSpeed(Math.round((speedSample.bytes / elapsed) * 1000));
          speedSample.time = now;
          speedSample.bytes = 0;
        }

        if (offset < file.size) {
          if (channel.bufferedAmount > CHUNK_SIZE * 8) {
            channel.onbufferedamountlow = () => {
              channel.onbufferedamountlow = null;
              sendNextChunk();
            };
            channel.bufferedAmountLowThreshold = CHUNK_SIZE * 4;
          } else {
            sendNextChunk();
          }
        } else {
          finishFile();
        }
      };

      reader.readAsArrayBuffer(slice);
    };

    sendNextChunk();
  };

  const queueFiles = useCallback(async (files: File[]) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") return;

    const batchId = crypto.randomUUID();
    const items: QueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      batchId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      status: "pending",
    }));

    items.forEach((item, i) => filesByIdRef.current.set(item.id, files[i]));
    queueRef.current = [...queueRef.current, ...items];
    syncQueue();

    const previews = await Promise.all(files.map((file) => createImagePreview(file)));

    try {
      channel.send(
        JSON.stringify({
          type: "request",
          batchId,
          files: items.map((item, i) => ({
            id: item.id,
            fileName: item.fileName,
            fileSize: item.fileSize,
            fileType: item.fileType,
            previewDataUrl: previews[i],
          })),
        }),
      );
    } catch {
      noop();
    }
  }, []);

  const cancelTransfer = useCallback((id: string) => {
    const item = queueRef.current.find((i) => i.id === id);
    if (!item) return;

    if (item.status === "sending") {
      cancelledRef.current.add(id);
      if (pausedRef.current) {
        pausedRef.current = false;
        setIsPaused(false);
        const fn = resumeFnRef.current;
        resumeFnRef.current = null;
        fn?.();
      }
    } else if (item.status === "queued" || item.status === "pending") {
      item.status = "cancelled";
      filesByIdRef.current.delete(id);
      syncQueue();
    }
  }, []);

  const pauseTransfer = useCallback(() => {
    pausedRef.current = true;
    setIsPaused(true);
  }, []);

  const resumeTransfer = useCallback(() => {
    pausedRef.current = false;
    setIsPaused(false);

    const fn = resumeFnRef.current;
    resumeFnRef.current = null;
    if (fn) {
      fn();
    } else {
      processQueueRef.current();
    }
  }, []);

  const handleConnectionStateChange = (pc: RTCPeerConnection) => () => {
    switch (pc.connectionState) {
      case "connected":
        iceRestartAttemptsRef.current = 0;
        setStatus("p2p_connected");
        detectConnectionType(pc).then(setConnectionType);
        break;
      case "failed":
        setStatus("reconnecting");
        attemptIceRestartRef.current();
        break;
      case "closed":
        handlePeerDisconnectRef.current();
        break;
    }
  };

  const attemptIceRestart = async () => {
    if (roleRef.current !== "offerer") return;

    if (
      !pcRef.current ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      iceRestartAttemptsRef.current >= MAX_ICE_RESTART_ATTEMPTS
    ) {
      handlePeerDisconnectRef.current();
      return;
    }

    iceRestartAttemptsRef.current += 1;

    try {
      const offer = await pcRef.current.createOffer({ iceRestart: true });
      await pcRef.current.setLocalDescription(offer);
      wsRef.current.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
    } catch (err) {
      console.error("ICE restart failed:", err);
      handlePeerDisconnectRef.current();
    }
  };

  const startWebRTC = async () => {
    const pc = new RTCPeerConnection({ iceServers: await getIceServers() });
    pcRef.current = pc;

    const channel = pc.createDataChannel("fileTransfer", { ordered: true });
    channelRef.current = channel;
    channel.binaryType = "arraybuffer";
    setupDataChannelRef.current(channel);

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      wsRef.current?.send(
        JSON.stringify({
          type: "ice",
          candidate: event.candidate.toJSON(),
        }),
      );
    };

    pc.onconnectionstatechange = handleConnectionStateChange(pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    wsRef.current?.send(
      JSON.stringify({
        type: "offer",
        sdp: offer.sdp,
      }),
    );
  };

  const handleOffer = async (sdp: string) => {
    let pc = pcRef.current;

    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: await getIceServers() });
      pcRef.current = pc;

      pc.ondatachannel = (event) => {
        const channel = event.channel;
        channelRef.current = channel;
        channel.binaryType = "arraybuffer";
        setupDataChannelRef.current(channel);
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        wsRef.current?.send(
          JSON.stringify({
            type: "ice",
            candidate: event.candidate.toJSON(),
          }),
        );
      };

      pc.onconnectionstatechange = handleConnectionStateChange(pc);
    }

    await pc.setRemoteDescription(
      new RTCSessionDescription({ type: "offer", sdp }),
    );

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    wsRef.current?.send(
      JSON.stringify({
        type: "answer",
        sdp: answer.sdp,
      }),
    );
  };

  useEffect(() => {
    setupDataChannelRef.current = setupDataChannel;
    handlePeerDisconnectRef.current = handlePeerDisconnect;
    startWebRTCRef.current = startWebRTC;
    handleOfferRef.current = handleOffer;
    attemptIceRestartRef.current = attemptIceRestart;
    processQueueRef.current = processQueue;
    openSocketRef.current = openSocket;
  });

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      if (lastActionRef.current && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) {
        openSocketRef.current(lastActionRef.current);
      }

      const pc = pcRef.current;
      if (pc && (pc.connectionState === "failed" || pc.connectionState === "disconnected")) {
        attemptIceRestartRef.current();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    if (status !== "p2p_connected") return;

    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(noop);
          return;
        }
        sentinel = lock;
      } catch {
        noop();
      }
    };

    acquire();

    const onVisible = () => {
      if (document.visibilityState === "visible" && !sentinel) acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(noop);
    };
  }, [status]);

  useEffect(() => {
    if (status !== "p2p_connected") return;

    let cancelled = false;

    const poll = async () => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        const stats = await pc.getStats();
        let rtt: number | null = null;

        stats.forEach((report) => {
          if (
            report.type === "candidate-pair" &&
            (report.selected || (report.nominated && report.state === "succeeded")) &&
            typeof report.currentRoundTripTime === "number"
          ) {
            rtt = report.currentRoundTripTime;
          }
        });

        if (!cancelled && rtt !== null) {
          setPingMs(Math.round(rtt * 1000));
        }
      } catch {
        noop();
      }
    };

    poll();
    const interval = setInterval(poll, PING_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status]);

  const value: PeerContextValue = {
    status,
    roomCode,
    role,
    connectionType,
    disconnectReason,
    dismissDisconnectReason,
    lastSessionSummary,
    dismissSessionSummary,
    queue,
    isPaused,
    sendProgress,
    sendSpeed,
    sendFileName,
    recvProgress,
    recvSpeed,
    recvFileName,
    canStreamToDisk,
    saveFolder,
    transferError,
    errorReason,
    receivedFiles,
    incomingRequests,
    acceptRequest,
    declineRequest,
    messages,
    sendText,
    pingMs,
    speedTestRunning,
    speedTestResult,
    runSpeedTest,
    reset,
    createRoom,
    joinRoom,
    queueFiles,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    chooseSaveFolder,
  };

  return <PeerContext.Provider value={value}>{children}</PeerContext.Provider>;
}
