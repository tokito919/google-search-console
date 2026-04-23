import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema definitions
// ---------------------------------------------------------------------------

const GscConfigSchema = z.object({
  clientEmail: z.string().email("GSC_CLIENT_EMAIL must be a valid email"),
  privateKey: z.string().min(100, "GSC_PRIVATE_KEY appears to be missing or truncated"),
  projectId: z.string().min(1, "GSC_PROJECT_ID is required"),
  sites: z.array(z.string().min(1)).min(1, "GSC_SITES must contain at least one site URL"),
});

const WpSiteConfigSchema = z.object({
  siteKey: z.string(),
  label: z.string(),
  url: z.string().url("WP site URL must be a valid URL"),
  username: z.string().min(1),
  appPassword: z.string().min(1),
});

const AppConfigSchema = z.object({
  gsc: GscConfigSchema,
  wpSites: z.array(WpSiteConfigSchema).min(1, "At least one WordPress site (WP_1_*) must be configured"),
  transport: z.enum(["stdio", "http"]),
  port: z.number().int().positive(),
  logLevel: z.enum(["debug", "info", "warn", "error"]),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GscConfig = z.infer<typeof GscConfigSchema>;
export type WpSiteConfig = z.infer<typeof WpSiteConfigSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

function loadConfig(): AppConfig {
  const env = process.env;

  // --- GSC ---
  const rawPrivateKey = env.GSC_PRIVATE_KEY ?? "";
  // Allow Railway to store the key with literal \n and resolve them here.
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  const rawSites = env.GSC_SITES ?? "";
  const sites = rawSites
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // --- WordPress sites (WP_1 through WP_5) ---
  const wpSites: WpSiteConfig[] = [];
  for (let i = 1; i <= 5; i++) {
    const prefix = `WP_${i}`;
    const url = env[`${prefix}_URL`];
    if (!url) continue; // site not configured — skip

    wpSites.push({
      siteKey: prefix,
      label: env[`${prefix}_LABEL`] ?? `WordPress Site ${i}`,
      url: url.replace(/\/$/, ""), // strip trailing slash
      username: env[`${prefix}_USERNAME`] ?? "",
      appPassword: env[`${prefix}_APP_PASSWORD`] ?? "",
    });
  }

  const rawConfig = {
    gsc: {
      clientEmail: env.GSC_CLIENT_EMAIL ?? "",
      privateKey,
      projectId: env.GSC_PROJECT_ID ?? "",
      sites,
    },
    wpSites,
    transport: (env.MCP_TRANSPORT ?? "stdio") as "stdio" | "http",
    port: parseInt(env.PORT ?? "3000", 10),
    logLevel: (env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error",
  };

  const result = AppConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    const messages = result.error.errors
      .map((e) => `  • ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`[SEO MCP Server] Configuration error — check your environment variables:\n${messages}`);
  }

  return result.data;
}

// Singleton — loaded once at startup.
export const config: AppConfig = loadConfig();
