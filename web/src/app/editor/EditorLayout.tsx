"use client";

interface EditorLayoutProps {
  children: {
    ruleList: React.ReactNode;
    editor: React.ReactNode;
    preview: React.ReactNode;
  };
}

export function EditorLayout({ children }: EditorLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      <div className="w-[280px] shrink-0 overflow-y-auto rounded-lg border border-border bg-card">
        {children.ruleList}
      </div>
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {children.editor}
      </div>
      <div className="w-[320px] shrink-0 overflow-y-auto rounded-lg border border-border bg-card">
        {children.preview}
      </div>
    </div>
  );
}