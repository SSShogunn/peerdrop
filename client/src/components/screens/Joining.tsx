import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Panel";
import { usePeer } from "@/context/usePeer";

export default function Joining() {
  const { status, reset } = usePeer();

  const copy = status === "connecting" ? "Joining room…" : "Waiting for the sender to start…";

  return (
    <Panel>
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="size-5 animate-spin text-signal" />
        <p className="text-sm text-muted-foreground">{copy}</p>
        <Button variant="ghost" className="h-11 px-4" onClick={reset}>
          Cancel
        </Button>
      </div>
    </Panel>
  );
}
