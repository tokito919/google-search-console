import { getWpClient, getWpSiteConfig } from "./client.js";
import { config } from "../../config/env.js";
import { errorResult } from "../../utils/errors.js";
import type {
  WpPost,
  PostSummary,
  PostDetail,
  PostListResult,
  RankMathMeta,
  UpdateMetaResult,
} from "./types.js";
import type { AxiosResponse } from "axios";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractRankMathMeta(meta: Record<string, unknown> | undefined): RankMathMeta {
  return {
    title: (meta?.rank_math_title as string) ?? null,
    description: (meta?.rank_math_description as string) ?? null,
    focus_keyword: (meta?.rank_math_focus_keyword as string) ?? null,
    schema_type: (meta?.rank_math_schema_type as string) ?? null,
    seo_score: (meta?.rank_math_seo_score as number) ?? null,
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function postEndpoint(postType: string): string {
  return postType === "pages" ? "/wp/v2/pages" : "/wp/v2/posts";
}

// ---------------------------------------------------------------------------
// Tool: wp_list_sites
// ---------------------------------------------------------------------------

export function wpListSites() {
  const sites = config.wpSites.map((s) => ({
    site_key: s.siteKey,
    label: s.label,
    url: s.url,
  }));
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ sites, total: sites.length }, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// Tool: wp_list_posts
// ---------------------------------------------------------------------------

interface ListPostsArgs {
  site_key: string;
  post_type?: string;
  status?: string;
  per_page?: number;
  page?: number;
  search?: string;
  orderby?: string;
  order?: string;
}

export async function wpListPosts(args: ListPostsArgs) {
  try {
    const site = getWpSiteConfig(args.site_key);
    const client = getWpClient(args.site_key);

    const postType = args.post_type ?? "posts";
    const params: Record<string, unknown> = {
      status: args.status ?? "publish",
      per_page: args.per_page ?? 20,
      page: args.page ?? 1,
      orderby: args.orderby ?? "date",
      order: args.order ?? "desc",
      context: "edit", // required to get meta fields
      _fields: "id,date,modified,slug,status,link,title,meta,excerpt",
    };
    if (args.search) params.search = args.search;

    const response: AxiosResponse<WpPost[]> = await client.get(postEndpoint(postType), { params });

    const total = parseInt(response.headers["x-wp-total"] ?? "0", 10);
    const totalPages = parseInt(response.headers["x-wp-totalpages"] ?? "1", 10);

    const posts: PostSummary[] = response.data.map((post) => {
      const rm = extractRankMathMeta(post.meta);
      return {
        id: post.id,
        title: stripHtml(post.title.rendered),
        slug: post.slug,
        status: post.status,
        date: post.date,
        modified: post.modified,
        link: post.link,
        post_type: postType,
        rank_math: {
          title: rm.title,
          description: rm.description,
          focus_keyword: rm.focus_keyword,
          seo_score: rm.seo_score,
        },
      };
    });

    const result: PostListResult = {
      site_key: args.site_key,
      site_label: site.label,
      site_url: site.url,
      post_type: postType,
      posts,
      total,
      total_pages: totalPages,
      current_page: args.page ?? 1,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return errorResult("wp_list_posts", error);
  }
}

// ---------------------------------------------------------------------------
// Tool: wp_get_post
// ---------------------------------------------------------------------------

interface GetPostArgs {
  site_key: string;
  post_id: number;
  post_type?: string;
}

export async function wpGetPost(args: GetPostArgs) {
  try {
    getWpSiteConfig(args.site_key); // validate site key
    const client = getWpClient(args.site_key);

    const postType = args.post_type ?? "posts";
    const response: AxiosResponse<WpPost> = await client.get(
      `${postEndpoint(postType)}/${args.post_id}`,
      { params: { context: "edit" } }
    );

    const post = response.data;
    const rm = extractRankMathMeta(post.meta);

    const detail: PostDetail = {
      id: post.id,
      title: stripHtml(post.title.rendered),
      slug: post.slug,
      status: post.status,
      date: post.date,
      modified: post.modified,
      link: post.link,
      post_type: postType,
      content_length: stripHtml(post.content.rendered).length,
      excerpt: stripHtml(post.excerpt.rendered),
      rank_math: rm,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(detail, null, 2) }] };
  } catch (error) {
    return errorResult("wp_get_post", error);
  }
}

// ---------------------------------------------------------------------------
// Tool: wp_update_rank_math_meta
// ---------------------------------------------------------------------------

interface UpdateMetaArgs {
  site_key: string;
  post_id: number;
  post_type?: string;
  seo_title?: string;
  meta_description?: string;
  focus_keyword?: string;
  schema_type?: string;
  schema_data?: Record<string, unknown>;
}

export async function wpUpdateRankMathMeta(args: UpdateMetaArgs) {
  try {
    getWpSiteConfig(args.site_key); // validate site key
    const client = getWpClient(args.site_key);

    const postType = args.post_type ?? "posts";
    const endpoint = `${postEndpoint(postType)}/${args.post_id}`;

    // Build the meta object — only include fields that were explicitly provided.
    const meta: Record<string, unknown> = {};
    const updatedFields: string[] = [];

    if (args.seo_title !== undefined) {
      meta.rank_math_title = args.seo_title;
      updatedFields.push("seo_title");
    }
    if (args.meta_description !== undefined) {
      meta.rank_math_description = args.meta_description;
      updatedFields.push("meta_description");
    }
    if (args.focus_keyword !== undefined) {
      meta.rank_math_focus_keyword = args.focus_keyword;
      updatedFields.push("focus_keyword");
    }
    if (args.schema_type !== undefined) {
      meta.rank_math_schema_type = args.schema_type;
      updatedFields.push("schema_type");
    }
    if (args.schema_data !== undefined) {
      meta.rank_math_schema = args.schema_data;
      updatedFields.push("schema_data");
    }

    if (updatedFields.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No fields provided to update. Specify at least one of: seo_title, meta_description, focus_keyword, schema_type, schema_data." }],
        isError: true,
      };
    }

    // Send the update.
    await client.post(endpoint, { meta });

    // Read back to confirm saved values.
    const readback: AxiosResponse<WpPost> = await client.get(endpoint, {
      params: { context: "edit" },
    });

    const rm = extractRankMathMeta(readback.data.meta);

    const result: UpdateMetaResult = {
      site_key: args.site_key,
      post_id: args.post_id,
      updated_fields: updatedFields,
      rank_math: rm,
      success: true,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return errorResult("wp_update_rank_math_meta", error);
  }
}
