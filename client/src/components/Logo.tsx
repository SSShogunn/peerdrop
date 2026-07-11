export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-foreground">
        <circle cx="6" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="18" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
        <line
          x1="9.6"
          y1="12"
          x2="14.4"
          y2="12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeDasharray="2.2 2.2"
        />
      </svg>
      <span className="font-heading text-sm font-semibold tracking-tight">PeerDrop</span>
    </div>
  );
}
