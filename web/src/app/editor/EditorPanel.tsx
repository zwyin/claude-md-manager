"use client";

import { CodeMirror } from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { Button } from "@/components/ui/button";

interface EditorPanelProps {
  frontmatterYaml: string;
  markdownBody: string;
  hasDraft: boolean;
  onFrontmatterChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSaveDraft: () => void;
  onDiscardDraft: () => void;
}

export function EditorPanel({
  frontmatterYaml,
  markdownBody,
  hasDraft,
  onFrontmatterChange,
  onBodyChange,
  onSaveDraft,
  onDiscardDraft,
}: EditorPanelProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-2">
        <Button size="sm" onClick={onSaveDraft}>
          Save Draft
        </Button>
        {hasDraft && (
          <Button size="sm" variant="outline" onClick={onDiscardDraft}>
            Discard Draft
          </Button>
        )}
        {hasDraft && (
          <span className="text-xs text-orange-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            Unsaved changes
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <div className="h-[40%] border border-border rounded-lg overflow-hidden">
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/50 border-b border-border">
            YAML Frontmatter
          </div>
          <CodeMirror
            value={frontmatterYaml}
            height="100%"
            extensions={[yaml()]}
            onChange={onFrontmatterChange}
            className="text-sm"
            theme="dark"
          />
        </div>
        <div className="flex-1 border border-border rounded-lg overflow-hidden">
          <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground bg-muted/50 border-b border-border">
            Markdown Body
          </div>
          <CodeMirror
            value={markdownBody}
            height="100%"
            extensions={[markdown()]}
            onChange={onBodyChange}
            className="text-sm"
            theme="dark"
          />
        </div>
      </div>
    </div>
  );
}
