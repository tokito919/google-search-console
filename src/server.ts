import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// GSC tools
import {
  gscListSites,
  gscGetSearchPerformance,
  gscFindLowCtrPages,
  gscFindRisingQueries,
} from "./modules/gsc/tools.js";

// WordPress tools
import {
  wpListSites,
  wpListPosts,
  wpGetPost,
  wpUpdateRankMathMeta,
} from "./modules/wordpress/tools.js";

export function createServer(): Server {
  const server = new Server(
    { name: "seo-automation-center", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // -------------------------------------------------------------------------
  // Tool definitions
  // -------------------------------------------------------------------------

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // --- GSC ---
      {
        name: "gsc_list_sites",
        description:
          "Returns all Google Search Console sites the service account has access to. Use this first to discover valid site_url values for other GSC tools.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "gsc_get_search_performance",
        description:
          "Query Google Search Console for clicks, impressions, CTR, and average position. Supports filtering by page, query, country, and device. Groups results by any combination of dimensions.",
        inputSchema: {
          type: "object",
          required: ["site_url", "start_date", "end_date"],
          properties: {
            site_url: { type: "string", description: "Verified GSC site URL (from gsc_list_sites)" },
            start_date: { type: "string", description: "Start date YYYY-MM-DD" },
            end_date: { type: "string", description: "End date YYYY-MM-DD" },
            dimensions: {
              type: "array",
              items: { type: "string", enum: ["query", "page", "country", "device", "date"] },
              default: ["query"],
              description: "Dimensions to group results by",
            },
            row_limit: { type: "integer", default: 25, minimum: 1, maximum: 1000 },
            filter_page: { type: "string", description: "Filter to URLs containing this string" },
            filter_query: { type: "string", description: "Filter to queries containing this string" },
            filter_country: { type: "string", description: "ISO 3166-1 alpha-3 country code, e.g. 'bgr' for Bulgaria" },
            filter_device: { type: "string", enum: ["DESKTOP", "MOBILE", "TABLET"] },
          },
        },
      },
      {
        name: "gsc_find_low_ctr_pages",
        description:
          "Finds pages with high impressions but low click-through rate — quick-win SEO optimization targets. Returns pages ranked by impression volume that fall below the CTR threshold.",
        inputSchema: {
          type: "object",
          required: ["site_url", "start_date", "end_date"],
          properties: {
            site_url: { type: "string" },
            start_date: { type: "string", description: "Start date YYYY-MM-DD" },
            end_date: { type: "string", description: "End date YYYY-MM-DD" },
            min_impressions: { type: "integer", default: 100, description: "Minimum impressions to include" },
            max_ctr: { type: "number", default: 0.03, description: "CTR threshold (0.03 = 3%)" },
            row_limit: { type: "integer", default: 20, minimum: 1, maximum: 200 },
          },
        },
      },
      {
        name: "gsc_find_rising_queries",
        description:
          "Compares two date ranges to identify queries with significant impression or click growth. Great for spotting emerging topics and trending keywords.",
        inputSchema: {
          type: "object",
          required: ["site_url", "current_start", "current_end", "previous_start", "previous_end"],
          properties: {
            site_url: { type: "string" },
            current_start: { type: "string", description: "Current period start YYYY-MM-DD" },
            current_end: { type: "string", description: "Current period end YYYY-MM-DD" },
            previous_start: { type: "string", description: "Comparison period start YYYY-MM-DD" },
            previous_end: { type: "string", description: "Comparison period end YYYY-MM-DD" },
            metric: { type: "string", enum: ["impressions", "clicks"], default: "impressions" },
            min_current_impressions: { type: "integer", default: 10, description: "Minimum current impressions to reduce noise" },
            min_growth_pct: { type: "number", default: 20, description: "Minimum % growth to include" },
            row_limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
          },
        },
      },

      // --- WordPress ---
      {
        name: "wp_list_sites",
        description:
          "Returns all configured WordPress sites with their labels and base URLs. Use this to discover valid site_key values for other WP tools.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "wp_list_posts",
        description:
          "Lists posts or pages from a WordPress site. Returns ID, title, slug, status, date, and Rank Math SEO data.",
        inputSchema: {
          type: "object",
          required: ["site_key"],
          properties: {
            site_key: { type: "string", description: "Site identifier, e.g. WP_1 (from wp_list_sites)" },
            post_type: { type: "string", enum: ["posts", "pages"], default: "posts" },
            status: { type: "string", enum: ["publish", "draft", "pending", "private", "any"], default: "publish" },
            per_page: { type: "integer", default: 20, minimum: 1, maximum: 100 },
            page: { type: "integer", default: 1, minimum: 1 },
            search: { type: "string", description: "Search term to filter by title/content" },
            orderby: { type: "string", enum: ["date", "modified", "title", "relevance"], default: "date" },
            order: { type: "string", enum: ["asc", "desc"], default: "desc" },
          },
        },
      },
      {
        name: "wp_get_post",
        description:
          "Gets full details for a single WordPress post or page, including all Rank Math SEO meta fields: title, description, focus keyword, schema type, and SEO score.",
        inputSchema: {
          type: "object",
          required: ["site_key", "post_id"],
          properties: {
            site_key: { type: "string" },
            post_id: { type: "integer", description: "WordPress post or page ID" },
            post_type: { type: "string", enum: ["posts", "pages"], default: "posts" },
          },
        },
      },
      {
        name: "wp_update_rank_math_meta",
        description:
          "Updates Rank Math SEO meta fields for a WordPress post or page. All fields are optional — only include the ones to change. Returns updated values for confirmation.",
        inputSchema: {
          type: "object",
          required: ["site_key", "post_id"],
          properties: {
            site_key: { type: "string" },
            post_id: { type: "integer" },
            post_type: { type: "string", enum: ["posts", "pages"], default: "posts" },
            seo_title: { type: "string", maxLength: 60, description: "SEO title tag. Supports Rank Math variables like %title%, %sep%, %sitename%." },
            meta_description: { type: "string", maxLength: 160, description: "Meta description for search snippets." },
            focus_keyword: { type: "string", description: "Primary focus keyword. Comma-separate multiple keywords." },
            schema_type: {
              type: "string",
              enum: ["Article", "BlogPosting", "FAQPage", "HowTo", "Product", "Recipe", "Review", "WebPage", "off"],
              description: "Schema.org type. 'off' disables schema for this post.",
            },
            schema_data: {
              type: "object",
              description: "Additional schema properties as JSON.",
            },
          },
        },
      },
    ],
  }));

  // -------------------------------------------------------------------------
  // Tool dispatch
  // -------------------------------------------------------------------------

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    switch (name) {
      // GSC
      case "gsc_list_sites":
        return gscListSites();
      case "gsc_get_search_performance":
        return gscGetSearchPerformance(args as unknown as Parameters<typeof gscGetSearchPerformance>[0]);
      case "gsc_find_low_ctr_pages":
        return gscFindLowCtrPages(args as unknown as Parameters<typeof gscFindLowCtrPages>[0]);
      case "gsc_find_rising_queries":
        return gscFindRisingQueries(args as unknown as Parameters<typeof gscFindRisingQueries>[0]);

      // WordPress
      case "wp_list_sites":
        return wpListSites();
      case "wp_list_posts":
        return wpListPosts(args as unknown as Parameters<typeof wpListPosts>[0]);
      case "wp_get_post":
        return wpGetPost(args as unknown as Parameters<typeof wpGetPost>[0]);
      case "wp_update_rank_math_meta":
        return wpUpdateRankMathMeta(args as unknown as Parameters<typeof wpUpdateRankMathMeta>[0]);

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: "${name}"` }],
          isError: true,
        };
    }
  });

  return server;
}
