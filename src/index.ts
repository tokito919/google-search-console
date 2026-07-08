import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "http";
import { config } from "./config/env.js";
import { createServer } from "./server.js";

async function main() {
  const server = createServer();

  if (config.transport === "http") {
    // -------------------------------------------------------------------
    // HTTP transport — used for Railway deployment
    // -------------------------------------------------------------------
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    const httpServer = http.createServer(async (req, res) => {
      // Health check endpoint for Railway
      if (req.method === "GET" && req.url === "/health") {
        const body = JSON.stringify({
          status: "ok",
          sites: {
            gsc: config.gsc.sites.length,
            wordpress: config.wpSites.length,
          },
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(body);
        return;
      }

      // MCP endpoint
      if (req.url === "/mcp" || req.url?.startsWith("/mcp?")) {
        if (config.authToken) {
          const authHeader = req.headers["authorization"] ?? "";
          if (authHeader !== `Bearer ${config.authToken}`) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return;
          }
        }
        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    await server.connect(transport);

    httpServer.listen(config.port, "0.0.0.0", () => {
      console.error(
        `[SEO MCP Server] HTTP transport running on 0.0.0.0:${config.port}\n` +
          `  MCP endpoint : http://0.0.0.0:${config.port}/mcp\n` +
          `  Health check : http://0.0.0.0:${config.port}/health\n` +
          `  GSC sites    : ${config.gsc.sites.length}\n` +
          `  WP sites     : ${config.wpSites.length}`
      );
    });
  } else {
    // -------------------------------------------------------------------
    // Stdio transport — used for Claude Desktop
    // -------------------------------------------------------------------
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(
      `[SEO MCP Server] Stdio transport ready.\n` +
        `  GSC sites : ${config.gsc.sites.length}\n` +
        `  WP sites  : ${config.wpSites.length}`
    );
  }
}

main().catch((err) => {
  console.error("[SEO MCP Server] Fatal startup error:", err);
  process.exit(1);
});
