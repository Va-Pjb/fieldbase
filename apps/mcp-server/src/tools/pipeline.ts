import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as deals from '../data/deals.js'
import { fail, msg, ok } from './result.js'

export function registerPipelineTools(server: McpServer) {
  server.registerTool(
    'crm_get_pipeline',
    {
      title: 'Get pipeline',
      description:
        'Get the deal pipeline grouped by stage, with per-stage counts and value totals plus open/won totals.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        return ok(await deals.getPipeline())
      } catch (e) {
        return fail(`Failed to get pipeline: ${msg(e)}`)
      }
    },
  )
}
