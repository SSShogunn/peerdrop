import { useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { Gauge, Globe2, Layers3, ShieldOff } from "lucide-react";
import QRCode from "react-qr-code";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { PeerLink } from "@/components/landing/PeerLink";
import { SplitText } from "@/components/landing/SplitText";
import { Magnetic } from "@/components/landing/Magnetic";
import { SpotlightCard } from "@/components/landing/SpotlightCard";
import { TiltCard } from "@/components/landing/TiltCard";
import { cn } from "@/lib/utils";

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-emerald-500"
      style={{ scaleX: scrollYProgress }}
    />
  );
}

function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
    </span>
  );
}

interface LandingProps {
  onOpenApp: () => void;
}

function Nav({ onOpenApp }: LandingProps) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 8);
  });

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex w-full items-center justify-between px-6 py-4 transition-colors duration-300 lg:px-12",
        scrolled
          ? "border-b border-border bg-background/75 backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <Logo />
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Button onClick={onOpenApp}>Open app</Button>
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
          "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--foreground) 6%, transparent) 1px, transparent 0)",
        backgroundSize: "28px 28px",
        maskImage:
          "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 100%)",
      }}
    />
  );
}

function Hero({ onOpenApp }: LandingProps) {
  return (
    <section className="relative w-full overflow-hidden px-6 pt-12 pb-16 lg:px-12">
      <HeroBackdrop />

      <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-1.5 bg-muted px-3 py-1 text-xs text-muted-foreground ring-1 ring-foreground/10"
        >
          <LiveDot />
          peer to peer · zero server storage
        </motion.span>

        <h1 className="font-heading text-5xl font-bold tracking-tight sm:text-6xl">
          <SplitText text="Drop it here." delay={0.15} />
          <br />
          <SplitText text="It shows up there." delay={0.35} />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="max-w-md text-base leading-relaxed text-muted-foreground"
        >
          PeerDrop opens a direct WebRTC connection between two browsers.
          No uploads, no accounts, no middleman holding your files — just
          two browsers talking to each other.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.65, ease: "easeOut" }}
          className="w-full"
        >
          <PeerLink />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.75 }}
        >
          <Magnetic>
            <Button size="lg" className="h-14 px-8 text-base" onClick={onOpenApp}>
              Open app
            </Button>
          </Magnetic>
        </motion.div>
      </div>
    </section>
  );
}

function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm overflow-hidden bg-card shadow-[0_50px_120px_-40px_rgba(0,0,0,0.45)] ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        <div className="ml-2 flex-1 truncate bg-muted px-3 py-1 text-center text-[11px] text-muted-foreground">
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
      style={{ perspective: 800 }}
    >
      <TiltCard>
        <BrowserChrome>
          <p className="text-xs text-muted-foreground">
            Share this code with the receiver
          </p>
          <div className="mt-3 bg-muted py-5 text-center font-heading text-4xl font-bold tracking-[0.35rem] ring-1 ring-foreground/10">
            X7QP
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="bg-white p-1.5">
              <QRCode value="https://peerdrop.sshogunn.org/?room=X7QP" size={68} />
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <LiveDot />
                waiting for peer...
              </span>
              <span>scan to join from another device</span>
            </div>
          </div>
        </BrowserChrome>
      </TiltCard>
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
        className="mx-auto mb-10 max-w-5xl text-center text-sm font-medium tracking-wider text-muted-foreground uppercase"
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
        className="mx-auto mb-10 max-w-5xl text-sm font-medium tracking-wider text-muted-foreground uppercase"
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
          >
            <SpotlightCard className="flex h-full flex-col gap-3 bg-card p-6 ring-1 ring-foreground/10">
              <feature.icon className="h-5 w-5 text-emerald-500" strokeWidth={1.6} />
              <h3 className="text-sm font-semibold">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
            </SpotlightCard>
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
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 75%", "end 60%"],
  });

  return (
    <section ref={sectionRef} className="relative w-full px-6 py-20 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <div className="relative mb-10 hidden h-px bg-border sm:block">
          <motion.div
            className="absolute inset-y-0 left-0 h-px w-full origin-left bg-emerald-500"
            style={{ scaleX: scrollYProgress }}
          />
        </div>

        <div className="flex flex-col gap-10 sm:flex-row sm:gap-6">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.12 }}
              className="flex-1"
            >
              <span className="font-mono text-xs text-muted-foreground">{step.n}</span>
              <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative w-full border-t border-border px-6 py-8 lg:px-12">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
        <span>PeerDrop — files move directly between browsers.</span>
        <span>No accounts. No storage. No tracking.</span>
      </div>
    </footer>
  );
}

export default function Landing({ onOpenApp }: LandingProps) {
  return (
    <div className="flex w-full flex-col">
      <ScrollProgress />
      <Nav onOpenApp={onOpenApp} />
      <Hero onOpenApp={onOpenApp} />
      <Preview />
      <Features />
      <HowItWorks />
      <Footer />
    </div>
  );
}
