"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function ScrollRestorer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: 0 });
    el.style.opacity = '0';
    rafRef.current = requestAnimationFrame(() => { el.style.opacity = '1'; });
    return () => cancelAnimationFrame(rafRef.current);
  }, [pathname]);

  return (
    <main
      ref={ref}
      className="flex-1 overflow-y-auto p-6 transition-opacity duration-150"
    >
      {children}
    </main>
  );
}
