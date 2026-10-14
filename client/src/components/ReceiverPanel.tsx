import { AnimatePresence } from "motion/react";
import { AlertTriangle, Check, FolderOpen, HardDrive } from "lucide-react";
import { usePeer } from "@/context/usePeer";
import { Button } from "@/components/ui/button";
import { FileRow } from "@/components/FileRow";
import { Notice, Panel } from "@/components/Panel";

export function StorageStatus() {
  const { canStreamToDisk, saveFolder, chooseSaveFolder } = usePeer();

  if (!canStreamToDisk) {
    return (
      <Notice icon={<AlertTriangle />}>
        This browser can't stream files to disk, so incoming files are held in memory. Multi-GB files may be slow or
        fail here. A Chromium-based browser handles them better.
      </Notice>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5 text-sm">
        <HardDrive className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        {saveFolder ? (
          <span className="min-w-0 text-muted-foreground">
            Saving to{" "}
            <span className="data break-all text-xs text-foreground" title={saveFolder}>
              {saveFolder}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">Held in memory until each transfer finishes.</span>
        )}
      </div>
      <Button variant="outline" className="h-11 w-full gap-2" onClick={chooseSaveFolder}>
        <FolderOpen className="size-4" />
        {saveFolder ? "Change save folder" : "Choose save folder"}
      </Button>
    </div>
  );
}

export default function ReceiverPanel() {
  const { receivedFiles } = usePeer();

  if (receivedFiles.length === 0) return null;

  return (
    <Panel title="Received" meta={`${receivedFiles.length}`}>
      <ul className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {receivedFiles.map((file) => (
            <FileRow
              key={file.id}
              fileName={file.fileName}
              fileSize={file.fileSize}
              fileType={file.fileType}
              trailing={
                <span className="flex size-8 shrink-0 items-center justify-center text-signal">
                  <Check className="size-4" />
                </span>
              }
            />
          ))}
        </AnimatePresence>
      </ul>
    </Panel>
  );
}
