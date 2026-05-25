import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { execFileSync } from "child_process";
import type { RuleFile, RuleDraft, PublishEvent, ReorderItem } from "@/app/editor/types";

const DB_PATH = path.join(process.cwd(), "..", "data", "usage.db");
const RULES_DIR = path.join(process.cwd(), "..", "rules");
const HISTORY_DIR = path.join(process.cwd(), "..", "data", "history");
const CLAUDE_MD_PATH = path.join(process.env.HOME || "~", ".claude", "CLAUDE.md");

function getReadWriteDb(): Database.Database {
  return new Database(DB_PATH);
}

function getReadonlyDb(): Database.Database {
  return new Database(DB_PATH, { readonly: true });
}

// ── Read rule files from disk ──

function parseFrontmatter(content: string): { yaml: string; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)/);
  if (!match) return { yaml: "", body: content };
  return { yaml: match[1], body: match[2] };
}

function parseYamlField(yaml: string, field: string): string | number | undefined {
  const regex = new RegExp(`^${field}:\\s*(.+)$`, "m");
  const match = yaml.match(regex);
  if (!match) return undefined;
  const val = match[1].trim();
  const num = Number(val);
  return isNaN(num) ? val : num;
}

export function getAllRulesWithDraftStatus(): RuleFile[] {
  const db = getReadonlyDb();
  try {
    const drafts = db.prepare("SELECT rule_id, order_override FROM rule_drafts").all() as Array<{
      rule_id: string;
      order_override: number | null;
    }>;
    const draftMap = new Map(drafts.map((d) => [d.rule_id, d]));

    const files = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith(".md")).sort();
    const rules: RuleFile[] = [];

    for (const fileName of files) {
      const content = fs.readFileSync(path.join(RULES_DIR, fileName), "utf-8");
      const { yaml, body } = parseFrontmatter(content);
      const ruleId = String(parseYamlField(yaml, "id") ?? "");
      const title = String(parseYamlField(yaml, "title") ?? ruleId);
      const order = Number(parseYamlField(yaml, "order") ?? 999);
      const draft = draftMap.get(ruleId);

      rules.push({
        rule_id: ruleId,
        section_id: ruleId,
        title,
        order,
        source_file: fileName,
        frontmatter_yaml: yaml,
        markdown_body: body,
        has_draft: !!draft,
        draft_order_override: draft?.order_override ?? null,
      });
    }

    rules.sort((a, b) => {
      const orderA = a.draft_order_override ?? a.order;
      const orderB = b.draft_order_override ?? b.order;
      return orderA - orderB;
    });

    return rules;
  } finally {
    db.close();
  }
}

// ── Draft CRUD ──

export function getDraft(ruleId: string): RuleDraft | null {
  const db = getReadonlyDb();
  try {
    return db.prepare("SELECT * FROM rule_drafts WHERE rule_id = ?").get(ruleId) as RuleDraft | null;
  } finally {
    db.close();
  }
}

export function saveDraft(
  ruleId: string,
  frontmatterYaml: string,
  markdownBody: string,
  orderOverride?: number | null
): void {
  const db = getReadWriteDb();
  try {
    db.prepare(
      `INSERT INTO rule_drafts (rule_id, frontmatter_yaml, markdown_body, order_override, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(rule_id) DO UPDATE SET
         frontmatter_yaml = excluded.frontmatter_yaml,
         markdown_body = excluded.markdown_body,
         order_override = excluded.order_override,
         updated_at = datetime('now')`
    ).run(ruleId, frontmatterYaml, markdownBody, orderOverride ?? null);
  } finally {
    db.close();
  }
}

export function deleteDraft(ruleId: string): void {
  const db = getReadWriteDb();
  try {
    db.prepare("DELETE FROM rule_drafts WHERE rule_id = ?").run(ruleId);
  } finally {
    db.close();
  }
}

// ── Reorder ──

export function saveReorder(items: ReorderItem[]): void {
  const db = getReadWriteDb();
  try {
    const upsert = db.prepare(
      `INSERT INTO rule_drafts (rule_id, frontmatter_yaml, markdown_body, order_override, updated_at)
       VALUES (?, '', '', ?, datetime('now'))
       ON CONFLICT(rule_id) DO UPDATE SET
         order_override = excluded.order_override,
         updated_at = datetime('now')`
    );
    const transaction = db.transaction(() => {
      for (const item of items) {
        upsert.run(item.rule_id, item.order);
      }
    });
    transaction();
  } finally {
    db.close();
  }
}

// ── Validate ──

export interface DraftValidationIssue {
  rule_id: string;
  message: string;
}

export function validateDrafts(drafts: Array<{ rule_id: string; frontmatter_yaml: string }>): DraftValidationIssue[] {
  const errors: DraftValidationIssue[] = [];
  for (const d of drafts) {
    const yaml = d.frontmatter_yaml;
    const id = parseYamlField(yaml, "id");
    const title = parseYamlField(yaml, "title");
    const order = parseYamlField(yaml, "order");

    if (!id) errors.push({ rule_id: d.rule_id, message: "missing 'id'" });
    if (!title) errors.push({ rule_id: d.rule_id, message: "missing 'title'" });
    if (order === undefined) errors.push({ rule_id: d.rule_id, message: "missing 'order'" });
  }
  return errors;
}

// ── Publish ──

function forceSnapshot(): string | null {
  // Save current CLAUDE.md before any changes, skip if identical to latest snapshot
  if (!fs.existsSync(CLAUDE_MD_PATH)) return null;
  const content = fs.readFileSync(CLAUDE_MD_PATH, "utf-8");
  fs.mkdirSync(HISTORY_DIR, { recursive: true });

  const files = fs.readdirSync(HISTORY_DIR).filter((f) => f.endsWith(".md")).sort();
  if (files.length > 0) {
    const latest = fs.readFileSync(path.join(HISTORY_DIR, files[files.length - 1]), "utf-8");
    if (latest === content) return null;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `${ts}.md`;
  fs.writeFileSync(path.join(HISTORY_DIR, name), content, "utf-8");
  return name;
}

export function publishDrafts(): { rulesChanged: number; snapshotName: string | null; error?: string } {
  const db = getReadWriteDb();
  try {
    const drafts = db.prepare("SELECT * FROM rule_drafts").all() as RuleDraft[];
    if (drafts.length === 0) {
      return { rulesChanged: 0, snapshotName: null };
    }

    // Force snapshot BEFORE writing any files
    const preSnapshot = forceSnapshot();

    // Write each draft to its rule file
    const allRules = getAllRulesWithDraftStatus();
    let written = 0;
    for (const draft of drafts) {
      const rule = allRules.find((r) => r.rule_id === draft.rule_id);
      if (!rule) continue;
      written++;

      // Fall back to disk content for reorder-only drafts (empty yaml/body)
      let yaml = draft.frontmatter_yaml || rule.frontmatter_yaml;
      const body = draft.markdown_body || rule.markdown_body;
      if (draft.order_override !== null) {
        yaml = yaml.replace(/^order:\s*\d+/m, `order: ${draft.order_override}`);
      }

      const content = `---\n${yaml}\n---\n${body}`;
      fs.writeFileSync(path.join(RULES_DIR, rule.source_file), content, "utf-8");
    }

    // Run assemble.py using execFileSync (no shell injection risk)
    let snapshotName: string | null = preSnapshot;
    let errorMsg: string | null = null;
    try {
      execFileSync("python3", ["build/assemble.py"], {
        cwd: path.join(process.cwd(), ".."),
        encoding: "utf-8",
        timeout: 30000,
      });
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      errorMsg = (e as Error & { stderr?: string }).stderr || e.message || "assemble.py failed";
    }

    // Record publish event
    db.prepare(
      `INSERT INTO publish_history (published_at, rules_changed, snapshot_name, status, error_message)
       VALUES (datetime('now'), ?, ?, ?, ?)`
    ).run(
      written,
      snapshotName,
      errorMsg ? "failed" : "success",
      errorMsg
    );

    // Clear drafts on success
    if (!errorMsg) {
      db.prepare("DELETE FROM rule_drafts").run();
    }

    return { rulesChanged: written, snapshotName, error: errorMsg ?? undefined };
  } finally {
    db.close();
  }
}

// ── Publish history ──

export function getPublishHistory(): PublishEvent[] {
  const db = getReadonlyDb();
  try {
    return db.prepare("SELECT * FROM publish_history ORDER BY published_at DESC LIMIT 20").all() as PublishEvent[];
  } finally {
    db.close();
  }
}
