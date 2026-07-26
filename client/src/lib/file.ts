export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return "0 KB/s";
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

const CODE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "py", "go", "rs", "java", "c", "cpp", "cs",
  "rb", "php", "sh", "html", "css", "json", "yml", "yaml", "sql",
]);

const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2"]);

export function getFileIcon(fileName: string, mimeType: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎞️";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType === "application/pdf" || ext === "pdf") return "📕";
  if (ARCHIVE_EXTENSIONS.has(ext)) return "🗜️";
  if (CODE_EXTENSIONS.has(ext)) return "💻";
  if (mimeType.startsWith("text/") || ext === "txt" || ext === "md") return "📄";

  return "📦";
}
