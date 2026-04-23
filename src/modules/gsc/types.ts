export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPerformanceResult {
  site_url: string;
  start_date: string;
  end_date: string;
  dimensions: string[];
  rows: GscRow[];
  row_count: number;
}

export interface LowCtrPage {
  page: string;
  impressions: number;
  clicks: number;
  ctr: number;
  ctr_pct: string;
  position: number;
  ctr_gap: number;
}

export interface LowCtrResult {
  site_url: string;
  period: string;
  min_impressions: number;
  max_ctr_threshold: number;
  pages: LowCtrPage[];
  total_found: number;
}

export interface RisingQuery {
  query: string;
  current_impressions: number;
  previous_impressions: number;
  growth_pct: number;
  current_clicks: number;
  current_ctr: number;
  current_position: number;
}

export interface RisingQueriesResult {
  site_url: string;
  current_period: string;
  previous_period: string;
  metric: string;
  rising: RisingQuery[];
  new_queries: string[];
}
