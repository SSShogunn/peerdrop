import { Cable, LogOut, Wifi, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePeer } from "@/context/usePeer";
import FileDropzone from "@/components/FileDropzone";
import TransferProgress from "@/components/TransferProgress";
import ReceiverPanel from "@/components/ReceiverPanel";
import IncomingRequestSheet from "@/components/IncomingRequestSheet";
import TextShare from "@/components/TextShare";
import SpeedTest from "@/components/SpeedTest";

export default function Room() {
  const { sendFileName, recvFileName, transferError, connectionType, pingMs, reset } = usePeer();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
            Connected
          </Badge>
          {connectionType && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              {connectionType === "direct" ? (
                <>
                  <Cable className="h-3 w-3 shrink-0" /> Direct
                </>
              ) : (
                <>
                  <Wifi className="h-3 w-3 shrink-0" /> Relayed
                </>
              )}
            </Badge>
          )}
          {pingMs !== null && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <Zap className="h-3 w-3 shrink-0" /> {pingMs} ms
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={reset} aria-label="Leave room" className="shrink-0">
          <LogOut className="h-4 w-4" /> Leave
        </Button>
      </div>

      {transferError && (
        <p className="text-xs break-words text-destructive">{transferError}</p>
      )}

      <SpeedTest />

      <TextShare />

      <div className="h-px bg-border" />

      <FileDropzone />

      {sendFileName && <TransferProgress direction="send" />}
      {recvFileName && <TransferProgress direction="recv" />}

      <ReceiverPanel />

      <IncomingRequestSheet />
    </div>
  );
}
