import { currentSemesterDates, today, type AppData, type Semester, type StudyModule } from './model'

export function moduleDirectory(data: AppData, selectedModules: StudyModule[], selectedSemester?: Semester) {
  const all = data.modules.filter(module => module.degreeId === data.activeDegreeId && !module.hidden)
  const semesters = data.semesters.filter(semester => semester.degreeId === data.activeDegreeId).sort((a,b) => a.start.localeCompare(b.start))
  const studyStart = data.degrees.find(degree => degree.id === data.activeDegreeId)?.studyStartSemester || semesters[0]?.start
  const assigned = (module: StudyModule) => semesters.filter(semester => module.semesterIds.includes(semester.id))
  const completed = (module: StudyModule) => module.status === 'passed' || module.status === 'recognized'
  const isPlanned = (module: StudyModule) => !completed(module) && (module.status === 'planned' || (assigned(module).length > 0 && assigned(module).every(semester => semester.start > currentSemesterDates().start)))
  const current = selectedModules.filter(module => !module.hidden && !completed(module) && !isPlanned(module))
  const currentIds = new Set(current.map(module => module.id))
  const planned = all.filter(isPlanned)
  const past = all.filter(module => !currentIds.has(module.id) && !isPlanned(module) && (completed(module) || assigned(module).some(semester => semester.start < (selectedSemester?.start || today()))))
  const groups: {key:string;label:string;modules:StudyModule[]}[] = []
  for (const semester of semesters) {
    const modules = all.filter(module => assigned(module)[0]?.id === semester.id)
    if (!modules.length) continue
    const number = studyStart ? (Number(semester.start.slice(0,4)) - Number(studyStart.slice(0,4))) * 2 + (Number(semester.start.slice(5,7)) - Number(studyStart.slice(5,7))) / 6 + 1 : 0
    groups.push({key:semester.id,label:number > 0 ? `${number}. Fachsemester · ${semester.name}` : semester.name,modules})
  }
  const unassigned = all.filter(module => !assigned(module).length)
  if (unassigned.some(completed)) groups.push({key:'completed',label:'Abgeschlossen · ohne Semesterzuordnung',modules:unassigned.filter(completed)})
  if (unassigned.some(module => !completed(module))) groups.push({key:'other',label:'Sonstige',modules:unassigned.filter(module => !completed(module))})
  return {all:groups.flatMap(group=>group.modules),current,past,planned,groups,isPlanned}
}
