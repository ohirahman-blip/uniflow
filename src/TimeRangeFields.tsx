import UniflowPicker from './UniflowPicker'
import { clockMinutes, shiftEndTime } from './time-range'

export default function TimeRangeFields({from,to,onChange}:{from:string;to:string;onChange:(from:string,to:string)=>void}) {
  const duration = to ? Math.max(1,clockMinutes(to)-clockMinutes(from)) : 0
  return <>
    <div className="uf-entry-field"><span className="field-label">Beginn</span><UniflowPicker kind="time" label="Beginn" value={from} maxMinutes={Math.min(1439,1440-duration)} onChange={next=>onChange(next,shiftEndTime(from,to,next))}/></div>
    <div className="uf-entry-field"><span className="field-label">Ende · optional</span><UniflowPicker kind="time" label="Ende" value={to} allowEmpty maxMinutes={1440} onChange={next=>onChange(from,next)}/></div>
  </>
}
