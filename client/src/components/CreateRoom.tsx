import { motion } from "motion/react";
import { usePeer } from "../context/usePeer";

export default function CreateRoom() {
  const { createRoom } = usePeer();

  return (
    <motion.div
      whileHover={{ borderColor: "rgba(255,255,255,0.2)", y: -2 }}
      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
    >
      <h2 className="text-lg font-semibold text-white">Send a file</h2>
      <p className="text-sm text-neutral-400">
        Create a room and share the code with the receiver.
      </p>
      <motion.button
        onClick={createRoom}
        whileHover={{ backgroundColor: "#e5e5e5" }}
        whileTap={{ scale: 0.97 }}
        className="mt-1 w-full cursor-pointer rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
      >
        Create Room
      </motion.button>
    </motion.div>
  );
}
