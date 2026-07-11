import { useState, useRef, type DragEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, X } from "lucide-react";
import { usePeer } from "@/context/usePeer";
import { formatBytes, getFileIcon } from "@/lib/file";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  done: "default",
  sending: "secondary",
  error: "destructive",
  cancelled: "outline",
  queued: "outline",
  pending: "outline",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "awaiting approval",
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

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
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
    <div className="flex w-full flex-col gap-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 border-2 border-dashed px-8 py-12 text-center transition-colors",
          isDragging ? "border-foreground bg-muted" : "border-border hover:border-foreground/40",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <p className="text-sm text-muted-foreground">Drop files here</p>
        <p className="text-xs text-muted-foreground">or click to select</p>
      </div>

      {hasLargeFile && (
        <div className="flex items-start gap-2 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Large file queued. If the receiver's browser can't stream to disk
            (Safari, Firefox, most mobile), it's held in memory and may be slow
            or fail on their end.
          </span>
        </div>
      )}

      {queue.length > 0 && (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {queue.map((item) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 bg-card px-4 py-2.5 ring-1 ring-foreground/10"
              >
                <span className="text-lg">
                  {getFileIcon(item.fileName, item.fileType)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {item.fileName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(item.fileSize)}
                  </span>
                </div>
                <Badge variant={STATUS_VARIANT[item.status] ?? "outline"}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </Badge>
                {(item.status === "pending" || item.status === "queued" || item.status === "sending") && (
                  <button
                    onClick={() => cancelTransfer(item.id)}
                    aria-label={`Cancel ${item.fileName}`}
                    className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
