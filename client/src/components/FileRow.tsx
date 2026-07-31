import type { ReactNode } from "react";
import { motion } from "motion/react";
import { formatBytes, getFileIcon } from "@/lib/file";

interface FileRowProps {
  fileName: string;
  fileSize: number;
  fileType: string;
  previewDataUrl?: string;
  trailing?: ReactNode;
}

export function FileRow({ fileName, fileSize, fileType, previewDataUrl, trailing }: FileRowProps) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 bg-card px-4 py-2.5 ring-1 ring-foreground/10"
    >
      {previewDataUrl ? (
        <img src={previewDataUrl} alt="" className="h-8 w-8 shrink-0 object-cover" />
      ) : (
        <span className="shrink-0 text-lg">{getFileIcon(fileName, fileType)}</span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium" title={fileName}>
          {fileName}
        </span>
        <span className="text-xs text-muted-foreground">{formatBytes(fileSize)}</span>
      </div>
      {trailing}
    </motion.li>
  );
}
