import { motion } from "motion/react";
import { AlertTriangle, FolderOpen, HardDrive } from "lucide-react";
import { usePeer } from "../context/usePeer";

export default function ReceiverPanel() {
  const { canStreamToDisk, saveFolder, chooseSaveFolder, transferError } = usePeer();

  return (
    <div className="flex flex-col gap-3">
      {canStreamToDisk ? (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <HardDrive className="h-4 w-4 shrink-0" />
            {saveFolder ? (
              <span>
                Saving to{" "}
                <span className="font-semibold text-white">{saveFolder}</span>
              </span>
            ) : (
              <span>Files are held in memory until the transfer finishes.</span>
            )}
          </div>
          <motion.button
            onClick={chooseSaveFolder}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            whileTap={{ scale: 0.97 }}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white"
          >
            <FolderOpen className="h-4 w-4" />
            {saveFolder ? "Change save folder" : "Choose save folder (recommended for large files)"}
          </motion.button>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-300/90">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This browser can't stream files to disk, so incoming files are held
            in memory. Very large files (multi-GB) may be slow or fail here — a
            Chromium-based browser handles them better.
          </span>
        </div>
      )}

      {transferError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{transferError}</span>
        </div>
      )}
    </div>
  );
}
