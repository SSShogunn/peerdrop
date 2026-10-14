import { ArrowDown, ArrowUp, Gauge, Loader2 } from "lucide-react";
import { usePeer } from "@/context/usePeer";
import { Button } from "@/components/ui/button";
import { formatSpeed } from "@/lib/file";

function Readout({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-background px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="data text-sm font-medium">{value}</span>
    </div>
  );
}

export default function SpeedTest() {
  const { speedTestRunning, speedTestResult, runSpeedTest, sendFileName, recvFileName } = usePeer();
  const disabled = speedTestRunning || !!sendFileName || !!recvFileName;

  const up = speedTestResult?.upBytesPerSec != null ? formatSpeed(speedTestResult.upBytesPerSec) : "—";
  const down = speedTestResult?.downBytesPerSec != null ? formatSpeed(speedTestResult.downBytesPerSec) : "—";

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <Readout label="Upload" value={speedTestRunning ? "…" : up} icon={<ArrowUp className="size-3.5 text-signal" />} />
        <Readout label="Download" value={speedTestRunning ? "…" : down} icon={<ArrowDown className="size-3.5 text-signal" />} />
      </div>
      <Button variant="outline" className="h-11 w-full gap-2" onClick={runSpeedTest} disabled={disabled}>
        {speedTestRunning ? <Loader2 className="size-4 animate-spin" /> : <Gauge className="size-4" />}
        {speedTestRunning ? "Measuring…" : "Run speed test"}
      </Button>
    </div>
  );
}
