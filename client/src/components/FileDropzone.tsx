import { useState, useRef, type DragEvent } from "react";
import { AnimatePresence } from "motion/react";
import { AlertTriangle, X } from "lucide-react";
import { UploadSimple } from "@phosphor-icons/react";
import { usePeer } from "@/context/usePeer";
import { FileRow } from "@/components/FileRow";
import { Notice, Panel } from "@/components/Panel";
import { cn } from "@/lib/utils";

const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024;

const STATUS_LABEL: Record<string, string> = {
  pending: "awaiting approval",
};

const STATUS_TONE: Record<string, string> = {
  done: "text-signal",
  sending: "text-signal",
  error: "text-destructive",
};

export default function FileDropzone() {
  const { queueFiles, queue, cancelTransfer } = usePeer();
  const hasLargeFile = queue.some(
    (item) =>
      item.fileSize > LARGE_FILE_THRESHOLD &&
      (item.status === "pending" || item.status === "queued" || item.status === "sending"),
  );
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    queueFiles(files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    queueFiles(files);
    e.target.value = "";
  };

  return (
    <Panel title="Send files" meta={queue.length > 0 ? `${queue.length} in queue` : undefined}>
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex min-h-40 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed px-6 py-8 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
            isDragging
              ? "border-signal bg-signal-soft"
              : "border-input bg-background hover:border-signal/60 hover:bg-muted/50",
          )}
        >
          <input ref={inputRef} type="file" multiple className="hidden" onChange={handleInputChange} />
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-md transition-colors",
              isDragging ? "bg-signal text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            <UploadSimple className="size-5" weight="bold" />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{isDragging ? "Release to queue" : "Drop files or tap to choose"}</span>
            <span className="text-xs text-muted-foreground">Any type, any size. You can also paste an image into the message box.</span>
          </span>
        </button>

        {hasLargeFile && (
          <Notice icon={<AlertTriangle />}>
            Large file queued. If the receiver's browser can't stream to disk (Safari, Firefox, most mobile), it's held
            in memory and may be slow or fail on their end.
          </Notice>
        )}

        {queue.length > 0 && (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {queue.map((item) => (
                <FileRow
                  key={item.id}
                  fileName={item.fileName}
                  fileSize={item.fileSize}
                  fileType={item.fileType}
                  trailing={
                    <div className="flex shrink-0 items-center gap-1">
                      <span className={cn("data text-xs", STATUS_TONE[item.status] ?? "text-muted-foreground")}>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                      {(item.status === "pending" || item.status === "queued" || item.status === "sending") && (
                        <button
                          onClick={() => cancelTransfer(item.id)}
                          aria-label={`Cancel ${item.fileName}`}
                          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                    </div>
                  }
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </Panel>
  );
}
