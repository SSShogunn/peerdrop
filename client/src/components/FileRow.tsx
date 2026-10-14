import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  File as FileGeneric,
  FilePdf,
  FileText,
  FileVideo,
} from "@phosphor-icons/react";
import { formatBytes } from "@/lib/file";

interface FileRowProps {
  fileName: string;
  fileSize: number;
  fileType: string;
  previewDataUrl?: string;
  trailing?: ReactNode;
}

const ARCHIVE = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz"]);
const CODE = new Set(["js", "ts", "tsx", "jsx", "py", "go", "rs", "c", "cpp", "java", "json", "html", "css", "sh", "yml", "yaml", "toml"]);
const TEXT = new Set(["txt", "md", "csv", "log", "doc", "docx", "rtf"]);

function KindIcon({ fileName, fileType }: { fileName: string; fileType: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const cls = "size-5";
  if (fileType.startsWith("image/")) return <FileImage className={cls} />;
  if (fileType.startsWith("video/")) return <FileVideo className={cls} />;
  if (fileType.startsWith("audio/")) return <FileAudio className={cls} />;
  if (fileType === "application/pdf" || ext === "pdf") return <FilePdf className={cls} />;
  if (ARCHIVE.has(ext)) return <FileArchive className={cls} />;
  if (CODE.has(ext)) return <FileCode className={cls} />;
  if (TEXT.has(ext) || fileType.startsWith("text/")) return <FileText className={cls} />;
  return <FileGeneric className={cls} />;
}

export function FileRow({ fileName, fileSize, fileType, previewDataUrl, trailing }: FileRowProps) {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1, dot + 6) : "";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex min-h-14 items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
    >
      {previewDataUrl ? (
        <img src={previewDataUrl} alt="" className="size-10 shrink-0 rounded-sm object-cover" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
          <KindIcon fileName={fileName} fileType={fileType} />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium" title={fileName}>
          {fileName}
        </span>
        <span className="data text-xs text-muted-foreground">
          {formatBytes(fileSize)}
          {ext && <span className="uppercase"> · {ext}</span>}
        </span>
      </div>
      {trailing}
    </motion.li>
  );
}
