import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  // Dedicated demo user the server signs in as; all operations are RLS-scoped
  // to this user. No service-role key — the server is safe to expose.
  DEMO_USER_EMAIL: z.string().email(),
  DEMO_USER_PASSWORD: z.string().min(1),
  // Required only by crm_query.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  PORT: z.coerce.number().default(3000),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error(
    '[fieldbase-mcp] invalid environment:',
    JSON.stringify(parsed.error.flatten().fieldErrors),
  )
  console.error('Copy apps/mcp-server/.env.example to .env and fill it in.')
  process.exit(1)
}

export const config = {
  supabaseUrl: parsed.data.SUPABASE_URL,
  supabaseAnonKey: parsed.data.SUPABASE_ANON_KEY,
  demoUserEmail: parsed.data.DEMO_USER_EMAIL,
  demoUserPassword: parsed.data.DEMO_USER_PASSWORD,
  anthropicApiKey: parsed.data.ANTHROPIC_API_KEY,
  port: parsed.data.PORT,
}
