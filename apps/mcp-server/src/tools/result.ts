import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

/** Success result: pretty-printed JSON payload. */
export function ok(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

/** Error result: a tool-level error (not a transport crash). */
export function fail(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

export function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
