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
  type DataChannelMessage,
  type PeerContextValue,
  type PeerRole,
  type QueueItem,
  type SignalingMessage,
  type TransferMeta,
} from "../types";
import { PeerContext } from "./peer-context-instance";

const SIGNALING_SERVER = import.meta.env.VITE_SIGNALING_SERVER;
const CHUNK_SIZE = Number(import.meta.env.VITE_CHUNK_SIZE) * 1024 || 16 * 1024;
const MAX_ICE_RESTART_ATTEMPTS = 3;
const MAX_WS_RECONNECT_ATTEMPTS = 3;
const SPEED_SAMPLE_INTERVAL_MS = 250;

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

  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USERNAME || undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL || undefined,
    });
  }

  return servers;
}

const ICE_SERVERS = buildIceServers();

function safeFileName(name: string): string {
  return name.replace(/[/\\]/g, "_").replace(/^\.+/, "_") || "download";
}

const noop = () => {};

interface PeerProviderProps {
  children: ReactNode;
}

export function PeerProvider({ children }: PeerProviderProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const roleRef = useRef<PeerRole>(null);
  const iceRestartAttemptsRef = useRef(0);

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

  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [roomCode, setRoomCode] = useState<string>("");
  const [role, setRole] = useState<PeerRole>(null);
  const [progress, setProgress] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [saveFolder, setSaveFolder] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);

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

  const handleSignalingMessage = async (message: SignalingMessage) => {
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
        console.error("Signaling error:", message.message);
        setStatus("error");
        break;
      }
    }
  };

  const handleSocketClose = () => {
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
  };

  const openSocket = (action: SignalingAction) => {
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
  };

  const createRoom = useCallback(() => {
    setTransferError(null);
    setStatus("connecting");
    wsReconnectAttemptsRef.current = 0;
    openSocketRef.current({ type: "create_room" });
  }, []);

  const joinRoom = useCallback((code: string) => {
    setTransferError(null);
    setStatus("connecting");
    wsReconnectAttemptsRef.current = 0;
    openSocketRef.current({ type: "join_room", code: code.toUpperCase() });
  }, []);

  const setupDataChannel = (channel: RTCDataChannel) => {
    channel.onopen = () => {
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
      setProgress(0);
      setCurrentFileName(meta.fileName);
      setStatus("transferring");

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
      setProgress(
        Math.round((receivedChunksRef.current / meta.totalChunks) * 100),
      );

      const sample = recvSpeedSampleRef.current;
      sample.bytes += buffer.byteLength;
      const now = performance.now();
      const elapsed = now - sample.time;
      if (elapsed >= SPEED_SAMPLE_INTERVAL_MS) {
        setSpeed(Math.round((sample.bytes / elapsed) * 1000));
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
      setCurrentFileName(null);

      if (ok && meta.isLastInQueue) {
        setStatus("done");
        setProgress(100);
        setSpeed(0);
      } else if (!ok) {
        setStatus("p2p_connected");
        setSpeed(0);
      }
    };

    const handleData = async (data: string | ArrayBuffer) => {
      if (typeof data === "string") {
        const msg: DataChannelMessage = JSON.parse(data);
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
          setCurrentFileName(null);
          setProgress(0);
          setSpeed(0);
          setStatus("p2p_connected");
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
      await handleChunk(data);
    };

    channel.onmessage = (event) => {
      const data = event.data as string | ArrayBuffer;
      recvChainRef.current = recvChainRef.current
        .then(() => handleData(data))
        .catch((err) => console.error("Receive error:", err));
    };
  };

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

    intentionalCloseRef.current = true;
    lastActionRef.current = null;
    wsReconnectAttemptsRef.current = 0;
    wsRef.current?.close();
    wsRef.current = null;

    setRole(null);
    setRoomCode("");
    setProgress(0);
    setSpeed(0);
    setIsPaused(false);
    setCurrentFileName(null);
    setQueue([]);
    setTransferError(null);
    setStatus("idle");
  };

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
    setCurrentFileName(next.fileName);
    setStatus("transferring");
    setProgress(0);

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
      setCurrentFileName(null);
      const hasMore = queueRef.current.some((item) => item.status === "queued");
      if (hasMore) {
        processQueueRef.current();
      } else {
        setSpeed(0);
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
      setCurrentFileName(null);

      const hasMore = queueRef.current.some((item) => item.status === "queued");
      if (hasMore) {
        processQueueRef.current();
      } else {
        setStatus("done");
        setSpeed(0);
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
      const hadMore = queueRef.current.some((item) => item.status === "queued");
      advance();
      if (!hadMore) setStatus("p2p_connected");
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
        setProgress(pct);

        speedSample.bytes += buffer.byteLength;
        const now = performance.now();
        const elapsed = now - speedSample.time;
        if (elapsed >= SPEED_SAMPLE_INTERVAL_MS) {
          setSpeed(Math.round((speedSample.bytes / elapsed) * 1000));
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

  const queueFiles = useCallback((files: File[]) => {
    const items: QueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      status: "queued",
    }));

    items.forEach((item, i) => filesByIdRef.current.set(item.id, files[i]));
    queueRef.current = [...queueRef.current, ...items];
    syncQueue();
    processQueueRef.current();
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
    } else if (item.status === "queued") {
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
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
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
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
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

  const value: PeerContextValue = {
    status,
    roomCode,
    role,
    progress,
    speed,
    isPaused,
    currentFileName,
    queue,
    canStreamToDisk,
    saveFolder,
    transferError,
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
