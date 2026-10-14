interface RuntimeConfig {
  signalingServer?: string;
  publicAppUrl?: string;
  iceServers?: string;
  turnUrl?: string;
  turnUsername?: string;
  turnCredential?: string;
  chunkSizeKb?: string;
}

declare global {
  interface Window {
    __PEERDROP_CONFIG__?: RuntimeConfig;
  }
}

const runtime: RuntimeConfig = window.__PEERDROP_CONFIG__ ?? {};

function pick(fromRuntime: string | undefined, fromBuild: string | undefined, fallback = ""): string {
  return fromRuntime?.trim() || fromBuild?.trim() || fallback;
}

function sameOriginSignaling(): string {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${scheme}://${window.location.host}/ws`;
}

const signalingServer = pick(runtime.signalingServer, import.meta.env.VITE_SIGNALING_SERVER, sameOriginSignaling());

export const config = {
  signalingServer,
  turnCredentialsUrl: signalingServer.replace(/^ws/, "http").replace(/\/ws\/?$/, "") + "/turn-credentials",
  publicAppUrl: pick(runtime.publicAppUrl, import.meta.env.VITE_PUBLIC_APP_URL),
  iceServers: pick(runtime.iceServers, import.meta.env.VITE_ICE_SERVERS, "stun:stun.l.google.com:19302"),
  turnUrl: pick(runtime.turnUrl, import.meta.env.VITE_TURN_URL),
  turnUsername: pick(runtime.turnUsername, import.meta.env.VITE_TURN_USERNAME),
  turnCredential: pick(runtime.turnCredential, import.meta.env.VITE_TURN_CREDENTIAL),
  chunkSizeBytes: (Number(pick(runtime.chunkSizeKb, import.meta.env.VITE_CHUNK_SIZE)) || 16) * 1024,
};
