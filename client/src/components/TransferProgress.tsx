import { Pause, Play, X } from "lucide-react";
import { usePeer } from "@/context/usePeer";
import { formatSpeed } from "@/lib/file";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface TransferProgressProps {
  direction: "send" | "recv";
}

export default function TransferProgress({ direction }: TransferProgressProps) {
  const {
    sendProgress,
    sendSpeed,
    sendFileName,
    recvProgress,
    recvSpeed,
    recvFileName,
    isPaused,
    queue,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
  } = usePeer();

  const isSend = direction === "send";
  const progress = isSend ? sendProgress : recvProgress;
  const speed = isSend ? sendSpeed : recvSpeed;
  const fileName = isSend ? sendFileName : recvFileName;
  const sendingId = queue.find((item) => item.status === "sending")?.id;

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-center text-sm font-medium">
        {isSend ? "Sending" : "Receiving"}
        {fileName ? ` — ${fileName}` : "…"}
      </p>

      <Progress value={progress} />

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{progress}%</span>
        <span>{formatSpeed(speed)}</span>
      </div>

      {isSend && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={isPaused ? resumeTransfer : pauseTransfer}
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" /> Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" /> Pause
              </>
            )}
          </Button>
          <Button
            variant="destructive"
            disabled={!sendingId}
            onClick={() => sendingId && cancelTransfer(sendingId)}
          >
            <X className="h-4 w-4" /> Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
