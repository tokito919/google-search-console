export interface RankMathMeta {
  title: string | null;
  description: string | null;
  focus_keyword: string | null;
  schema_type: string | null;
  seo_score: number | null;
}

export interface PostSummary {
  id: number;
  title: string;
  slug: string;
  status: string;
  date: string;
  modified: string;
  link: string;
  post_type: string;
  rank_math: Pick<RankMathMeta, "title" | "description" | "focus_keyword" | "seo_score">;
}

export interface PostDetail extends PostSummary {
  content_length: number;
  excerpt: string;
  rank_math: RankMathMeta;
}

export interface PostListResult {
  site_key: string;
  site_label: string;
  site_url: string;
  post_type: string;
  posts: PostSummary[];
  total: number;
  total_pages: number;
  current_page: number;
}

export interface UpdateMetaResult {
  site_key: string;
  post_id: number;
  updated_fields: string[];
  rank_math: RankMathMeta;
  success: boolean;
}

// Raw WP REST API shapes (partial — only the fields we use)
export interface WpPost {
  id: number;
  date: string;
  modified: string;
  slug: string;
  status: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  meta?: Record<string, unknown>;
}
