import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  type ConnectionStatus,
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
const SPEED_SAMPLE_INTERVAL_MS = 250;

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

interface PeerProviderProps {
  children: ReactNode;
}

export function PeerProvider({ children }: PeerProviderProps) {
  // -- refs (connections, never trigger re-render) --
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const roleRef = useRef<PeerRole>(null);
  const iceRestartAttemptsRef = useRef(0);

  // -- file transfer refs (mutable, no re-render needed) --
  const incomingChunksRef = useRef<ArrayBuffer[]>([]);
  const incomingMetaRef = useRef<TransferMeta | null>(null);
  const receivedChunksRef = useRef<number>(0);
  const recvSpeedSampleRef = useRef<{ time: number; bytes: number }>({
    time: 0,
    bytes: 0,
  });

  // -- send queue refs --
  const queueRef = useRef<QueueItem[]>([]);
  const filesByIdRef = useRef<Map<string, File>>(new Map());
  const processingRef = useRef(false);
  const pausedRef = useRef(false);
  const resumeFnRef = useRef<(() => void) | null>(null);

  // -- state (drives UI) --
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [roomCode, setRoomCode] = useState<string>("");
  const [role, setRole] = useState<PeerRole>(null);
  const [progress, setProgress] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const startWebRTCRef = useRef<() => Promise<void>>(null!);
  const handleOfferRef = useRef<(sdp: string) => Promise<void>>(null!);
  const handlePeerDisconnectRef = useRef<() => void>(null!);
  const setupDataChannelRef = useRef<(channel: RTCDataChannel) => void>(null!);
  const attemptIceRestartRef = useRef<() => Promise<void>>(null!);
  const processQueueRef = useRef<() => void>(null!);

  const syncQueue = () => setQueue([...queueRef.current]);

  const createRoom = useCallback(() => {
    setStatus("connecting");

    const ws = new WebSocket(SIGNALING_SERVER);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "create_room" }));
    };

    ws.onmessage = async (event) => {
      const message: SignalingMessage = JSON.parse(event.data);

      switch (message.type) {
        case "room_created": {
          setRoomCode(message.code);
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

    ws.onclose = () => {
      setStatus("idle");
    };

    ws.onerror = () => {
      setStatus("error");
    };
  }, []);

  const setupDataChannel = (channel: RTCDataChannel) => {
    channel.onopen = () => {
      console.log("Data channel open");
      setStatus("p2p_connected");
    };

    channel.onclose = () => {
      console.log("Data channel closed");
      handlePeerDisconnectRef.current();
    };

    channel.onmessage = (event) => {
      const data = event.data;

      // first message is always metadata (a JSON string)
      if (typeof data === "string") {
        const meta: TransferMeta = JSON.parse(data);
        incomingMetaRef.current = meta;
        incomingChunksRef.current = [];
        receivedChunksRef.current = 0;
        recvSpeedSampleRef.current = { time: performance.now(), bytes: 0 };
        setProgress(0);
        setCurrentFileName(meta.fileName);
        setStatus("transferring");
        return;
      }

      // subsequent messages are ArrayBuffer chunks
      const chunk = data as ArrayBuffer;
      incomingChunksRef.current.push(chunk);
      receivedChunksRef.current += 1;

      const meta = incomingMetaRef.current!;
      const pct = Math.round(
        (receivedChunksRef.current / meta.totalChunks) * 100,
      );
      setProgress(pct);

      const sample = recvSpeedSampleRef.current;
      sample.bytes += chunk.byteLength;
      const now = performance.now();
      const elapsed = now - sample.time;
      if (elapsed >= SPEED_SAMPLE_INTERVAL_MS) {
        setSpeed(Math.round((sample.bytes / elapsed) * 1000));
        sample.time = now;
        sample.bytes = 0;
      }

      // all chunks received — reassemble and trigger download
      if (receivedChunksRef.current === meta.totalChunks) {
        const blob = new Blob(incomingChunksRef.current, {
          type: meta.fileType,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = meta.fileName;
        a.click();
        URL.revokeObjectURL(url);

        // reset
        incomingChunksRef.current = [];
        incomingMetaRef.current = null;
        receivedChunksRef.current = 0;
        setCurrentFileName(null);

        if (meta.isLastInQueue) {
          setStatus("done");
          setProgress(100);
          setSpeed(0);
        }
      }
    };
  };

  const handlePeerDisconnect = () => {
    pcRef.current?.close();
    pcRef.current = null;
    channelRef.current = null;
    roleRef.current = null;
    iceRestartAttemptsRef.current = 0;
    incomingChunksRef.current = [];
    incomingMetaRef.current = null;
    receivedChunksRef.current = 0;
    queueRef.current = [];
    filesByIdRef.current.clear();
    processingRef.current = false;
    pausedRef.current = false;
    resumeFnRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    setRole(null);
    setRoomCode("");
    setProgress(0);
    setSpeed(0);
    setIsPaused(false);
    setCurrentFileName(null);
    setQueue([]);
    setStatus("idle");
  };

  const processQueue = () => {
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
      id: next.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      totalChunks,
      isLastInQueue: remainingAfter === 0,
    };
    channel.send(JSON.stringify(meta));

    const speedSample = { time: performance.now(), bytes: 0 };
    let offset = 0;
    let chunkIndex = 0;

    const finishFile = () => {
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

    const sendNextChunk = () => {
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
          // check buffer before sending next chunk
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
    // only the original offerer renegotiates; the answerer just waits
    // for a fresh offer to arrive over the still-open signaling socket.
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

    // create data channel — only offerer does this
    const channel = pc.createDataChannel("fileTransfer", { ordered: true });
    channelRef.current = channel;
    channel.binaryType = "arraybuffer";
    setupDataChannelRef.current(channel);

    // send ICE candidates to other peer as they are discovered
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

    // create offer and send it
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
    // a peer connection may already exist if this offer is an ICE restart
    // (renegotiation) rather than the very first offer in the session.
    let pc = pcRef.current;

    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      // answerer receives data channel — never creates one
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

  const joinRoom = useCallback((code: string) => {
    setStatus("connecting");

    const ws = new WebSocket(SIGNALING_SERVER);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join_room", code: code.toUpperCase() }));
    };

    ws.onmessage = async (event) => {
      const message: SignalingMessage = JSON.parse(event.data);

      switch (message.type) {
        case "room_joined": {
          roleRef.current = "answerer";
          setRole("answerer");
          setStatus("waiting_for_peer");
          break;
        }

        case "offer": {
          await handleOfferRef.current(message.sdp);
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

    ws.onclose = () => {
      setStatus("idle");
    };

    ws.onerror = () => {
      setStatus("error");
    };
  }, []);

  useEffect(() => {
    setupDataChannelRef.current = setupDataChannel;
    handlePeerDisconnectRef.current = handlePeerDisconnect;
    startWebRTCRef.current = startWebRTC;
    handleOfferRef.current = handleOffer;
    attemptIceRestartRef.current = attemptIceRestart;
    processQueueRef.current = processQueue;
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
    createRoom,
    joinRoom,
    queueFiles,
    pauseTransfer,
    resumeTransfer,
  };

  return <PeerContext.Provider value={value}>{children}</PeerContext.Provider>;
}
