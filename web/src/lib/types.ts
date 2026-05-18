// ── Database row types ──

export interface RuleMetadata {
  rule_id: string;
  section_id: string;
  title: string;
  keywords: string; // JSON string
  source_file: string;
  updated_at: string;
}

export interface RuleReference {
  id: number;
  rule_id: string;
  session_id: string;
  matched_keyword: string;
  timestamp: string;
}

export interface Session {
  session_id: string;
  started_at: string | null;
  ended_at: string | null;
  model: string | null;
  task_summary: string | null;
}

// ── API response types ──

export interface RuleWithStats {
  rule_id: string;
  section_id: string;
  section_title: string;
  title: string;
  keywords: string[];
  source_file: string;
  updated_at: string;
  citation_count: number;
  match_count: number;
  session_count: number;
  last_cited: string | null;
}

export interface CitationRecord {
  id: number;
  rule_id: string;
  session_id: string;
  matched_keyword: string;
  timestamp: string;
  model: string | null;
  task_summary: string | null;
}

export interface CitationTimePoint {
  period: string;
  count: number;
}

export interface TopRule {
  rule_id: string;
  title: string;
  citation_count: number;
}

export interface ColdRule {
  rule_id: string;
  title: string;
  days_since_last_citation: number | null;
}

export interface CategoryDistribution {
  section_id: string;
  rule_count: number;
  citation_count: number;
}

export interface AnalyticsData {
  total_rules: number;
  total_citations: number;
  total_sessions: number;
  top_rules: TopRule[];
  cold_rules: ColdRule[];
  category_distribution: CategoryDistribution[];
}
