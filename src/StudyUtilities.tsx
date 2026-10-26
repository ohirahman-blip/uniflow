import {Flame,UserRound} from 'lucide-react'
import {streakCount} from './streaks'
export default function StudyUtilities({days,onProfile,onStreak,name,degree}:{days?:string[];onProfile:()=>void;onStreak:()=>void;name?:string;degree?:string}){
  const streak=streakCount(days)
  return <div className={'mlh-utility'+(name?' sidebar-identity':'')}><button onClick={onProfile} aria-label="Dein Profil"><UserRound size={21}/>{name&&<span className="sidebar-identity-text"><strong>{name}</strong><small>{degree}</small></span>}</button><button className={'mlh-streak'+(streak>=7?' is-purple':'')} onClick={onStreak} aria-label={`${streak} Tage Streak`}><Flame size={22}/><strong>{streak}</strong>{streak>=7&&<small>1,5×</small>}</button></div>
}
