import { useState, useRef, type DragEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { usePeer } from "../context/usePeer";
import { formatBytes, getFileIcon } from "../lib/file";

export default function FileDropzone() {
  const { queueFiles, queue, cancelTransfer } = usePeer();
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
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        animate={{
          borderColor: isDragging
            ? "rgba(255,255,255,0.9)"
            : "rgba(255,255,255,0.2)",
          backgroundColor: isDragging
            ? "rgba(255,255,255,0.1)"
            : "rgba(255,255,255,0)",
          scale: isDragging ? 1.015 : 1,
        }}
        whileHover={!isDragging ? { borderColor: "rgba(255,255,255,0.4)" } : undefined}
        transition={{ duration: 0.18 }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-8 py-12 text-center"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <motion.div
          animate={{ y: isDragging ? -2 : 0 }}
          className="text-neutral-400"
        >
          <p>Drop files here</p>
          <p>or click to select</p>
        </motion.div>
      </motion.div>

      {queue.length > 0 && (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {queue.map((item) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5"
              >
                <span className="text-lg">
                  {getFileIcon(item.fileName, item.fileType)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-white">
                    {item.fileName}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {formatBytes(item.fileSize)}
                  </span>
                </div>
                <motion.span
                  key={item.status}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.15 }}
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.status === "done"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : item.status === "sending"
                        ? "bg-white/15 text-white"
                        : item.status === "error"
                          ? "bg-red-500/15 text-red-400"
                          : item.status === "cancelled"
                            ? "bg-neutral-500/15 text-neutral-400"
                            : "bg-white/5 text-neutral-400"
                  }`}
                >
                  {item.status}
                </motion.span>
                {(item.status === "queued" || item.status === "sending") && (
                  <motion.button
                    onClick={() => cancelTransfer(item.id)}
                    whileHover={{ backgroundColor: "rgba(239,68,68,0.15)" }}
                    whileTap={{ scale: 0.9 }}
                    aria-label={`Cancel ${item.fileName}`}
                    className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-400 hover:text-red-300"
                  >
                    <X className="h-4 w-4" />
                  </motion.button>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
