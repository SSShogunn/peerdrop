import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  title?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({ title, meta, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={cn("rounded-md border border-border bg-card", className)}>
      {(title || meta) && (
        <header className="flex min-h-10 items-center justify-between gap-3 border-b border-border px-4 py-2">
          {title && <h2 className="text-sm font-medium">{title}</h2>}
          {meta && <div className="data flex items-center gap-2 text-xs text-muted-foreground">{meta}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Notice({
  tone = "warn",
  icon,
  children,
  action,
}: {
  tone?: "warn" | "ok" | "danger";
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "ok" && "bg-signal-soft text-signal",
        tone === "danger" && "bg-destructive/10 text-destructive",
      )}
    >
      <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {action}
    </div>
  );
}

export function LiveDot({ active = true, className }: { active?: boolean; className?: string }) {
  return (
    <span className={cn("relative flex size-2 shrink-0", className)}>
      {active && (
        <span className="absolute inset-0 rounded-full bg-signal [animation:pd-ping_1.8s_ease-out_infinite]" />
      )}
      <span className={cn("relative size-2 rounded-full", active ? "bg-signal" : "bg-muted-foreground/50")} />
    </span>
  );
}
