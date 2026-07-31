import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PeerProvider } from "@/context/PeerContext";
import { usePeer } from "@/context/usePeer";
import { AppHeader } from "@/components/AppHeader";
import Landing from "@/components/screens/Landing";
import Home from "@/components/screens/Home";
import Hosting from "@/components/screens/Hosting";
import Joining from "@/components/screens/Joining";
import Room from "@/components/screens/Room";
import Interrupted from "@/components/screens/Interrupted";
import Ended from "@/components/screens/Ended";

function isDesktop() {
  return typeof (window as unknown as { runtime?: unknown }).runtime !== "undefined";
}

function hasAppEntry() {
  if (isDesktop()) return true;
  const params = new URLSearchParams(window.location.search);
  return window.location.pathname === "/app" || !!params.get("room");
}

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
  const { status, roomCode, joinRoom, reset } = usePeer();
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

  useEffect(() => {
    const onPopState = () => {
      if (status !== "idle") reset();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [status, reset]);

  const handleIntent = (next: Intent) => {
    if (next) {
      window.history.pushState({ session: true }, "", window.location.pathname + window.location.search);
    }
    setIntent(next);
  };

  let key: string;
  let screen: ReactNode;

  if (status === "idle") {
    key = "home";
    screen = <Home onIntent={handleIntent} />;
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
  const [showApp, setShowApp] = useState(hasAppEntry);

  useEffect(() => {
    const onPopState = () => setShowApp(hasAppEntry());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openApp = () => {
    window.history.pushState({}, "", "/app");
    setShowApp(true);
  };

  if (!showApp) {
    return <Landing onOpenApp={openApp} />;
  }

  return (
    <PeerProvider>
      <AppInner />
    </PeerProvider>
  );
}
