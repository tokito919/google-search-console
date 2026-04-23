import { google } from "googleapis";
import type { webmasters_v3 } from "googleapis";
import { config } from "../../config/env.js";

// Scopes required — readonly is sufficient for all current tools.
const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

function createGscClient(): webmasters_v3.Webmasters {
  const auth = new google.auth.JWT({
    email: config.gsc.clientEmail,
    key: config.gsc.privateKey,
    scopes: SCOPES,
  });

  return google.webmasters({ version: "v3", auth });
}

// Singleton — one authenticated client for the lifetime of the process.
export const gscClient = createGscClient();

/** Validates that a site_url is in the configured whitelist. */
export function assertSiteAllowed(siteUrl: string): void {
  if (!config.gsc.sites.includes(siteUrl)) {
    throw new Error(
      `Site "${siteUrl}" is not in the configured GSC_SITES list.\n` +
        `Allowed sites: ${config.gsc.sites.join(", ")}`
    );
  }
}
