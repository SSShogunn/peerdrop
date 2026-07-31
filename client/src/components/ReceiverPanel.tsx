import { AnimatePresence } from "motion/react";
import { AlertTriangle, Check, FolderOpen, HardDrive } from "lucide-react";
import { usePeer } from "@/context/usePeer";
import { Button } from "@/components/ui/button";
import { FileRow } from "@/components/FileRow";

export default function ReceiverPanel() {
  const { canStreamToDisk, saveFolder, chooseSaveFolder, receivedFiles } = usePeer();

  return (
    <div className="flex flex-col gap-3">
      {canStreamToDisk ? (
        <div className="flex flex-col gap-2 bg-card p-3 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HardDrive className="h-4 w-4 shrink-0" />
            {saveFolder ? (
              <span className="min-w-0 truncate" title={saveFolder}>
                Saving to{" "}
                <span className="font-semibold text-foreground">{saveFolder}</span>
              </span>
            ) : (
              <span>Files are held in memory until the transfer finishes.</span>
            )}
          </div>
          <Button variant="outline" className="w-full" onClick={chooseSaveFolder}>
            <FolderOpen className="h-4 w-4" />
            {saveFolder ? "Change save folder" : "Choose save folder (recommended for large files)"}
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-2 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This browser can't stream files to disk, so incoming files are held
            in memory. Very large files (multi-GB) may be slow or fail here — a
            Chromium-based browser handles them better.
          </span>
        </div>
      )}

      {receivedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Received ({receivedFiles.length})
          </p>
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {receivedFiles.map((file) => (
                <FileRow
                  key={file.id}
                  fileName={file.fileName}
                  fileSize={file.fileSize}
                  fileType={file.fileType}
                  trailing={
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  }
                />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </div>
  );
}
