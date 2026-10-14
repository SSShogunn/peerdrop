import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LiveDot } from "@/components/Panel";
import { usePeer } from "@/context/usePeer";
import type { ConnectionStatus } from "@/types";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: "Ready",
  connecting: "Connecting",
  waiting_for_peer: "Waiting for peer",
  peer_joined: "Handshaking",
  p2p_connected: "Connected",
  reconnecting: "Reconnecting",
  error: "Offline",
};

export function AppHeader() {
  const { status, roomCode } = usePeer();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-2">
          <div className="data flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs">
            <LiveDot active={status === "p2p_connected"} />
            <span>{STATUS_LABEL[status]}</span>
            {roomCode && <span className="text-muted-foreground">{roomCode}</span>}
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
