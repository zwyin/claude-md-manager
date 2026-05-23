"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function ScrollRestorer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <main
      ref={ref}
      className={`flex-1 overflow-y-auto p-6 transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {children}
    </main>
  );
}
