import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { CheckCircle2, UserMinus, X } from "lucide-react";
import { ArrowRight, Infinity as InfinityIcon, LockKey, Plus, Prohibit } from "@phosphor-icons/react";
import { Notice, Panel } from "@/components/Panel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePeer } from "@/context/usePeer";
import { formatBytes, formatDuration } from "@/lib/file";
import type { Intent } from "@/App";

function summaryLine({
  filesSent,
  bytesSent,
  filesReceived,
  bytesReceived,
  textMessages,
  durationMs,
}: {
  filesSent: number;
  bytesSent: number;
  filesReceived: number;
  bytesReceived: number;
  textMessages: number;
  durationMs: number;
}): string {
  const parts: string[] = [];
  if (filesSent > 0) parts.push(`${filesSent} sent (${formatBytes(bytesSent)})`);
  if (filesReceived > 0) parts.push(`${filesReceived} received (${formatBytes(bytesReceived)})`);
  if (textMessages > 0) parts.push(`${textMessages} message${textMessages === 1 ? "" : "s"}`);
  parts.push(formatDuration(durationMs));
  return parts.join(" · ");
}

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
  const {
    createRoom,
    joinRoom,
    disconnectReason,
    dismissDisconnectReason,
    lastSessionSummary,
    dismissSessionSummary,
  } = usePeer();
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
    <div className="flex flex-col gap-6">
      {lastSessionSummary && (
        <Notice
          tone="ok"
          icon={<CheckCircle2 />}
          action={
            <button
              onClick={dismissSessionSummary}
              aria-label="Dismiss"
              className="-m-2 flex size-11 shrink-0 cursor-pointer items-center justify-center opacity-70 hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          }
        >
          <span className="data text-xs">{summaryLine(lastSessionSummary)}</span>
        </Notice>
      )}

      {disconnectReason === "peer_left" && (
        <Notice
          icon={<UserMinus />}
          action={
            <button
              onClick={dismissDisconnectReason}
              aria-label="Dismiss"
              className="-m-2 flex size-11 shrink-0 cursor-pointer items-center justify-center opacity-70 hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          }
        >
          Your peer disconnected.
        </Notice>
      )}

      <div className="flex flex-col gap-2">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Send anything, straight to the other device.
        </h1>
        <p className="text-pretty text-muted-foreground">
          Open a room, share the code, drop files. Nothing is uploaded or stored on a server.
        </p>
      </div>

      <Panel title="Send">
        <Button size="lg" className="h-12 w-full gap-2 text-base" onClick={handleCreate}>
          <Plus className="size-5" weight="bold" /> Create a room
        </Button>
      </Panel>

      <Panel title="Receive" meta="4-character code">
        <motion.div
          animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col gap-3"
        >
          <label className="group relative block">
            <span className="sr-only">Room code</span>
            <div className="grid grid-cols-4 gap-2" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "data flex h-16 items-center justify-center rounded-md border border-input bg-background text-3xl font-semibold transition-colors",
                    "group-focus-within:border-ring",
                    code.length === i && "group-focus-within:ring-2 group-focus-within:ring-ring/40",
                  )}
                >
                  {code[i] ?? <span className="text-muted-foreground/40">·</span>}
                </div>
              ))}
            </div>
            <Input
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={code}
              maxLength={4}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              className="absolute inset-0 h-full cursor-text border-0 bg-transparent! text-transparent caret-transparent opacity-0 focus-visible:ring-0"
            />
          </label>
          <Button
            variant="outline"
            size="lg"
            className="h-11 w-full gap-2"
            disabled={code.length !== 4}
            onClick={() => handleJoin()}
          >
            Join room <ArrowRight className="size-4" />
          </Button>
        </motion.div>
      </Panel>

      <ul className="data flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5"><LockKey className="size-3.5" /> Encrypted peer-to-peer</li>
        <li className="flex items-center gap-1.5"><Prohibit className="size-3.5" /> No accounts</li>
        <li className="flex items-center gap-1.5"><InfinityIcon className="size-3.5" /> Nothing stored</li>
      </ul>
    </div>
  );
}
