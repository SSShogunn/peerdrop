import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePeer } from "@/context/usePeer";

function Spinner() {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      className="flex"
    >
      <Loader2 className="h-5 w-5" strokeWidth={2} />
    </motion.span>
  );
}

export default function Joining() {
  const { status, reset } = usePeer();

  const copy =
    status === "connecting" ? "Joining room…" : "Waiting for the sender to start…";

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Spinner />
      <p className="text-sm text-muted-foreground">{copy}</p>
      <Button variant="ghost" onClick={reset}>
        Cancel
      </Button>
    </div>
  );
}
