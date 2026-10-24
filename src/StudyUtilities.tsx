import {Flame,UserRound} from 'lucide-react'
import {streakCount} from './streaks'
export default function StudyUtilities({days,onProfile,onStreak}:{days?:string[];onProfile:()=>void;onStreak:()=>void}){
  const streak=streakCount(days)
  return <div className="mlh-utility"><button onClick={onProfile} aria-label="Dein Profil"><UserRound size={21}/></button><button className={'mlh-streak'+(streak>=7?' is-purple':'')} onClick={onStreak} aria-label={`${streak} Tage Streak`}><Flame size={22}/><strong>{streak}</strong>{streak>=7&&<small>1,5×</small>}</button></div>
}
