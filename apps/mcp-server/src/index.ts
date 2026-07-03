import { randomUUID } from 'node:crypto'
import express, { type Request, type Response } from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { createFieldBaseMcpServer } from './server.js'

const app = express()
app.use(express.json())

// One transport per MCP session, keyed by the mcp-session-id header.
const transports: Record<string, StreamableHTTPServerTransport> = {}

app.post('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  let transport: StreamableHTTPServerTransport
  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId]
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New session: spin up a transport + server and register it once initialized.
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        transports[sid] = transport
      },
    })
    transport.onclose = () => {
      if (transport.sessionId) delete transports[transport.sessionId]
    }
    await createFieldBaseMcpServer().connect(transport)
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: no valid session ID provided' },
      id: null,
    })
    return
  }

  await transport.handleRequest(req, res, req.body)
})

// GET (server->client SSE stream) and DELETE (session teardown) reuse the session.
async function handleSessionRequest(req: Request, res: Response) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }
  await transports[sessionId].handleRequest(req, res)
}

app.get('/mcp', handleSessionRequest)
app.delete('/mcp', handleSessionRequest)

app.get('/', (_req: Request, res: Response) => {
  res.type('text/plain').send('FieldBase MCP server. Connect an MCP client to POST /mcp.')
})

const PORT = Number(process.env.PORT ?? 3000)
app.listen(PORT, () => {
  console.log(`[fieldbase-mcp] streamable HTTP server listening on http://localhost:${PORT}/mcp`)
})
