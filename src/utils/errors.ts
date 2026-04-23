import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { AxiosError } from "axios";

/** Wraps any thrown value into a user-readable MCP error string. */
export function formatToolError(toolName: string, error: unknown): string {
  if (error instanceof McpError) {
    return `[${toolName}] MCP error ${error.code}: ${error.message}`;
  }

  if (isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    const detail =
      typeof data === "object" && data !== null
        ? JSON.stringify(data).slice(0, 300)
        : String(data ?? "").slice(0, 300);
    return `[${toolName}] HTTP ${status ?? "unknown"} from ${error.config?.url ?? "unknown URL"}: ${detail}`;
  }

  if (error instanceof Error) {
    return `[${toolName}] ${error.message}`;
  }

  return `[${toolName}] Unknown error: ${String(error)}`;
}

/** Re-throws validation/config errors as MCP InvalidParams errors. */
export function throwInvalidParam(field: string, message: string): never {
  throw new McpError(ErrorCode.InvalidParams, `${field}: ${message}`);
}

/** Returns a structured MCP tool result with isError=true. */
export function errorResult(toolName: string, error: unknown) {
  return {
    content: [{ type: "text" as const, text: formatToolError(toolName, error) }],
    isError: true,
  };
}

function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === "object" &&
    error !== null &&
    "isAxiosError" in error &&
    (error as Record<string, unknown>).isAxiosError === true
  );
}
