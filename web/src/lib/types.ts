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

export interface SectionWithStats {
  section_id: string;
  title: string;
  source_file: string;
  rule_count: number;
  total_citations: number;
  total_sessions: number;
}

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
  session_coverage: number;  // session_count / total_sessions (0-1)
  avg_depth: number;         // match_count / session_count (0+)
  citation_share: number;    // match_count / total_citations (0-1)
}

export interface CitationRecord {
  id: number;
  rule_id: string;
  session_id: string;
  matched_keyword: string;
  confidence: string;
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
  session_coverage: number;
  avg_depth: number;
}

export interface ColdRule {
  rule_id: string;
  title: string;
  section_id: string;
  citation_count: number;
  session_count: number;
  last_cited: string | null;
}

export interface CategoryDistribution {
  section_id: string;
  title: string;
  rule_count: number;
  citation_count: number;
}

export interface ConfidenceDistribution {
  confidence: string;
  count: number;
  top_rules: ConfidenceRuleEntry[];
}

export interface ConfidenceRuleEntry {
  rule_id: string;
  title: string;
  count: number;
}

export interface AnalyticsData {
  total_rules: number;
  total_citations: number;
  total_sessions: number;
  avg_coverage: number;
  avg_depth: number;
  top_rules: TopRule[];
  cold_rules: ColdRule[];
  category_distribution: CategoryDistribution[];
  citation_trend: CitationTimePoint[];
  heatmap: HeatmapCell[];
  confidence_distribution: ConfidenceDistribution[];
}

export interface RuleDetail {
  rule_id: string;
  section_id: string;
  section_title: string;
  title: string;
  keywords: string[];
  source_file: string;
  updated_at: string;
  citation_count: number;
  last_cited: string | null;
  body?: string;
}

export interface RecentCitation {
  rule_id: string;
  title: string;
  section_id: string;
  matched_keyword: string;
  timestamp: string;
  session_id: string;
  model: string | null;
  confidence: string;
}

export interface SiblingRule {
  rule_id: string;
  title: string;
  match_count: number;
  session_count: number;
  session_coverage: number;
  avg_depth: number;
}

export interface CoOccurringRule {
  rule_id: string;
  title: string;
  section_id: string;
  co_sessions: number;
}

export interface HeatmapCell {
  rule_id: string;
  title: string;
  section_id: string;
  day: string;
  count: number;
}
