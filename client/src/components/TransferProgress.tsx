import { Pause, Play, X } from "lucide-react";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { usePeer } from "@/context/usePeer";
import { formatSpeed } from "@/lib/file";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Panel";

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
  const Arrow = isSend ? ArrowUp : ArrowDown;

  return (
    <Panel
      title={isSend ? "Sending" : "Receiving"}
      meta={
        <>
          <Arrow className="size-3.5 text-signal" weight="bold" />
          {isPaused && isSend ? "paused" : formatSpeed(speed)}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-medium" title={fileName ?? undefined}>
            {fileName ?? "…"}
          </p>
          <p className="data shrink-0 text-2xl font-semibold">
            {progress}
            <span className="text-sm text-muted-foreground">%</span>
          </p>
        </div>

        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label={`${isSend ? "Sending" : "Receiving"} ${fileName ?? "file"}`}
          className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-signal transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
          {!isPaused && progress < 100 && (
            <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-white/30 to-transparent [animation:pd-scan_1.6s_linear_infinite]" />
          )}
        </div>

        {isSend && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-11 gap-2"
              onClick={isPaused ? resumeTransfer : pauseTransfer}
            >
              {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {isPaused ? "Resume" : "Pause"}
            </Button>
            <Button
              variant="destructive"
              className="h-11 gap-2"
              disabled={!sendingId}
              onClick={() => sendingId && cancelTransfer(sendingId)}
            >
              <X className="size-4" /> Cancel
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}
