import { createClient, type User } from '@supabase/supabase-js'

// Public browser configuration only. NEVER place an Apple .p8 file, service-role key,
// signing secret, or any admin credential in a VITE_ environment variable.
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
export const supabase = url && publishableKey
  ? createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  : null

export function isCloudConfigured(): boolean { return !!supabase }

export async function sendEmailCode(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase ist noch nicht verbunden.')
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true }
  })
  if (error) throw error
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  if (!supabase) throw new Error('Supabase ist noch nicht verbunden.')
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(), token: code, type: 'email'
  })
  if (error) throw error
}

export async function signInWithApple(): Promise<void> {
  if (!supabase) throw new Error('Supabase ist noch nicht eingerichtet. Ergänze VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY.')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: new URL('/', window.location.origin).toString() }
  })
  if (error) throw error
}

export async function signOutApple(): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export type UniversityRow = { id: string; name: string }
export type DegreeCatalogRow = { id: string; university_id: string; name: string; level: string; target_credits: number }
export type ModuleCatalogRow = { id: string; degree_catalog_id: string; name: string; credits: number }
export type AccountRow = { user_id: string; email: string; created_at: string; premium: boolean }
export type FriendEvent = { title:string;from:string;to:string;room?:string;attending?:boolean }
export type FriendFeedItem = { friendId:string;alias:string;university:string;available:boolean;pausedUntil:string|null;current:FriendEvent|null;events:FriendEvent[];updatedAt:string }
export type FriendShareSettings = { enabled:boolean;shareFullDay:boolean;pausedUntil:string|null }
export type FriendRequest = { requesterId:string;email:string;direction:'incoming'|'outgoing' }

export async function fetchCatalog() {
  if (!supabase) return { universities: [] as UniversityRow[], degrees: [] as DegreeCatalogRow[], modules: [] as ModuleCatalogRow[] }
  const [universities, degrees, modules] = await Promise.all([
    supabase.from('university_catalog').select('id,name').order('name'),
    supabase.from('degree_catalog').select('id,university_id,name,level,target_credits').order('name'),
    supabase.from('module_catalog').select('id,degree_catalog_id,name,credits').order('name')
  ])
  const error = universities.error || degrees.error || modules.error
  if (error) throw error
  return {
    universities: (universities.data || []) as UniversityRow[],
    degrees: (degrees.data || []) as DegreeCatalogRow[],
    modules: (modules.data || []) as ModuleCatalogRow[]
  }
}

export async function isAdmin(user: User): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
  if (error) throw error
  return !!data
}

export async function cloudSave(userId: string, payload: unknown) {
  if (!supabase) throw new Error('Supabase ist nicht verbunden.')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== userId) throw new Error('Nicht angemeldet.')
  const { error } = await supabase.from('private_workspaces').upsert({ user_id: userId, payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function cloudLoad(userId: string): Promise<unknown | null> {
  if (!supabase) throw new Error('Supabase ist nicht verbunden.')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== userId) throw new Error('Nicht angemeldet.')
  const { data, error } = await supabase.from('private_workspaces').select('payload').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.payload ?? null
}

export async function fetchAdminAccounts(): Promise<AccountRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('uniflow_admin_accounts')
  if (error) throw error
  return (data || []) as AccountRow[]
}

export async function updatePremium(userId: string, premium: boolean) {
  if (!supabase) throw new Error('Supabase ist nicht verbunden.')
  const { error } = await supabase.rpc('admin_set_premium', { p_target: userId, p_premium: premium })
  if (error) throw error
}

/** Read the premium flag for the currently authenticated account only (RLS enforced). */
export async function fetchOwnPremium(): Promise<boolean> {
  if (!supabase) return false
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) return false
  const { data, error } = await supabase.from('account_directory').select('premium').eq('user_id',user.id).maybeSingle()
  if (error) throw error
  return data?.premium === true
}

export async function addFriendByEmail(email:string,alias:string):Promise<void>{
  if(!supabase)throw new Error('Supabase ist nicht verbunden.')
  const {error}=await supabase.rpc('uniflow_add_friend',{p_email:email.trim().toLowerCase(),p_alias:alias.trim()})
  if(error)throw error
}
export async function removeFriend(friendId:string):Promise<void>{
  if(!supabase)throw new Error('Supabase ist nicht verbunden.')
  const {error}=await supabase.rpc('uniflow_remove_friend',{p_friend:friendId})
  if(error)throw error
}
export async function acceptFriendRequest(requesterId:string,alias:string):Promise<void>{
  if(!supabase)throw new Error('Supabase ist nicht verbunden.')
  const {error}=await supabase.rpc('uniflow_accept_friend',{p_requester:requesterId,p_alias:alias.trim()})
  if(error)throw error
}
export async function fetchFriendFeed():Promise<{friends:FriendFeedItem[];requests:FriendRequest[];settings:FriendShareSettings}>{
  if(!supabase)throw new Error('Supabase ist nicht verbunden.')
  const [{data,error},{data:own,error:ownError}]=await Promise.all([
    supabase.rpc('uniflow_friend_feed'),supabase.from('friend_shares').select('enabled,share_full_day,paused_until').maybeSingle()
  ])
  if(error||ownError)throw error||ownError
  const {data:requestData,error:requestError}=await supabase.rpc('uniflow_friend_requests');if(requestError)throw requestError
  return {friends:((data||[]) as Array<Record<string,unknown>>).map(row=>({friendId:String(row.friend_id),alias:String(row.alias),university:String(row.university||''),available:row.available===true,pausedUntil:row.paused_until?String(row.paused_until):null,current:(row.current_event||null) as FriendEvent|null,events:Array.isArray(row.day_events)?row.day_events as FriendEvent[]:[],updatedAt:String(row.updated_at||new Date().toISOString())})),requests:((requestData||[]) as Array<Record<string,unknown>>).map(row=>({requesterId:String(row.requester_id),email:String(row.email||''),direction:row.direction==='outgoing'?'outgoing':'incoming'})),settings:{enabled:own?.enabled!==false,shareFullDay:own?.share_full_day===true,pausedUntil:own?.paused_until||null}}
}
export async function setFriendSharing(settings:FriendShareSettings):Promise<void>{
  if(!supabase)throw new Error('Supabase ist nicht verbunden.')
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Nicht angemeldet.')
  const {error}=await supabase.from('friend_shares').upsert({user_id:user.id,enabled:settings.enabled,share_full_day:settings.shareFullDay,paused_until:settings.pausedUntil,updated_at:new Date().toISOString()},{onConflict:'user_id'})
  if(error)throw error
}
export async function publishFriendStatus(snapshot:{university:string;current:FriendEvent|null;events:FriendEvent[]}):Promise<void>{
  if(!supabase)return
  const {data:{user}}=await supabase.auth.getUser();if(!user)return
  const {error}=await supabase.from('friend_shares').upsert({user_id:user.id,university:snapshot.university,current_event:snapshot.current,day_events:snapshot.events,updated_at:new Date().toISOString()},{onConflict:'user_id'})
  if(error)throw error
}
