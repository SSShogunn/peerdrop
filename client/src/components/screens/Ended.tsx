import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Panel";
import { usePeer } from "@/context/usePeer";

function errorCopy(reason: string | null): string {
  switch (reason) {
    case "room_not_found":
      return "That code doesn't exist — check it and try again.";
    case "room_full":
      return "That room already has two people in it.";
    case "room_expired":
      return "That room expired before anyone joined. Create a new one.";
    case "server_busy":
      return "The server is at capacity right now. Please try again in a bit.";
    case "rate_limited":
      return "Too many attempts. Wait a moment and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function Ended() {
  const { errorReason, reset } = usePeer();

  return (
    <Panel>
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-md bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </span>
        <p className="max-w-xs text-pretty">{errorCopy(errorReason)}</p>
        <Button size="lg" className="h-11 w-full" onClick={reset}>
          Start over
        </Button>
      </div>
    </Panel>
  );
}
