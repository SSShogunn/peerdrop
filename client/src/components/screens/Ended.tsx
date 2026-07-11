import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <p className="text-sm text-destructive">{errorCopy(errorReason)}</p>
      <Button size="lg" className="w-full" onClick={reset}>
        Start over
      </Button>
    </div>
  );
}
