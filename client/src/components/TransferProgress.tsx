import { AnimatePresence, motion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { usePeer } from "../context/usePeer";
import { formatSpeed } from "../lib/file";

export default function TransferProgress() {
  const {
    progress,
    role,
    speed,
    currentFileName,
    isPaused,
    pauseTransfer,
    resumeTransfer,
  } = usePeer();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex w-full flex-col gap-3"
    >
      <p className="text-center text-sm font-medium text-white">
        {role === "offerer" ? "Sending" : "Receiving"}
        {currentFileName ? ` — ${currentFileName}` : "..."}
      </p>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-white"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-400">
        <span>{progress}%</span>
        <span>{formatSpeed(speed)}</span>
      </div>

      {role === "offerer" && (
        <motion.button
          onClick={isPaused ? resumeTransfer : pauseTransfer}
          whileHover={{ backgroundColor: "rgba(255,255,255,0.1)" }}
          whileTap={{ scale: 0.97 }}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
        >
          <AnimatePresence mode="wait" initial={false}>
            {isPaused ? (
              <motion.span
                key="resume"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" /> Resume
              </motion.span>
            ) : (
              <motion.span
                key="pause"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2"
              >
                <Pause className="h-4 w-4" /> Pause
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      )}
    </motion.div>
  );
}
