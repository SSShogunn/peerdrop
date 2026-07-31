const PUBLIC_APP_URL = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;

export function getInviteUrl(roomCode: string) {
  const base = PUBLIC_APP_URL
    ? PUBLIC_APP_URL.replace(/\/$/, "")
    : `${window.location.origin}${window.location.pathname}`;
  return `${base}?room=${roomCode}`;
}
