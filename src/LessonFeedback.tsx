import { useEffect, useState } from 'react'
import { Check, PencilLine } from 'lucide-react'
import type { LearningLesson, LearningRating } from './learning'
import './lesson-feedback.css'

const ratings:{ value:LearningRating; title:string }[]=[
  {value:'understood',title:'Verstanden'},
  {value:'partial',title:'Teilweise'},
  {value:'struggling',title:'Nicht verstanden'},
  {value:'absent',title:'Nicht besucht'}
]

type Props={
  lesson:LearningLesson
  topic?:string
  rating?:LearningRating
  canRate:boolean
  onTopic:(lesson:LearningLesson,title:string)=>void
  onRating:(lesson:LearningLesson,rating:LearningRating)=>void
  compact?:boolean
}
/** One per-lecture panel reused in the timetable detail and home check-ins.
 * Changing this visit's topic never renames the recurring teaching offering.
 * The rating can be revised at any time after the class has ended. */
export default function LessonFeedback({lesson,topic='',rating,canRate,onTopic,onRating,compact=false}:Props){
  const [draft,setDraft]=useState(topic)
  useEffect(()=>setDraft(topic),[lesson.key,topic])
  const save=(value:string)=>{
    const cleaned=value.trim().slice(0,100)
    if(cleaned!==topic.trim())onTopic(lesson,cleaned)
  }
  return <section className={'lesson-feedback'+(compact?' lesson-feedback-compact':'')} aria-label="Feedback zu dieser Veranstaltung">
    <div className="lesson-feedback-heading">
      <span><PencilLine size={15}/> Thema dieses Termins</span>
      {rating&&<small><Check size={12}/> Bewertet</small>}
    </div>
    <input
      className="lesson-feedback-topic"
      aria-label="Thema nur für diesen Veranstaltungstermin"
      value={draft}
      onChange={e=>setDraft(e.target.value)}
      onBlur={e=>save(e.currentTarget.value)}
      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}
      placeholder="z. B. DNA-Replikation"
      maxLength={100}
    />
    <p className="lesson-feedback-note">Gilt nur für diese Vorlesung, nicht für die ganze Reihe.</p>
    <div className="lesson-feedback-prompt">{rating?'Deine Einschätzung ändern':'Wie gut hast du die Veranstaltung verstanden?'}</div>
    <div className="lesson-feedback-options" role="group" aria-label="Verständnis dieser Vorlesung">
      {ratings.map(item=><button
        type="button" key={item.value} title={item.title}
        aria-pressed={rating===item.value} disabled={!canRate}
        className={rating===item.value?'chosen':''}
        onClick={()=>{save(draft);onRating(lesson,item.value)}}
      >{item.title}</button>)}
    </div>
    {!canRate&&<p className="lesson-feedback-note">Deine Einschätzung kannst du nach Ende der Veranstaltung eintragen.</p>}
    {rating&&canRate&&<p className="lesson-feedback-note">Du kannst deine Einschätzung jederzeit wieder ändern.</p>}
  </section>
}
