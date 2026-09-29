import { today,personalMeals,type AppState } from '../../domain';
import { nutritionInsights } from '../insights/insights';

function localDay(date:Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function weeklyReview(state:AppState,end=today()) {
  const date=new Date(`${end}T12:00:00`);date.setDate(date.getDate()-6);
  const start=localDay(date);
  const meals=personalMeals(state.meals).filter(meal=>meal.day>=start && meal.day<=end);
  const candidates=[...(state.workout.history??[]),...(state.workout.startedAt?[{title:state.workout.title??'Workout',startedAt:state.workout.startedAt,finishedAt:state.workout.finishedAt,exercises:state.workout.exercises}]:[])];
  const workouts=new Map<string,{title:string;startedAt:string;day:string;finished:boolean;sets:number}>();
  for(const session of candidates) {
    if(!session.startedAt || /sample|demo/i.test(session.title))continue;
    const started=new Date(session.startedAt);
    if(!Number.isFinite(started.getTime()))continue;
    const day=localDay(started);
    if(day<start || day>end)continue;
    const sets=session.exercises.reduce((sum,exercise)=>sum+exercise.sets.filter(reps=>reps!==null).length,0);
    if(!sets)continue;
    const finished=session.finishedAt ? new Date(session.finishedAt) : null;
    workouts.set(`${session.startedAt}:${session.title}`,{title:session.title,startedAt:session.startedAt,day,finished:!!finished&&Number.isFinite(finished.getTime())&&finished>=started,sets});
  }
  return {start,end,meals,loggedDays:new Set(meals.map(meal=>meal.day)).size,insights:nutritionInsights(state,end),workouts:[...workouts.values()].sort((a,b)=>b.startedAt.localeCompare(a.startedAt))};
}
