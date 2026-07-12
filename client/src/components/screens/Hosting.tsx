import { useState } from "react";
import { motion } from "motion/react";
import { Check, Copy, Loader2 } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { usePeer } from "@/context/usePeer";

function Spinner() {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      className="flex"
    >
      <Loader2 className="h-4 w-4" strokeWidth={2} />
    </motion.span>
  );
}

function CopyLinkButton({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const link = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button variant="outline" size="lg" className="w-full" onClick={handleCopy}>
      {copied ? (
        <>
          <Check className="h-4 w-4" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" /> Copy invite link
        </>
      )}
    </Button>
  );
}

export default function Hosting() {
  const { status, roomCode, reset } = usePeer();

  if (!roomCode) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Spinner />
        <p className="text-sm text-muted-foreground">Creating room…</p>
        <Button variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    );
  }

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Share this code with the receiver
      </p>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="bg-card py-6 text-center font-heading text-5xl font-bold tracking-[0.5rem] ring-1 ring-foreground/10"
      >
        {roomCode}
      </motion.div>

      <CopyLinkButton roomCode={roomCode} />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="flex justify-center bg-white p-4 ring-1 ring-foreground/10"
      >
        <QRCode value={inviteUrl} size={160} />
      </motion.div>
      <p className="text-center text-xs text-muted-foreground">
        Scan to open this room on another device
      </p>

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        {status === "peer_joined"
          ? "Peer joined. Establishing connection…"
          : "Waiting for them to join…"}
      </div>

      <Button variant="ghost" onClick={reset}>
        Cancel
      </Button>
    </div>
  );
}
