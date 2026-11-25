import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const MCP_SCOPES = ['workspace:read', 'workspace:propose'] as const
export type McpScope = typeof MCP_SCOPES[number]
export type McpGrant = { id:string;user_id:string;scopes:McpScope[] }
export const tokenHash = (token:string) => createHash('sha256').update(token).digest('hex')
export function mcpDatabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('MCP server configuration missing')
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
}
export function bearer(req:VercelRequest) {
  const header = req.headers.authorization
  return typeof header === 'string' && /^Bearer /i.test(header) ? header.slice(7).trim() : ''
}
export function prepareMcpRequest(req:VercelRequest,res:VercelResponse) {
  res.setHeader('Cache-Control','no-store')
  res.setHeader('X-Content-Type-Options','nosniff')
  if (process.env.UNIFLOW_MCP_ENABLED !== 'true') { res.status(404).json({error:'MCP is not enabled.'}); return false }
  const origin = req.headers.origin
  const allowed = (process.env.UNIFLOW_MCP_ALLOWED_ORIGINS || '').split(',').map(value=>value.trim()).filter(Boolean)
  if (origin && (typeof origin !== 'string' || !allowed.includes(origin))) { res.status(403).json({error:'Origin not allowed.'}); return false }
  if (origin) { res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin') }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, MCP-Protocol-Version')
    res.setHeader('Access-Control-Allow-Methods','POST, GET, DELETE, OPTIONS')
    res.status(204).end();return false
  }
  return true
}
export async function authenticateMcp(req:VercelRequest):Promise<McpGrant|null> {
  const token=bearer(req)
  // Workspace session tokens and service credentials are never accepted as MCP keys.
  if (!/^uf_mcp_[A-Za-z0-9_-]{43}$/.test(token)) return null
  const database=mcpDatabase()
  const {data,error}=await database.from('uniflow_mcp_tokens').select('id,user_id,scopes')
    .eq('token_hash',tokenHash(token)).is('revoked_at',null).gt('expires_at',new Date().toISOString()).maybeSingle()
  if(error)throw error
  if(!data)return null
  // Atomic per-key throttle across serverless instances, not an in-memory counter.
  const {data:allowed,error:rateError}=await database.rpc('uniflow_mcp_consume_request',{p_token_id:data.id})
  if(rateError)throw rateError
  if(!allowed)throw new McpRateLimitError()
  return data as McpGrant
}
export class McpRateLimitError extends Error {}
