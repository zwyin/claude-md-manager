import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import {
  getSectionsWithStats,
  getRulesWithStats,
  getRuleDetail,
  getTotalSessionCount,
  getCitations,
  getAnalytics,
  getRecentCitations,
  getHeatmapData,
  getSessionTrend,
  getTotalCitationCount,
  getRecentBuilds,
  getModelDistribution,
  getRecentSessions,
  getConfidenceDistribution,
  getSessionDetail,
  getFilteredSessions,
} from '../db';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS rule_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  matched_keyword TEXT NOT NULL,
  confidence TEXT DEFAULT 'medium',
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
CREATE TABLE IF NOT EXISTS publish_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  rules_changed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success'
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

describe('getTotalCitationCount', () => {
  it('returns total citation count', () => {
    expect(getTotalCitationCount(undefined, db)).toBe(4);
  });

  it('filters by days', () => {
    expect(getTotalCitationCount(7, db)).toBe(4);
  });
});

describe('getRecentCitations', () => {
  it('returns recent citations sorted by timestamp desc', () => {
    const result = getRecentCitations(10, undefined, db);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].rule_id).toBeTruthy();
    expect(result[0].title).toBeTruthy();
  });

  it('respects limit', () => {
    const result = getRecentCitations(2, undefined, db);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('filters by days', () => {
    const result = getRecentCitations(10, 7, db);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getHeatmapData', () => {
  it('returns heatmap cells with rule and day info', () => {
    const result = getHeatmapData(undefined, 10, db);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].rule_id).toBeTruthy();
    expect(result[0].day).toBeTruthy();
    expect(result[0].count).toBeGreaterThan(0);
  });

  it('filters by days', () => {
    const result = getHeatmapData(7, 10, db);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getSessionTrend', () => {
  it('returns daily session counts', () => {
    db.prepare("UPDATE sessions SET started_at = datetime('now')").run();
    const result = getSessionTrend(undefined, db);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].period).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result[0].count).toBe(3);
  });

  it('filters by days', () => {
    db.prepare("UPDATE sessions SET started_at = datetime('now')").run();
    const result = getSessionTrend(7, db);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe('getRecentBuilds', () => {
  it('returns empty when no publish history', () => {
    expect(getRecentBuilds(5, db)).toEqual([]);
  });

  it('returns recent builds sorted by date', () => {
    db.prepare("INSERT INTO publish_history (rules_changed, status) VALUES (3, 'success')").run();
    db.prepare("INSERT INTO publish_history (rules_changed, status, published_at) VALUES (1, 'success', datetime('now', '+1 second'))").run();
    const result = getRecentBuilds(5, db);
    expect(result).toHaveLength(2);
    expect(result[0].rules_changed).toBe(1);
  });

  it('respects limit', () => {
    for (let i = 0; i < 10; i++) {
      db.prepare("INSERT INTO publish_history (rules_changed, status) VALUES (?, 'success')").run(i);
    }
    expect(getRecentBuilds(3, db)).toHaveLength(3);
  });
});

describe('getModelDistribution', () => {
  it('returns model counts', () => {
    const result = getModelDistribution(undefined, db);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((r) => r.model.includes('claude'))).toBe(true);
  });

  it('filters by days', () => {
    db.prepare("UPDATE sessions SET started_at = datetime('now')").run();
    const result = getModelDistribution(7, db);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getRecentSessions', () => {
  it('returns sessions with citation and rule counts', () => {
    const result = getRecentSessions(10, undefined, db);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].session_id).toBeTruthy();
    expect(typeof result[0].citation_count).toBe('number');
  });

  it('respects limit', () => {
    expect(getRecentSessions(2, undefined, db).length).toBeLessThanOrEqual(2);
  });

  it('filters by days', () => {
    db.prepare("UPDATE sessions SET started_at = datetime('now')").run();
    const result = getRecentSessions(10, 7, db);
    expect(result.length).toBeGreaterThan(0);
  });

  it('computes duration_sec from started_at/ended_at', () => {
    db.prepare("UPDATE sessions SET started_at = '2026-01-01 00:00:00', ended_at = '2026-01-01 00:05:00' WHERE session_id = 's1'").run();
    const result = getRecentSessions(10, undefined, db);
    const s1 = result.find((s) => s.session_id === 's1');
    expect(s1?.duration_sec).toBe(300);
  });

  it('returns 0 duration when ended_at is null', () => {
    db.prepare("UPDATE sessions SET started_at = '2026-01-01 00:00:00', ended_at = NULL WHERE session_id = 's2'").run();
    const result = getRecentSessions(10, undefined, db);
    const s2 = result.find((s) => s.session_id === 's2');
    expect(s2?.duration_sec).toBe(0);
  });
});

describe('getConfidenceDistribution', () => {
  it('returns confidence buckets with correct totals and top rules', () => {
    const result = getConfidenceDistribution(undefined, db);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].confidence).toBeTruthy();
    expect(result[0].top_rules).toBeInstanceOf(Array);

    // All 4 seed references default to confidence='medium'
    const medium = result.find((r) => r.confidence === 'medium');
    expect(medium).toBeDefined();
    expect(medium!.count).toBe(4);
    const totalFromDist = result.reduce((sum, r) => sum + r.count, 0);
    expect(totalFromDist).toBe(4);
  });

  it('splits multiple confidence levels correctly', () => {
    // Add refs with different confidence values
    db.prepare("INSERT INTO rule_references (rule_id, session_id, matched_keyword, confidence) VALUES ('r1', 's1', 'kw1', 'high')").run();
    db.prepare("INSERT INTO rule_references (rule_id, session_id, matched_keyword, confidence) VALUES ('r2', 's2', 'kw2', 'low')").run();
    db.prepare("INSERT INTO rule_references (rule_id, session_id, matched_keyword, confidence) VALUES ('r3', 's3', 'kw3', 'low')").run();

    const result = getConfidenceDistribution(undefined, db);
    const byConf = Object.fromEntries(result.map((r) => [r.confidence, r.count]));
    expect(byConf['medium']).toBe(4);
    expect(byConf['high']).toBe(1);
    expect(byConf['low']).toBe(2);
    const total = result.reduce((sum, r) => sum + r.count, 0);
    expect(total).toBe(7);
  });

  it('filters by days', () => {
    const result = getConfidenceDistribution(7, db);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('getSessionDetail', () => {
  it('returns session with citations and sections', () => {
    const detail = getSessionDetail('s1', db);
    expect(detail).not.toBeNull();
    expect(detail!.session.session_id).toBe('s1');
    expect(detail!.citations.length).toBeGreaterThan(0);
    expect(detail!.sections.length).toBeGreaterThan(0);
  });

  it('returns fallback session for nonexistent id', () => {
    const detail = getSessionDetail('nonexistent', db);
    expect(detail).not.toBeNull();
    expect(detail!.session.session_id).toBe('nonexistent');
    expect(detail!.citations).toEqual([]);
  });

  it('citations include rule metadata', () => {
    const detail = getSessionDetail('s1', db);
    const c = detail!.citations[0];
    expect(c.rule_id).toBeTruthy();
    expect(c.title).toBeTruthy();
    expect(c.section_id).toBeTruthy();
  });
});

describe('getFilteredSessions', () => {
  it('returns paginated sessions with totals', () => {
    const result = getFilteredSessions({ limit: 10, offset: 0, sort: 'time', dir: 'DESC' }, db);
    expect(result.sessions.length).toBeGreaterThan(0);
    expect(result.total).toBe(3);
    expect(result.models.length).toBeGreaterThan(0);
  });

  it('filters by search term', () => {
    const result = getFilteredSessions({ limit: 10, offset: 0, sort: 'time', dir: 'DESC', search: 'task 1' }, db);
    expect(result.total).toBeLessThanOrEqual(1);
  });

  it('filters by model', () => {
    const result = getFilteredSessions({ limit: 10, offset: 0, sort: 'time', dir: 'DESC', model: 'claude-4' }, db);
    expect(result.total).toBeLessThanOrEqual(2);
  });

  it('sorts by citations', () => {
    const result = getFilteredSessions({ limit: 10, offset: 0, sort: 'citations', dir: 'DESC' }, db);
    expect(result.sessions[0].citation_count).toBeGreaterThanOrEqual(result.sessions[result.sessions.length - 1].citation_count);
  });

  it('respects offset', () => {
    const result = getFilteredSessions({ limit: 1, offset: 1, sort: 'time', dir: 'DESC' }, db);
    expect(result.sessions.length).toBeLessThanOrEqual(1);
  });

  it('computes avg_citations including zero-citation sessions', () => {
    const result = getFilteredSessions({ limit: 10, offset: 0, sort: 'time', dir: 'DESC' }, db);
    // 4 refs across 3 sessions → avg = 4/3 ≈ 1.3
    expect(result.avg_citations).toBeCloseTo(4 / 3, 0);
  });

  it('computes avg_duration from started_at/ended_at', () => {
    db.prepare("UPDATE sessions SET started_at = '2026-01-01 00:00:00', ended_at = '2026-01-01 00:05:00'").run();
    const result = getFilteredSessions({ limit: 10, offset: 0, sort: 'time', dir: 'DESC' }, db);
    expect(result.avg_duration).toBe(300);
  });

  it('returns null avg_duration when no sessions have timestamps', () => {
    const result = getFilteredSessions({ limit: 10, offset: 0, sort: 'time', dir: 'DESC' }, db);
    expect(result.avg_duration).toBeNull();
  });
});
