import { useEffect, useState } from 'react'
import type { LearningLesson, LearningRating } from './learning'
import './lesson-feedback.css'

const ratings:{ value:LearningRating; title:string; emoji:string }[]=[
  {value:'understood',title:'Verstanden',emoji:'😊'},
  {value:'partial',title:'Teilweise',emoji:'😐'},
  {value:'struggling',title:'Nicht verstanden',emoji:'😟'},
  {value:'absent',title:'Nicht besucht',emoji:'🚫'}
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
    <input
      className="lesson-feedback-topic"
      aria-label="Thema nur für diesen Veranstaltungstermin"
      value={draft}
      onChange={e=>setDraft(e.target.value)}
      onBlur={e=>save(e.currentTarget.value)}
      onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}
      placeholder="Thema hinzufügen"
      maxLength={100}
    />
    <div className="lesson-feedback-options" role="group" aria-label="Verständnis dieser Vorlesung">
      {ratings.map(item=><button
        type="button" key={item.value} title={item.title}
        aria-pressed={rating===item.value} disabled={!canRate}
        className={'lesson-feedback-rating-'+item.value+(rating===item.value?' chosen':'')}
        onClick={()=>{save(draft);onRating(lesson,item.value)}}
      ><span className="lesson-rating-emoji" aria-hidden="true">{item.emoji}</span><span>{item.title}</span></button>)}
    </div>
  </section>
}
