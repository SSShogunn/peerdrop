import { motion } from "motion/react";
import { WifiOff } from "lucide-react";

export default function Interrupted() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <motion.span
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      >
        <WifiOff className="h-6 w-6 text-amber-600 dark:text-amber-400" />
      </motion.span>
      <p className="text-sm font-medium">Connection dropped</p>
      <p className="text-xs text-muted-foreground">Trying to reconnect…</p>
    </div>
  );
}
