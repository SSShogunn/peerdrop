import { config } from "./config";

export function getInviteUrl(roomCode: string) {
  const base = config.publicAppUrl
    ? config.publicAppUrl.replace(/\/$/, "")
    : `${window.location.origin}${window.location.pathname}`;
  return `${base}?room=${roomCode}`;
}
