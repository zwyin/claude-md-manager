import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import {
  getSectionsWithStats,
  getRulesWithStats,
  getRuleDetail,
  getTotalSessionCount,
  getCitations,
  getAnalytics,
} from '../db';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS rule_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  matched_keyword TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  started_at DATETIME,
  ended_at DATETIME,
  model TEXT,
  task_summary TEXT
);
CREATE TABLE IF NOT EXISTS rules_metadata (
  rule_id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  title TEXT NOT NULL,
  keywords TEXT,
  source_file TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sections_metadata (
  section_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_file TEXT NOT NULL,
  rule_count INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

let db: Database.Database;

function seedData() {
  // 2 sections
  db.prepare("INSERT INTO sections_metadata (section_id, title, source_file, rule_count) VALUES ('sec1', 'Section 1', 'a.md', 2)").run();
  db.prepare("INSERT INTO sections_metadata (section_id, title, source_file, rule_count) VALUES ('sec2', 'Section 2', 'b.md', 1)").run();

  // 3 rules
  db.prepare("INSERT INTO rules_metadata (rule_id, section_id, title, keywords, source_file) VALUES ('r1', 'sec1', 'Rule 1', '[\"kw1\"]', 'a.md')").run();
  db.prepare("INSERT INTO rules_metadata (rule_id, section_id, title, keywords, source_file) VALUES ('r2', 'sec1', 'Rule 2', '[]', 'a.md')").run();
  db.prepare("INSERT INTO rules_metadata (rule_id, section_id, title, keywords, source_file) VALUES ('r3', 'sec2', 'Rule 3', '[\"kw3\"]', 'b.md')").run();

  // 3 sessions
  db.prepare("INSERT INTO sessions (session_id, model, task_summary) VALUES ('s1', 'claude-4', 'task 1')").run();
  db.prepare("INSERT INTO sessions (session_id, model, task_summary) VALUES ('s2', 'claude-5', 'task 2')").run();
  db.prepare("INSERT INTO sessions (session_id, model, task_summary) VALUES ('s3', 'claude-4', 'task 3')").run();

  // 4 references: r1 has 3 citations, r2 has 1, r3 has 0
  db.prepare("INSERT INTO rule_references (rule_id, session_id, matched_keyword) VALUES ('r1', 's1', 'kw1')").run();
  db.prepare("INSERT INTO rule_references (rule_id, session_id, matched_keyword) VALUES ('r1', 's2', 'kw1')").run();
  db.prepare("INSERT INTO rule_references (rule_id, session_id, matched_keyword) VALUES ('r1', 's3', 'kw1')").run();
  db.prepare("INSERT INTO rule_references (rule_id, session_id, matched_keyword) VALUES ('r2', 's1', 'kw2')").run();
}

beforeEach(() => {
  db = new Database(':memory:');
  db.exec(SCHEMA_SQL);
  seedData();
});

afterEach(() => {
  db.close();
});

describe('getSectionsWithStats', () => {
  it('returns sections with citation counts', () => {
    const result = getSectionsWithStats(undefined, db);
    expect(result).toHaveLength(2);
    const sec1 = result.find((s) => s.section_id === 'sec1');
    expect(sec1?.total_citations).toBe(4);
    expect(sec1?.total_sessions).toBe(3);
  });

  it('sorts by citations descending', () => {
    const result = getSectionsWithStats(undefined, db);
    expect(result[0].section_id).toBe('sec1');
    expect(result[1].section_id).toBe('sec2');
  });

  it('section with no citations has zero counts', () => {
    const result = getSectionsWithStats(undefined, db);
    const sec2 = result.find((s) => s.section_id === 'sec2');
    expect(sec2?.total_citations).toBe(0);
  });

  it('filters by days', () => {
    // days=1 should still see today's data
    const result = getSectionsWithStats(1, db);
    expect(result).toHaveLength(2);
    const sec1 = result.find((s) => s.section_id === 'sec1');
    expect(sec1?.total_citations).toBe(4);
  });
});

describe('getRulesWithStats', () => {
  it('returns rules with stats and parsed keywords', () => {
    const result = getRulesWithStats(undefined, db);
    expect(result).toHaveLength(3);
    const r1 = result.find((r) => r.rule_id === 'r1');
    expect(r1?.keywords).toEqual(['kw1']);
    expect(r1?.match_count).toBe(3);
    expect(r1?.section_title).toBe('Section 1');
  });

  it('sorts by citation count descending', () => {
    const result = getRulesWithStats(undefined, db);
    expect(result[0].rule_id).toBe('r1');
    expect(result[2].rule_id).toBe('r3');
  });

  it('filters by days', () => {
    const result = getRulesWithStats(7, db);
    expect(result).toHaveLength(3);
    const r1 = result.find((r) => r.rule_id === 'r1');
    expect(r1?.match_count).toBe(3);
  });
});

describe('getRuleDetail', () => {
  it('returns rule detail with citations and siblings', () => {
    const detail = getRuleDetail('r1', undefined, db);
    expect(detail).not.toBeNull();
    expect(detail!.rule.rule_id).toBe('r1');
    expect(detail!.rule.citation_count).toBe(3);
    expect(detail!.citations).toHaveLength(3);
    expect(detail!.siblings).toHaveLength(1); // r2 is sibling in sec1
    expect(detail!.siblings[0].rule_id).toBe('r2');
  });

  it('returns null for nonexistent rule', () => {
    const detail = getRuleDetail('nonexistent', undefined, db);
    expect(detail).toBeNull();
  });

  it('filters detail citations by days', () => {
    const detail = getRuleDetail('r1', 7, db);
    expect(detail!.citations).toHaveLength(3);
  });
});

describe('getTotalSessionCount', () => {
  it('returns total session count', () => {
    expect(getTotalSessionCount(undefined, db)).toBe(3);
  });

  it('returns all sessions when no days filter', () => {
    expect(getTotalSessionCount(undefined, db)).toBe(3);
  });

  it('filters by days', () => {
    // Sessions with started_at set should be counted
    db.prepare("UPDATE sessions SET started_at = datetime('now')").run();
    expect(getTotalSessionCount(1, db)).toBe(3);
  });
});

describe('getCitations', () => {
  it('returns time points grouped by day', () => {
    const result = getCitations({}, db);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((p) => p.period.length > 0 && p.count > 0)).toBe(true);
  });

  it('filters by rule_id', () => {
    const result = getCitations({ rule_id: 'r1' }, db);
    const total = result.reduce((sum, p) => sum + p.count, 0);
    expect(total).toBe(3);
  });

  it('groups by month', () => {
    const result = getCitations({ group_by: 'month' }, db);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].period).toMatch(/^\d{4}-\d{2}$/);
  });

  it('groups by week', () => {
    const result = getCitations({ group_by: 'week' }, db);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].period).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('filters by days', () => {
    const result = getCitations({ days: 7 }, db);
    const total = result.reduce((sum, p) => sum + p.count, 0);
    expect(total).toBe(4);
  });
});

describe('getAnalytics', () => {
  it('returns complete analytics', () => {
    const a = getAnalytics(undefined, db);
    expect(a.total_rules).toBe(3);
    expect(a.total_citations).toBe(4);
    expect(a.total_sessions).toBe(3);
    expect(a.top_rules[0].rule_id).toBe('r1');
    expect(a.top_rules[0].citation_count).toBe(3);
    expect(a.category_distribution).toHaveLength(2);
  });

  it('cold rules includes rules with no citations', () => {
    const a = getAnalytics(undefined, db);
    const coldIds = a.cold_rules.map((r) => r.rule_id);
    expect(coldIds).toContain('r3');
  });

  it('filters by days', () => {
    const a = getAnalytics(7, db);
    expect(a.total_citations).toBe(4);
    expect(a.top_rules).toHaveLength(2);
  });
});
