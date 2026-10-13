/**
 * Turn Supabase Functions errors into actionable (but credential-safe) UI text.
 * In particular, FunctionsFetchError is a network/CORS failure rather than a
 * DeepSeek reply, and FunctionsHttpError.context contains the server response.
 */
type FailurePayload={error?:unknown;upstreamStatus?:unknown}
const isObject=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'
const messages:Record<string,string>={
  METHOD_NOT_ALLOWED:'Falsche HTTP-Methode beim Funktionsaufruf.',
  NOT_AUTHENTICATED:'Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.',
  PREMIUM_REQUIRED:'Für diese Funktion brauchst du ein aktives uniflow+-Konto.',
  PREMIUM_CHECK_UNAVAILABLE:'Supabase konnte deinen Premium-Status nicht prüfen. Prüfe die Tabelle account_directory und ihre RLS-Regeln.',
  SUPABASE_NOT_CONFIGURED:'In der Edge Function fehlen die Supabase-Projektvariablen.',
  DEEPSEEK_NOT_CONFIGURED:'Der API-Schlüssel DEEPSEEK_API_KEY fehlt in den Supabase Edge Function Secrets.',
  QUOTA_NOT_CONFIGURED:'Die Supabase-Datenbankfunktion uniflow_consume_ai_quota fehlt oder ist nicht ausführbar.',
  QUOTA_OR_ACCESS_LIMIT:'Dein gemeinsames KI-Tageslimit (25 Anfragen) ist erreicht oder dein Konto hat keine Berechtigung.',
  ORIGIN_NOT_ALLOWED:'Diese Website ist für die Edge Function nicht als Herkunft freigegeben. Prüfe UNIFLOW_ALLOWED_ORIGINS.',
  BAD_JSON:'Supabase hat eine ungültige Anfrage erhalten.',
  BAD_INPUT:'Bitte beschreibe die Veranstaltung mit mindestens einem Wochentag und einer Startzeit.',
  BAD_CONTEXT:'Die Lerninformationen konnten nicht verarbeitet werden.',
  CONTEXT_TOO_LARGE:'Der übermittelte Studienkontext ist zu groß.',
  INPUT_TOO_LARGE:'Der Eingabetext ist zu lang.',
  MODEL_INVALID:'DeepSeek akzeptiert den Modellnamen nicht. Prüfe DEEPSEEK_MODEL in Supabase (z. B. deepseek-v4-flash).',
  MODEL_AUTH_ERROR:'Der DeepSeek-Schlüssel ist ungültig oder hat keine Zugriffsberechtigung. Prüfe DEEPSEEK_API_KEY in Supabase.',
  MODEL_PAYMENT_REQUIRED:'Dein DeepSeek-API-Konto hat möglicherweise kein ausreichendes Guthaben.',
  MODEL_RATE_LIMIT:'DeepSeek begrenzt aktuell die Anfragen. Bitte versuche es später erneut.',
  MODEL_TIMEOUT:'DeepSeek hat nicht rechtzeitig geantwortet. Bitte versuche es erneut.',
  MODEL_REQUEST_INVALID:'DeepSeek hat das Anfrageformat abgelehnt. Prüfe das Modell und das Edge-Function-Protokoll.',
  MODEL_NETWORK_ERROR:'Die Edge Function konnte DeepSeek nicht erreichen. Prüfe das Supabase-Protokoll.',
  MODEL_UNAVAILABLE:'DeepSeek ist derzeit nicht erreichbar oder hat einen Serverfehler gemeldet.',
  EMPTY_MODEL_REPLY:'DeepSeek hat eine leere Antwort geliefert. Bitte erneut versuchen.',
  INVALID_MODEL_REPLY:'Die Antwort hatte nicht das erwartete JSON-Format. Bitte erneut versuchen.'
}
export function aiFailureText(code:string,status=0,upstreamStatus=0){
  const human=messages[code]||(status===404?'Die Edge Function ist nicht bereitgestellt oder der Funktionsname stimmt nicht.':
    status===401?'Bitte melde dich erneut an.':
    status===403?'Der Zugriff wurde verweigert. Prüfe Premium, JWT und erlaubte Herkunft.':
    status===429?'Das KI-Limit ist erreicht. Bitte später erneut versuchen.':
    'Der KI-Aufruf ist fehlgeschlagen. Öffne Supabase → Edge Functions → Logs und Invocations.')
  const flags=[status?'HTTP '+status:'',upstreamStatus?'Anbieter HTTP '+upstreamStatus:'',code?'Code '+code:''].filter(Boolean)
  return human+(flags.length?' ('+flags.join(' · ')+')':'')
}
export async function describeAiRequestError(error:unknown,functionName:string):Promise<string>{
  const value=isObject(error)?error:null
  const message=typeof value?.message==='string'?value.message:''
  const name=typeof value?.name==='string'?value.name:''
  const context=value?.context
  if(typeof Response!=='undefined'&&context instanceof Response){
    const data=await context.clone().json().catch(()=>null) as FailurePayload|null
    const code=typeof data?.error==='string'?data.error:''
    const upstreamStatus=typeof data?.upstreamStatus==='number'?data.upstreamStatus:0
    return aiFailureText(code,context.status,upstreamStatus)
  }
  if(name==='FunctionsFetchError'||/Failed to send a request to the Edge Function|failed to fetch|networkerror|load failed/i.test(message)){
    const origin=typeof window!=='undefined'?window.location.origin:'unbekannt'
    return 'Netzwerk- oder CORS-Fehler bei '+functionName+' (Website: '+origin+'). Der Browser konnte keine gültige Antwort lesen. Prüfe im Browser unter Entwicklertools → Netzwerk den OPTIONS- und POST-Status; bei fehlendem CORS-Header die in Supabase deployte Funktion aktualisieren.'
  }
  if(name==='FunctionsRelayError')return 'Supabase konnte die Edge Function nicht starten oder weiterleiten. Prüfe die Logs der Funktion '+functionName+'.'
  if(name==='AbortError')return 'Die KI-Anfrage wurde abgebrochen oder hat zu lange gedauert.'
  return message||'Die KI-Anfrage ist fehlgeschlagen. Prüfe die Logs von '+functionName+'.'
}
