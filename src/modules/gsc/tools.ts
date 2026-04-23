import { gscClient, assertSiteAllowed } from "./client.js";
import { config } from "../../config/env.js";
import { errorResult } from "../../utils/errors.js";
import type {
  GscPerformanceResult,
  GscRow,
  LowCtrResult,
  LowCtrPage,
  RisingQueriesResult,
  RisingQuery,
} from "./types.js";

// ---------------------------------------------------------------------------
// Tool: gsc_list_sites
// ---------------------------------------------------------------------------

export async function gscListSites() {
  try {
    const response = await gscClient.sites.list();
    const allSites = response.data.siteEntry ?? [];

    // Only expose sites the server is configured to access.
    const configured = new Set(config.gsc.sites);
    const filtered = allSites
      .filter((s) => s.siteUrl && configured.has(s.siteUrl))
      .map((s) => ({ url: s.siteUrl, permission_level: s.permissionLevel }));

    const text = JSON.stringify({ configured_sites: filtered, total: filtered.length }, null, 2);
    return { content: [{ type: "text" as const, text }] };
  } catch (error) {
    return errorResult("gsc_list_sites", error);
  }
}

// ---------------------------------------------------------------------------
// Tool: gsc_get_search_performance
// ---------------------------------------------------------------------------

interface SearchPerformanceArgs {
  site_url: string;
  start_date: string;
  end_date: string;
  dimensions?: string[];
  row_limit?: number;
  filter_page?: string;
  filter_query?: string;
  filter_country?: string;
  filter_device?: string;
}

export async function gscGetSearchPerformance(args: SearchPerformanceArgs) {
  try {
    assertSiteAllowed(args.site_url);

    const dimensions = args.dimensions ?? ["query"];
    const rowLimit = args.row_limit ?? 25;

    // Build dimension filter groups
    const dimensionFilterGroups = [];
    if (args.filter_page) {
      dimensionFilterGroups.push({
        filters: [{ dimension: "page", operator: "contains", expression: args.filter_page }],
      });
    }
    if (args.filter_query) {
      dimensionFilterGroups.push({
        filters: [{ dimension: "query", operator: "contains", expression: args.filter_query }],
      });
    }
    if (args.filter_country) {
      dimensionFilterGroups.push({
        filters: [{ dimension: "country", operator: "equals", expression: args.filter_country.toLowerCase() }],
      });
    }
    if (args.filter_device) {
      dimensionFilterGroups.push({
        filters: [{ dimension: "device", operator: "equals", expression: args.filter_device.toLowerCase() }],
      });
    }

    const response = await gscClient.searchanalytics.query({
      siteUrl: args.site_url,
      requestBody: {
        startDate: args.start_date,
        endDate: args.end_date,
        dimensions,
        rowLimit,
        ...(dimensionFilterGroups.length > 0 && { dimensionFilterGroups }),
      },
    });

    const rows: GscRow[] = (response.data.rows ?? []).map((r) => ({
      keys: r.keys ?? [],
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    }));

    const result: GscPerformanceResult = {
      site_url: args.site_url,
      start_date: args.start_date,
      end_date: args.end_date,
      dimensions,
      rows,
      row_count: rows.length,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return errorResult("gsc_get_search_performance", error);
  }
}

// ---------------------------------------------------------------------------
// Tool: gsc_find_low_ctr_pages
// ---------------------------------------------------------------------------

interface LowCtrArgs {
  site_url: string;
  start_date: string;
  end_date: string;
  min_impressions?: number;
  max_ctr?: number;
  row_limit?: number;
}

export async function gscFindLowCtrPages(args: LowCtrArgs) {
  try {
    assertSiteAllowed(args.site_url);

    const minImpressions = args.min_impressions ?? 100;
    const maxCtr = args.max_ctr ?? 0.03;
    const rowLimit = args.row_limit ?? 20;

    // Fetch a large batch grouped by page so we can filter client-side.
    const response = await gscClient.searchanalytics.query({
      siteUrl: args.site_url,
      requestBody: {
        startDate: args.start_date,
        endDate: args.end_date,
        dimensions: ["page"],
        rowLimit: 1000, // fetch plenty, filter down
      },
    });

    const pages: LowCtrPage[] = (response.data.rows ?? [])
      .filter((r) => (r.impressions ?? 0) >= minImpressions && (r.ctr ?? 0) < maxCtr)
      .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
      .slice(0, rowLimit)
      .map((r) => ({
        page: r.keys?.[0] ?? "",
        impressions: r.impressions ?? 0,
        clicks: r.clicks ?? 0,
        ctr: r.ctr ?? 0,
        ctr_pct: `${((r.ctr ?? 0) * 100).toFixed(2)}%`,
        position: Math.round((r.position ?? 0) * 10) / 10,
        ctr_gap: Math.round((maxCtr - (r.ctr ?? 0)) * 10000) / 100, // pp below threshold
      }));

    const result: LowCtrResult = {
      site_url: args.site_url,
      period: `${args.start_date} to ${args.end_date}`,
      min_impressions: minImpressions,
      max_ctr_threshold: maxCtr,
      pages,
      total_found: pages.length,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return errorResult("gsc_find_low_ctr_pages", error);
  }
}

// ---------------------------------------------------------------------------
// Tool: gsc_find_rising_queries
// ---------------------------------------------------------------------------

interface RisingQueriesArgs {
  site_url: string;
  current_start: string;
  current_end: string;
  previous_start: string;
  previous_end: string;
  metric?: "impressions" | "clicks";
  min_current_impressions?: number;
  min_growth_pct?: number;
  row_limit?: number;
}

export async function gscFindRisingQueries(args: RisingQueriesArgs) {
  try {
    assertSiteAllowed(args.site_url);

    const metric = args.metric ?? "impressions";
    const minCurrentImpressions = args.min_current_impressions ?? 10;
    const minGrowthPct = args.min_growth_pct ?? 20;
    const rowLimit = args.row_limit ?? 20;

    // Two parallel API calls — one per period.
    const [currentResp, previousResp] = await Promise.all([
      gscClient.searchanalytics.query({
        siteUrl: args.site_url,
        requestBody: {
          startDate: args.current_start,
          endDate: args.current_end,
          dimensions: ["query"],
          rowLimit: 1000,
        },
      }),
      gscClient.searchanalytics.query({
        siteUrl: args.site_url,
        requestBody: {
          startDate: args.previous_start,
          endDate: args.previous_end,
          dimensions: ["query"],
          rowLimit: 1000,
        },
      }),
    ]);

    // Build lookup map for previous period.
    const previousMap = new Map<string, { impressions: number; clicks: number }>();
    for (const row of previousResp.data.rows ?? []) {
      const query = row.keys?.[0];
      if (query) {
        previousMap.set(query, {
          impressions: row.impressions ?? 0,
          clicks: row.clicks ?? 0,
        });
      }
    }

    const rising: RisingQuery[] = [];
    const newQueries: string[] = [];

    for (const row of currentResp.data.rows ?? []) {
      const query = row.keys?.[0];
      if (!query) continue;

      const currentImpressions = row.impressions ?? 0;
      const currentClicks = row.clicks ?? 0;

      if (currentImpressions < minCurrentImpressions) continue;

      const prev = previousMap.get(query);

      if (!prev) {
        newQueries.push(query);
        continue;
      }

      const currentVal = metric === "impressions" ? currentImpressions : currentClicks;
      const previousVal = metric === "impressions" ? prev.impressions : prev.clicks;

      if (previousVal === 0) continue; // avoid division by zero

      const growthPct = ((currentVal - previousVal) / previousVal) * 100;
      if (growthPct < minGrowthPct) continue;

      rising.push({
        query,
        current_impressions: currentImpressions,
        previous_impressions: prev.impressions,
        growth_pct: Math.round(growthPct * 10) / 10,
        current_clicks: currentClicks,
        current_ctr: row.ctr ?? 0,
        current_position: Math.round((row.position ?? 0) * 10) / 10,
      });
    }

    // Sort by growth percentage descending, take top N.
    rising.sort((a, b) => b.growth_pct - a.growth_pct);
    const result: RisingQueriesResult = {
      site_url: args.site_url,
      current_period: `${args.current_start} to ${args.current_end}`,
      previous_period: `${args.previous_start} to ${args.previous_end}`,
      metric,
      rising: rising.slice(0, rowLimit),
      new_queries: newQueries.slice(0, rowLimit),
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return errorResult("gsc_find_rising_queries", error);
  }
}
