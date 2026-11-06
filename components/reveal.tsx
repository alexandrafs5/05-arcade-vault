"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

type RevealProps = {
  as?: "section" | "div";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

// Adds `.in` once the element scrolls into view. Server HTML always renders the hidden state.
export function Reveal({ as = "div", className = "", style, children }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cls = `reveal ${className}`.trim();
  return as === "section" ? (
    <section ref={ref} className={cls} style={style}>{children}</section>
  ) : (
    <div ref={ref} className={cls} style={style}>{children}</div>
  );
}
