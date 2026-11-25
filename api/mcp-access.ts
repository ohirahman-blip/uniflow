import { randomBytes } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { bearer, mcpDatabase, MCP_SCOPES, prepareMcpRequest, tokenHash, type McpScope } from '../server/mcp/access.js'

/** First-party management only: verified Supabase session, never an MCP key. */
export default async function handler(req:VercelRequest,res:VercelResponse) {
  if(!prepareMcpRequest(req,res))return
  if(!['GET','POST','DELETE'].includes(req.method||'')){res.setHeader('Allow','GET, POST, DELETE, OPTIONS');return res.status(405).end()}
  try {
    const database=mcpDatabase()
    const token=bearer(req)
    if(!token)return res.status(401).json({error:'Sign in to manage connections.'})
    const {data:auth,error:authError}=await database.auth.getUser(token)
    if(authError||!auth.user)return res.status(401).json({error:'Sign in to manage connections.'})
    const owner=auth.user.id
    if(req.method==='GET') {
      const {data,error}=await database.from('uniflow_mcp_tokens').select('id,label,token_prefix,scopes,created_at,expires_at,last_used_at,revoked_at').eq('user_id',owner).order('created_at',{ascending:false}).limit(100)
      if(error)throw error
      return res.json({connections:data})
    }
    if(!String(req.headers['content-type']||'').includes('application/json'))return res.status(415).json({error:'Use application/json.'})
    let body:Record<string,unknown>
    try{body=typeof req.body==='string'?JSON.parse(req.body):req.body}catch{return res.status(400).json({error:'Invalid JSON.'})}
    if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'Invalid request.'})
    if(req.method==='DELETE') {
      if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id))return res.status(400).json({error:'Invalid connection ID.'})
      const {data,error}=await database.from('uniflow_mcp_tokens').update({revoked_at:new Date().toISOString()}).eq('user_id',owner).eq('id',body.id).select('id').maybeSingle()
      if(error)throw error
      return res.status(data?200:404).json({revoked:!!data})
    }
    const scopes=body.scopes??['workspace:read']
    const days=body.expiresInDays??30
    if(typeof body.label!=='string'||!body.label.trim()||body.label.length>80||!Array.isArray(scopes)||!scopes.length||scopes.length>2||!scopes.every(value=>MCP_SCOPES.includes(value as McpScope))||!Number.isInteger(days)||Number(days)<1||Number(days)>90)return res.status(400).json({error:'Provide a label, valid scopes and expiry of 1–90 days.'})
    const key='uf_mcp_'+randomBytes(32).toString('base64url')
    const {data,error}=await database.from('uniflow_mcp_tokens').insert({user_id:owner,label:body.label.trim(),token_hash:tokenHash(key),token_prefix:key.slice(0,15),scopes:[...new Set(scopes)],expires_at:new Date(Date.now()+Number(days)*86400000).toISOString()}).select('id,label,scopes,expires_at').single()
    if(error)throw error
    return res.status(201).json({...data,token:key,message:'Copy this key now. It is only returned once.'})
  }catch{return res.status(503).json({error:'Connection management is not ready. Complete the MCP server setup first.'})}
}
