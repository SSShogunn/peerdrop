import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PeerProvider } from "@/context/PeerContext";
import { usePeer } from "@/context/usePeer";
import { AppHeader } from "@/components/AppHeader";
import Home from "@/components/screens/Home";
import Hosting from "@/components/screens/Hosting";
import Joining from "@/components/screens/Joining";
import Room from "@/components/screens/Room";
import Interrupted from "@/components/screens/Interrupted";
import Ended from "@/components/screens/Ended";

export type Intent = "create" | "join" | null;

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col">
      <AppHeader />
      <main className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-6">
        <div className="flex w-full max-w-sm flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}

function AppInner() {
  const { status, roomCode, joinRoom } = usePeer();
  const [intent, setIntent] = useState<Intent>(() =>
    new URLSearchParams(window.location.search).get("room") ? "join" : null,
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("room");
    if (!code) return;

    window.history.replaceState({}, "", window.location.pathname);
    joinRoom(code);
  }, [joinRoom]);

  let key: string;
  let screen: ReactNode;

  if (status === "idle") {
    key = "home";
    screen = <Home onIntent={setIntent} />;
  } else if (status === "reconnecting") {
    key = "interrupted";
    screen = <Interrupted />;
  } else if (status === "error") {
    key = "ended";
    screen = <Ended />;
  } else if (status === "p2p_connected") {
    key = "room";
    screen = <Room />;
  } else if (roomCode || intent === "create") {
    key = "hosting";
    screen = <Hosting />;
  } else {
    key = "joining";
    screen = <Joining />;
  }

  return (
    <Shell>
      <AnimatePresence mode="wait">
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {screen}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}

export default function App() {
  return (
    <PeerProvider>
      <AppInner />
    </PeerProvider>
  );
}
