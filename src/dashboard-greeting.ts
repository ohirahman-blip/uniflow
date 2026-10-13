/** Local-time welcome for the home dashboard. Never uses AI or a remote clock. */
export function greetingForHour(hour:number):string{
  if(!Number.isFinite(hour)||hour<0||hour>=24)return 'Schön, dass du da bist'
  if(hour>=5&&hour<11)return 'Guten Morgen'
  if(hour>=11&&hour<18)return 'Schönen Tag'
  if(hour>=18&&hour<22)return 'Guten Abend'
  return 'Gute Nacht'
}
