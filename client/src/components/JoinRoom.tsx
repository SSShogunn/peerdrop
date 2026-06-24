import { useState } from "react";
import { motion } from "motion/react";
import { usePeer } from "../context/usePeer";

export default function JoinRoom() {
  const { joinRoom } = usePeer();
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(0);

  const handleJoin = () => {
    if (code.trim().length === 0) {
      setShake((n) => n + 1);
      return;
    }
    joinRoom(code.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleJoin();
  };

  return (
    <motion.div
      whileHover={{ borderColor: "rgba(255,255,255,0.2)", y: -2 }}
      className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
    >
      <h2 className="text-lg font-semibold text-white">Receive a file</h2>
      <p className="text-sm text-neutral-400">
        Enter the code shared by the sender.
      </p>
      <motion.input
        type="text"
        placeholder="Enter room code"
        value={code}
        maxLength={4}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        whileFocus={{ borderColor: "rgba(255,255,255,0.4)" }}
        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-xl font-semibold tracking-[0.3em] text-white placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-500 focus:outline-none"
      />
      <motion.button
        onClick={handleJoin}
        whileHover={{ backgroundColor: "#e5e5e5" }}
        whileTap={{ scale: 0.97 }}
        className="w-full cursor-pointer rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
      >
        Join Room
      </motion.button>
    </motion.div>
  );
}
