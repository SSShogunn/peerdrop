import { Cable, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePeer } from "@/context/usePeer";
import FileDropzone from "@/components/FileDropzone";
import TransferProgress from "@/components/TransferProgress";
import ReceiverPanel from "@/components/ReceiverPanel";
import IncomingRequestSheet from "@/components/IncomingRequestSheet";
import TextShare from "@/components/TextShare";

export default function Room() {
  const { sendFileName, recvFileName, transferError, connectionType } = usePeer();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Connected
        </Badge>
        {connectionType && (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            {connectionType === "direct" ? (
              <>
                <Cable className="h-3 w-3" /> Direct
              </>
            ) : (
              <>
                <Wifi className="h-3 w-3" /> Relayed
              </>
            )}
          </Badge>
        )}
      </div>

      {transferError && <p className="text-xs text-destructive">{transferError}</p>}

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
