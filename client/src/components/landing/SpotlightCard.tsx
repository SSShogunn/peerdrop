import { useRef, type PointerEvent, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
}

export function SpotlightCard({ children, className }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(50);
  const y = useMotionValue(50);
  const background = useMotionTemplate`radial-gradient(200px circle at ${x}% ${y}%, color-mix(in srgb, var(--color-emerald-500) 14%, transparent), transparent 70%)`;

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    x.set(((e.clientX - rect.left) / rect.width) * 100);
    y.set(((e.clientY - rect.top) / rect.height) * 100);
  };

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={cn("group relative overflow-hidden", className)}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundImage: background }}
      />
      {children}
    </div>
  );
}
