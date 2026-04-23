import axios, { type AxiosInstance } from "axios";
import { config, type WpSiteConfig } from "../../config/env.js";

const clients = new Map<string, AxiosInstance>();

function buildBasicAuth(username: string, appPassword: string): string {
  // Application Passwords contain spaces — strip them before encoding.
  const credential = `${username}:${appPassword.replace(/\s/g, "")}`;
  return `Basic ${Buffer.from(credential).toString("base64")}`;
}

function createWpClient(site: WpSiteConfig): AxiosInstance {
  return axios.create({
    baseURL: `${site.url}/wp-json`,
    headers: {
      Authorization: buildBasicAuth(site.username, site.appPassword),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 20_000,
  });
}

// Initialize clients for all configured sites at startup.
for (const site of config.wpSites) {
  clients.set(site.siteKey, createWpClient(site));
}

/** Returns the axios instance for the given site key, or throws a clear error. */
export function getWpClient(siteKey: string): AxiosInstance {
  const client = clients.get(siteKey);
  if (!client) {
    const available = config.wpSites.map((s) => `${s.siteKey} (${s.label})`).join(", ");
    throw new Error(
      `Unknown site_key "${siteKey}". Available sites: ${available || "none configured"}`
    );
  }
  return client;
}

/** Returns the WpSiteConfig for the given site key. */
export function getWpSiteConfig(siteKey: string): WpSiteConfig {
  const site = config.wpSites.find((s) => s.siteKey === siteKey);
  if (!site) {
    const available = config.wpSites.map((s) => `${s.siteKey} (${s.label})`).join(", ");
    throw new Error(
      `Unknown site_key "${siteKey}". Available sites: ${available || "none configured"}`
    );
  }
  return site;
}
