"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";

export function BackToTop() {
  const [show, setShow] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    const el = document.querySelector('main');
    if (!el) return;
    mainRef.current = el;
    const onScroll = () => setShow(el.scrollTop > 400);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-lg flex items-center justify-center text-[var(--meta)] hover:text-[var(--fg)] hover:border-[var(--accent)] transition-colors"
      aria-label={t('accessibility.backToTop')}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
