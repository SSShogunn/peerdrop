import { motion, useScroll } from "motion/react";
import { Gauge, Globe2, Layers3, ShieldOff } from "lucide-react";
import QRCode from "react-qr-code";
import CreateRoom from "./CreateRoom";
import JoinRoom from "./JoinRoom";

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-emerald-400"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="6" cy="12" r="4" stroke="white" strokeWidth="1.6" />
        <circle cx="18" cy="12" r="4" stroke="white" strokeWidth="1.6" />
        <line
          x1="9.6"
          y1="12"
          x2="14.4"
          y2="12"
          stroke="white"
          strokeWidth="1.6"
          strokeDasharray="2.2 2.2"
        />
      </svg>
      <span className="text-sm font-semibold tracking-tight text-white">
        PeerDrop
      </span>
    </div>
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
    </span>
  );
}

function Nav() {
  return (
    <header className="relative z-10 flex w-full items-center justify-between px-6 py-6 lg:px-12">
      <Logo />
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <LiveDot />
        no upload, ever
      </div>
    </header>
  );
}

function HeroBackdrop() {
  return (
    <div
      className="absolute inset-0 -z-10"
      style={{
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)",
        backgroundSize: "28px 28px",
        maskImage:
          "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 100%)",
      }}
    />
  );
}

function Hero() {
  return (
    <section className="relative w-full overflow-hidden px-6 pb-20 pt-12 lg:px-12">
      <HeroBackdrop />

      <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs text-neutral-400"
        >
          <LiveDot />
          peer to peer · zero server storage
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="text-5xl font-bold tracking-tight text-white sm:text-6xl"
        >
          Drop it here.
          <br />
          It shows up there.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-md text-base leading-relaxed text-neutral-400"
        >
          PeerDrop opens a direct WebRTC connection between two browsers.
          No uploads, no accounts, no middleman holding your files — just
          two browsers talking to each other.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex w-full max-w-sm flex-col gap-4 text-left"
        >
          <CreateRoom />
          <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-neutral-500">
            <div className="h-px flex-1 bg-white/10" />
            or
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <JoinRoom />
        </motion.div>
      </div>
    </section>
  );
}

function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0c] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.85)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <div className="ml-2 flex-1 truncate rounded-md bg-white/5 px-3 py-1 text-center text-[11px] text-neutral-500">
          peerdrop
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function PreviewMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="flex justify-center"
    >
      <BrowserChrome>
        <p className="text-xs text-neutral-500">
          Share this code with the receiver
        </p>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 py-5 text-center text-4xl font-bold tracking-[0.35rem] text-white">
          X7QP
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="rounded-lg bg-white p-1.5">
            <QRCode value="https://peerdrop.app/?room=X7QP" size={68} />
          </div>
          <div className="flex flex-col gap-1.5 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <LiveDot />
              waiting for peer...
            </span>
            <span>scan to join from another device</span>
          </div>
        </div>
      </BrowserChrome>
    </motion.div>
  );
}

function Preview() {
  return (
    <section className="relative w-full px-6 py-16 lg:px-12">
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.4 }}
        className="mx-auto mb-10 max-w-5xl text-center text-sm font-medium uppercase tracking-wider text-neutral-500"
      >
        What sharing a room looks like
      </motion.h2>
      <PreviewMockup />
    </section>
  );
}

const FEATURES = [
  {
    icon: Gauge,
    title: "Skips the server",
    body: "Files move over a WebRTC data channel straight between browsers — no slow upload-then-download round trip.",
  },
  {
    icon: ShieldOff,
    title: "Nothing stored",
    body: "The signaling server only relays a handshake to set up the connection. It never touches, sees, or stores your file's bytes.",
  },
  {
    icon: Globe2,
    title: "Survives strict NAT",
    body: "STUN discovers your network path; a TURN relay kicks in as a fallback so corporate or mobile networks still connect.",
  },
  {
    icon: Layers3,
    title: "Send a whole batch",
    body: "Queue several files, watch live transfer speed, and pause or resume mid-send without losing your place.",
  },
];

function Features() {
  return (
    <section className="relative w-full px-6 py-20 lg:px-12">
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.4 }}
        className="mx-auto mb-10 max-w-5xl text-sm font-medium uppercase tracking-wider text-neutral-500"
      >
        Why it's actually peer to peer
      </motion.h2>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            whileHover={{ borderColor: "rgba(255,255,255,0.25)" }}
            className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/3 p-6"
          >
            <feature.icon className="h-5 w-5 text-emerald-400" strokeWidth={1.6} />
            <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
            <p className="text-sm leading-relaxed text-neutral-400">
              {feature.body}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", title: "Create or join", body: "Get a 4-character room code, or scan a QR code from another device." },
  { n: "02", title: "Browsers shake hands", body: "WebRTC negotiates a direct link between the two of you, peer to peer." },
  { n: "03", title: "Files just go", body: "They stream straight across the connection, no server in the middle." },
];

function HowItWorks() {
  return (
    <section className="relative w-full px-6 py-20 lg:px-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-10 sm:flex-row sm:gap-6">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: i * 0.12 }}
            className="flex-1"
          >
            <span className="font-mono text-xs text-neutral-500">{step.n}</span>
            <h3 className="mt-2 text-base font-semibold text-white">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              {step.body}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative w-full border-t border-white/10 px-6 py-8 lg:px-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-xs text-neutral-500 sm:flex-row">
        <span>PeerDrop — files move directly between browsers.</span>
        <span>No accounts. No storage. No tracking.</span>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="flex w-full flex-col">
      <ScrollProgress />
      <Nav />
      <Hero />
      <Preview />
      <Features />
      <HowItWorks />
      <Footer />
    </div>
  );
}
