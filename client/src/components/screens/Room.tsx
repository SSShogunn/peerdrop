import { Cable, LogOut, Wifi, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveDot, Notice, Panel } from "@/components/Panel";
import { usePeer } from "@/context/usePeer";
import FileDropzone from "@/components/FileDropzone";
import TransferProgress from "@/components/TransferProgress";
import ReceiverPanel, { StorageStatus } from "@/components/ReceiverPanel";
import IncomingRequestSheet from "@/components/IncomingRequestSheet";
import TextShare from "@/components/TextShare";
import SpeedTest from "@/components/SpeedTest";

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
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

export default function Room() {
  const { sendFileName, recvFileName, transferError, connectionType, pingMs, reset } = usePeer();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <LiveDot />
          <h1 className="text-lg font-semibold tracking-tight">Connected to peer</h1>
        </div>
        <Button variant="outline" className="h-10 gap-2 px-3" onClick={reset} aria-label="Leave room">
          <LogOut className="size-4" /> Leave
        </Button>
      </div>

      {transferError && (
        <Notice tone="danger" icon={<Zap />}>
          {transferError}
        </Notice>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <FileDropzone />
          {sendFileName && <TransferProgress direction="send" />}
          {recvFileName && <TransferProgress direction="recv" />}
          <ReceiverPanel />
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <TextShare />
          <Panel title="Link">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Route"
                  value={connectionType === "direct" ? "Direct" : connectionType ? "Relayed" : "—"}
                  icon={connectionType === "relay" ? <Wifi className="size-3.5" /> : <Cable className="size-3.5" />}
                />
                <Stat label="Latency" value={pingMs !== null ? `${pingMs} ms` : "—"} icon={<Zap className="size-3.5" />} />
              </div>
              <SpeedTest />
            </div>
          </Panel>
          <Panel title="Receiving">
            <StorageStatus />
          </Panel>
        </aside>
      </div>

      <IncomingRequestSheet />
    </div>
  );
}
