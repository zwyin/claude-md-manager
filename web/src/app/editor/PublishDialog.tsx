"use client";

import { Button } from "@/components/ui/button";
import type { RuleFile } from "./types";

interface PublishDialogProps {
  rules: RuleFile[];
  onPublish: () => void;
  onCancel: () => void;
}

export function PublishDialog({ rules, onPublish, onCancel }: PublishDialogProps) {
  const draftRules = rules.filter((r) => r.has_draft);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold mb-4">Publish Changes</h3>
        <p className="text-sm text-muted-foreground mb-3">
          The following {draftRules.length} rule{draftRules.length !== 1 ? "s" : ""} will be written to disk and assembled:
        </p>
        <ul className="text-sm space-y-1 mb-4 max-h-48 overflow-y-auto">
          {draftRules.map((r) => (
            <li key={r.rule_id} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              {r.title}
              <span className="text-xs text-muted-foreground">({r.source_file})</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onPublish}>
            Publish {draftRules.length} Rule{draftRules.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}