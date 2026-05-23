"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function ScrollRestorer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return <main ref={ref} className="flex-1 overflow-y-auto p-6">{children}</main>;
}
