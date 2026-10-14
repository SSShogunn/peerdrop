import { useState } from "react";
import { motion } from "motion/react";
import { Check, Copy, Loader2 } from "lucide-react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LiveDot, Panel } from "@/components/Panel";
import { usePeer } from "@/context/usePeer";
import { getInviteUrl } from "@/lib/inviteUrl";

function CopyLinkButton({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getInviteUrl(roomCode));
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  return (
    <Button variant="outline" size="lg" className="h-11 w-full gap-2" onClick={handleCopy}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied" : "Copy invite link"}
    </Button>
  );
}

export default function Hosting() {
  const { status, roomCode, reset } = usePeer();

  if (!roomCode) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="size-5 animate-spin text-signal" />
          <p className="text-sm text-muted-foreground">Opening a room…</p>
          <Button variant="ghost" className="h-11 px-4" onClick={reset}>
            Cancel
          </Button>
        </div>
      </Panel>
    );
  }

  const inviteUrl = getInviteUrl(roomCode);
  const joined = status === "peer_joined";

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Room ready"
        meta={
          <>
            <LiveDot />
            {joined ? "peer joined" : "listening"}
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-4 gap-2" aria-label={`Room code ${roomCode.split("").join(" ")}`}>
            {roomCode.split("").map((ch, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="data flex h-20 items-center justify-center rounded-md border border-border bg-background text-4xl font-semibold sm:h-24 sm:text-5xl"
              >
                {ch}
              </motion.div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Enter this code on the other device, or scan the QR code.
          </p>
          <CopyLinkButton roomCode={roomCode} />
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center gap-4">
          <div className="shrink-0 rounded-md bg-white p-2.5 ring-1 ring-border">
            <QRCode value={inviteUrl} size={112} />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm font-medium">
              {joined ? "Establishing connection…" : "Waiting for them to join"}
            </p>
            <p className="data truncate text-xs text-muted-foreground">{inviteUrl.replace(/^https?:\/\//, "")}</p>
          </div>
        </div>
      </Panel>

      <Button variant="ghost" className="h-11" onClick={reset}>
        Cancel
      </Button>
    </div>
  );
}
