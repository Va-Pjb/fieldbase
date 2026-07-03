import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerContactTools } from './tools/contacts.js'

/**
 * Builds the FieldBase MCP server. Tools are registered per domain module.
 * All operations run through the RLS-scoped demo client (see lib/supabase.ts).
 */
export function createFieldBaseMcpServer(): McpServer {
  const server = new McpServer({ name: 'fieldbase-mcp', version: '0.0.0' })
  registerContactTools(server)
  return server
}
