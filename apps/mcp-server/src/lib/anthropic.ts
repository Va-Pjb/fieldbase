import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config.js'

export const MODEL = 'claude-sonnet-5'

let client: Anthropic | null = null

/** Anthropic client for crm_query. Throws a clean error if no key is set. */
export function getAnthropic(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured — the crm_query tool is unavailable.')
  }
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey })
  return client
}

export function isAnthropicConfigured(): boolean {
  return Boolean(config.anthropicApiKey)
}
