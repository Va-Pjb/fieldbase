import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerAutomationTools } from './tools/automation.js'
import { registerContactTools } from './tools/contacts.js'
import { registerInteractionTools } from './tools/interactions.js'
import { registerMigrationTools } from './tools/migration.js'
import { registerPipelineTools } from './tools/pipeline.js'
import { registerQueryTool } from './tools/query.js'

/**
 * Builds the FieldBase MCP server. Tools are registered per domain module.
 * All operations run through the RLS-scoped demo client (see lib/supabase.ts).
 */
export function createFieldBaseMcpServer(): McpServer {
  const server = new McpServer({ name: 'fieldbase-mcp', version: '0.0.0' })
  registerContactTools(server)
  registerInteractionTools(server)
  registerPipelineTools(server)
  registerQueryTool(server)
  registerMigrationTools(server)
  registerAutomationTools(server)
  return server
}
