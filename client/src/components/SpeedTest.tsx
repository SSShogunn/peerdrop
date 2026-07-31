import { ArrowDown, ArrowUp, Gauge, Loader2 } from "lucide-react";
import { usePeer } from "@/context/usePeer";
import { Button } from "@/components/ui/button";
import { formatSpeed } from "@/lib/file";

export default function SpeedTest() {
  const { speedTestRunning, speedTestResult, runSpeedTest, sendFileName, recvFileName } = usePeer();
  const disabled = speedTestRunning || !!sendFileName || !!recvFileName;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-card px-3 py-2 text-xs ring-1 ring-foreground/10">
      <div className="flex min-w-0 flex-1 items-center gap-3 text-muted-foreground">
        {speedTestRunning ? (
          <span>Measuring throughput…</span>
        ) : speedTestResult ? (
          <>
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {speedTestResult.upBytesPerSec != null ? formatSpeed(speedTestResult.upBytesPerSec) : "…"}
            </span>
            <span className="flex items-center gap-1">
              <ArrowDown className="h-3 w-3 shrink-0 text-sky-600 dark:text-sky-400" />
              {speedTestResult.downBytesPerSec != null ? formatSpeed(speedTestResult.downBytesPerSec) : "…"}
            </span>
          </>
        ) : (
          <span>Measure throughput between devices</span>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={runSpeedTest} disabled={disabled} className="shrink-0">
        {speedTestRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Gauge className="h-3.5 w-3.5" />
        )}
        Speed test
      </Button>
    </div>
  );
}
