"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  if (!open) return null;

  const shortcuts = [
    { keys: "⌘K", desc: t("shortcut.search") },
    { keys: "⌘S", desc: t("shortcut.save") },
    { keys: "⇧⌘P", desc: t("shortcut.preview") },
    { keys: "↑ / ↓ / j / k", desc: t("shortcut.navigate") },
    { keys: "Enter", desc: t("shortcut.open") },
    { keys: "?", desc: t("shortcut.help") },
    { keys: "Esc", desc: t("shortcut.close") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
      <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-4">{t("shortcut.title")}</h3>
        <div className="space-y-2.5">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.desc}</span>
              <kbd className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{s.keys}</kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">{t("shortcut.dismiss")}</p>
      </div>
    </div>
  );
}
