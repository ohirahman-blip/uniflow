import type { McpGrant, McpScope } from './access.js'
import { mcpDatabase } from './access.js'

type Row=Record<string,unknown>
type Workspace={modules?:Row[];semesters?:Row[];offerings?:Row[];assessments?:Row[];studyTasks?:Row[];activeDegreeId?:string;activeSemesterId?:string}
const pageProperties={offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:1,maximum:100}}
const tools=[
  {name:'uniflow_list_modules',description:'List your modules and semester assignments. Omits cover images, grades and personal notes.',scope:'workspace:read',inputSchema:{type:'object',properties:pageProperties,additionalProperties:false}},
  {name:'uniflow_list_semesters',description:'List your semesters, their dates and degree IDs.',scope:'workspace:read',inputSchema:{type:'object',properties:pageProperties,additionalProperties:false}},
  {name:'uniflow_list_entries',description:'List stored events, exams, homework or tasks. Events are recurrence definitions, not expanded calendar occurrences. Does not return personal notes.',scope:'workspace:read',inputSchema:{type:'object',properties:{...pageProperties,kind:{enum:['events','exams','homework','tasks']},moduleId:{type:'string',maxLength:100}},required:['kind'],additionalProperties:false}},
  {name:'uniflow_prepare_entry',description:'Prepare and validate a new event, exam, homework or task. Returns an UNSAVED draft. Never changes the workspace. A future in-app confirmation flow is required for saving.',scope:'workspace:propose',inputSchema:{type:'object',properties:{kind:{enum:['event','exam','homework','task']},moduleId:{type:'string',maxLength:100},semesterId:{type:'string',maxLength:100},title:{type:'string',minLength:1,maxLength:200},date:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},from:{type:'string',pattern:'^([01]\\d|2[0-3]):[0-5]\\d$'},to:{type:'string',pattern:'^(([01]\\d|2[0-3]):[0-5]\\d|24:00)$'}},required:['kind','moduleId','title'],additionalProperties:false}}
] as const

export const visibleTools=(scopes:McpScope[])=>tools.filter(tool=>scopes.includes(tool.scope)).map(({scope:_,...tool})=>({...tool,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}))
const pick=(row:Row,keys:string[])=>Object.fromEntries(keys.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]))
const rows=(value:unknown):Row[]=>Array.isArray(value)?value.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)):[]
const dateValid=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value
const clock=(value:unknown,end=false)=>typeof value==='string'&&(/^([01]\d|2[0-3]):[0-5]\d$/.test(value)||end&&value==='24:00')
const mins=(value:string)=>Number(value.slice(0,2))*60+Number(value.slice(3))
export class McpInputError extends Error {}

export async function callMcpTool(grant:McpGrant,name:string,args:unknown) {
  const tool=tools.find(item=>item.name===name)
  if(!tool)throw new McpInputError('Unknown tool.')
  if(!grant.scopes.includes(tool.scope))throw new McpInputError('This connection has no permission for this tool.')
  if(!args||typeof args!=='object'||Array.isArray(args))throw new McpInputError('Arguments must be an object.')
  const input=args as Row
  if(Object.keys(input).some(key=>!Object.prototype.hasOwnProperty.call(tool.inputSchema.properties,key)))throw new McpInputError('Unknown argument.')
  const {data,error}=await mcpDatabase().from('private_workspaces').select('payload').eq('user_id',grant.user_id).maybeSingle()
  if(error)throw error
  const workspace=(data?.payload||{}) as Workspace
  if(name==='uniflow_prepare_entry') {
    if(!['event','exam','homework','task'].includes(String(input.kind)))throw new McpInputError('Invalid entry kind.')
    if(typeof input.title!=='string'||!input.title.trim()||input.title.length>200)throw new McpInputError('Title must contain 1–200 characters.')
    const module=rows(workspace.modules).find(row=>row.id===input.moduleId)
    if(!module)throw new McpInputError('Choose a module from your own workspace.')
    if(input.kind!=='task') {
      const semester=rows(workspace.semesters).find(row=>row.id===input.semesterId&&row.degreeId===module.degreeId)
      if(!semester)throw new McpInputError('Choose a semester belonging to this module’s degree.')
      if(input.kind!=='homework'&&!dateValid(input.date))throw new McpInputError('A valid date is required.')
      if(input.date&&String(input.date)<String(semester.start))throw new McpInputError('The date is before the semester.')
      if(input.kind==='event'&&String(input.date)>String(semester.end))throw new McpInputError('The event must be inside the semester.')
    }
    if(input.date!==undefined&&!dateValid(input.date))throw new McpInputError('Invalid date.')
    if(input.kind==='event'&&!clock(input.from))throw new McpInputError('An event needs a start time.')
    if(input.from!==undefined&&!clock(input.from))throw new McpInputError('Invalid start time.')
    if(input.to!==undefined&&(!clock(input.to,true)||!clock(input.from)||mins(input.to as string)<=mins(input.from as string)))throw new McpInputError('End time must follow start time on the same day.')
    if(input.kind==='task'&&(input.from!==undefined||input.to!==undefined))throw new McpInputError('Tasks accept a due date, not times.')
    if(input.kind==='homework'&&input.to!==undefined)throw new McpInputError('Homework accepts a deadline time, not an end time.')
    if(input.from!==undefined&&!input.date)throw new McpInputError('A time requires a date.')
    return {saved:false,requiresConfirmation:true,draft:{...input,title:input.title.trim()},nextStep:'This is only a draft. Saving through MCP is not enabled.'}
  }
  const offset=input.offset??0,limit=input.limit??50
  if(!Number.isInteger(offset)||Number(offset)<0||!Number.isInteger(limit)||Number(limit)<1||Number(limit)>100)throw new McpInputError('Invalid pagination.')
  let items:Row[]=[]
  if(name==='uniflow_list_modules')items=rows(workspace.modules).map(row=>pick(row,['id','degreeId','name','shortName','credits','status','semesterIds','hidden']))
  if(name==='uniflow_list_semesters')items=rows(workspace.semesters).map(row=>pick(row,['id','degreeId','name','start','end','lectureEnd','archived']))
  if(name==='uniflow_list_entries') {
    if(input.moduleId!==undefined&&(typeof input.moduleId!=='string'||input.moduleId.length>100))throw new McpInputError('Invalid module ID.')
    if(!['events','exams','homework','tasks'].includes(String(input.kind)))throw new McpInputError('Invalid entry kind.')
    items=input.kind==='events'?rows(workspace.offerings):input.kind==='tasks'?rows(workspace.studyTasks):rows(workspace.assessments).filter(row=>row.type===(input.kind==='exams'?'exam':'homework'))
    if(input.moduleId)items=items.filter(row=>row.moduleId===input.moduleId)
    items=items.map(row=>pick(row,['id','moduleId','semesterId','name','title','category','contentLabel','date','endDate','from','to','recurrence','selected','completed','dueDate','completedAt']))
  }
  return {items:items.slice(Number(offset),Number(offset)+Number(limit)),total:items.length,nextOffset:Number(offset)+Number(limit)<items.length?Number(offset)+Number(limit):null}
}
