export interface RuleFile {
  rule_id: string;
  section_id: string;
  title: string;
  order: number;
  source_file: string;
  frontmatter_yaml: string;
  markdown_body: string;
  has_draft: boolean;
  draft_order_override: number | null;
}

export interface RuleDraft {
  rule_id: string;
  frontmatter_yaml: string;
  markdown_body: string;
  order_override: number | null;
  created_at: string;
  updated_at: string;
}

export interface PublishEvent {
  id: number;
  published_at: string;
  rules_changed: number;
  snapshot_name: string | null;
  status: "success" | "failed";
  error_message: string | null;
}

export interface ReorderItem {
  rule_id: string;
  order: number;
}