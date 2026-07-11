import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePeer } from "@/context/usePeer";
import type { Intent } from "@/App";

function extractCode(raw: string): string {
  const fromUrl = raw.match(/[?&]room=([A-Za-z0-9]{4})/);
  const source = fromUrl ? fromUrl[1] : raw;
  return source
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

interface HomeProps {
  onIntent: (intent: Intent) => void;
}

export default function Home({ onIntent }: HomeProps) {
  const { createRoom, joinRoom, disconnectReason, dismissDisconnectReason } = usePeer();
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(0);

  const handleCreate = () => {
    onIntent("create");
    createRoom();
  };

  const handleJoin = (value?: string) => {
    const finalCode = value ?? code;
    if (finalCode.length !== 4) {
      setShake((n) => n + 1);
      return;
    }
    onIntent("join");
    joinRoom(finalCode);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = extractCode(e.target.value);
    setCode(next);
    if (next.length === 4) handleJoin(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleJoin();
  };

  return (
    <div className="flex flex-col gap-8">
      {disconnectReason === "peer_left" && (
        <div className="flex items-center gap-2 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
          <UserMinus className="h-4 w-4 shrink-0" />
          <span className="flex-1">Your peer disconnected.</span>
          <button
            onClick={dismissDisconnectReason}
            aria-label="Dismiss"
            className="shrink-0 cursor-pointer text-amber-600/70 hover:text-amber-600 dark:text-amber-400/70 dark:hover:text-amber-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Send files, peer to peer
        </h1>
        <p className="text-sm text-muted-foreground">
          No uploads, no accounts — files move directly between browsers.
        </p>
      </div>

      <Button size="lg" className="h-14 w-full text-base" onClick={handleCreate}>
        Create a room
      </Button>

      <div className="flex items-center gap-3 text-xs tracking-wider text-muted-foreground uppercase">
        <div className="h-px flex-1 bg-border" />
        or join
        <div className="h-px flex-1 bg-border" />
      </div>

      <motion.div
        animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-3"
      >
        <Input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="Enter room code"
          value={code}
          maxLength={4}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="h-14 text-center text-2xl font-semibold tracking-[0.4em] placeholder:text-sm placeholder:font-normal placeholder:tracking-normal"
        />
        <Button variant="outline" size="lg" className="h-12 w-full" onClick={() => handleJoin()}>
          Join room
        </Button>
      </motion.div>
    </div>
  );
}
