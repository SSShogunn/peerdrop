import { useEffect, useRef } from "react";
import { animate, type JSAnimation } from "animejs";

const NODE_A = { x: 30, y: 60 };
const NODE_B = { x: 290, y: 60 };
const CONTROL = { x: 160, y: 18 };
const PATH_D = `M ${NODE_A.x} ${NODE_A.y} Q ${CONTROL.x} ${CONTROL.y} ${NODE_B.x} ${NODE_B.y}`;

function quadraticPoint(t: number) {
  const mt = 1 - t;
  const x = mt * mt * NODE_A.x + 2 * mt * t * CONTROL.x + t * t * NODE_B.x;
  const y = mt * mt * NODE_A.y + 2 * mt * t * CONTROL.y + t * t * NODE_B.y;
  return { x, y };
}

const SAMPLE_COUNT = 32;
const SAMPLES = Array.from({ length: SAMPLE_COUNT + 1 }, (_, i) => quadraticPoint(i / SAMPLE_COUNT));

export function PeerLink() {
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const nodeARingRef = useRef<SVGCircleElement>(null);
  const nodeBRingRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animations: JSAnimation[] = [];

    if (pathRef.current) {
      const length = pathRef.current.getTotalLength();
      pathRef.current.style.strokeDasharray = `${length}`;
      pathRef.current.style.strokeDashoffset = `${length}`;
      animations.push(
        animate(pathRef.current, {
          strokeDashoffset: [length, 0],
          duration: 1100,
          ease: "outQuad",
          delay: 150,
        }),
      );
    }

    if (reduceMotion) return () => animations.forEach((a) => a.pause());

    if (dotRef.current) {
      animations.push(
        animate(dotRef.current, {
          cx: SAMPLES.map((p) => p.x),
          cy: SAMPLES.map((p) => p.y),
          duration: 2600,
          ease: "inOutSine",
          loop: true,
          loopDelay: 300,
          delay: 1300,
        }),
      );
    }

    [nodeARingRef, nodeBRingRef].forEach((ref, i) => {
      if (!ref.current) return;
      animations.push(
        animate(ref.current, {
          r: [7, 16],
          opacity: [0.35, 0],
          duration: 1800,
          ease: "outQuad",
          loop: true,
          delay: 800 + i * 900,
        }),
      );
    });

    return () => animations.forEach((a) => a.pause());
  }, []);

  return (
    <svg
      viewBox="0 0 320 120"
      className="mx-auto w-full max-w-xs text-foreground sm:max-w-sm"
      aria-hidden="true"
    >
      <path
        ref={pathRef}
        d={PATH_D}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        className="text-foreground/25"
      />

      <circle ref={nodeARingRef} cx={NODE_A.x} cy={NODE_A.y} r={7} className="fill-none stroke-emerald-500" strokeWidth={1.2} opacity={0} />
      <circle ref={nodeBRingRef} cx={NODE_B.x} cy={NODE_B.y} r={7} className="fill-none stroke-emerald-500" strokeWidth={1.2} opacity={0} />

      <circle cx={NODE_A.x} cy={NODE_A.y} r={6} className="fill-background stroke-foreground" strokeWidth={1.6} />
      <circle cx={NODE_B.x} cy={NODE_B.y} r={6} className="fill-background stroke-foreground" strokeWidth={1.6} />

      <circle ref={dotRef} cx={NODE_A.x} cy={NODE_A.y} r={3.5} className="fill-emerald-500" />
    </svg>
  );
}
