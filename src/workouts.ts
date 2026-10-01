import { clockTime, id, type AppState, type Exercise } from "./domain";
import { setLoad } from './features/progress/set-loads';
export { exerciseTechnique, type ExerciseTechnique } from './exercise-technique';

export type Workout = AppState["workout"];
export type ExerciseAdjustment = {
  name: string;
  weight: number;
  target: number;
  setCount: number;
};

/** Changes the remaining prescription without rewriting performed work. */
export function adjustWorkoutExercise(
  workout: Workout,
  exerciseIndex: number,
  adjustment: ExerciseAdjustment,
): Workout {
  const current = workout.exercises[exerciseIndex];
  if (
    workout.status !== "active" ||
    !Number.isInteger(exerciseIndex) ||
    !current
  )
    throw new Error(
      "This exercise is no longer active. Open your current workout to adjust it.",
    );
  const name = adjustment.name.trim();
  if (!name || name.length > 100)
    throw new Error("Enter an exercise name with up to 100 characters.");
  if (
    !Number.isFinite(adjustment.weight) ||
    adjustment.weight < 0 ||
    adjustment.weight > 2000
  )
    throw new Error("Choose a weight between 0 and 2,000 lb.");
  if (
    !Number.isInteger(adjustment.target) ||
    adjustment.target < 1 ||
    adjustment.target > 100
  )
    throw new Error("Choose a target from 1 to 100 reps.");
  if (
    !Number.isInteger(adjustment.setCount) ||
    adjustment.setCount < 1 ||
    adjustment.setCount > 10
  )
    throw new Error("Choose between 1 and 10 sets.");
  const hasRecorded = current.sets.some((reps) => reps !== null);
  if (
    hasRecorded &&
    (name !== current.name || adjustment.weight !== current.weight)
  )
    throw new Error(
      "This exercise has recorded sets. Keep its name and weight to preserve what you already did.",
    );
  if (current.sets.slice(adjustment.setCount).some((reps) => reps !== null))
    throw new Error(
      "Keep every recorded set. You can only remove unrecorded sets from the end.",
    );
  const changedIdentity =
    name !== current.name || adjustment.weight !== current.weight;
  return {
    ...workout,
    exercises: workout.exercises.map((exercise, index) =>
      index !== exerciseIndex
        ? exercise
        : {
            ...exercise,
            name,
            weight: adjustment.weight,
            weightConfirmed: true,
            target: adjustment.target,
            previous: changedIdentity ? [] : exercise.previous,
            sets: Array.from(
              { length: adjustment.setCount },
              (_, set) => exercise.sets[set] ?? null,
            ),
            ...(exercise.setWeights?{setWeights:Array.from({length:adjustment.setCount},(_,set)=>changedIdentity?null:exercise.setWeights?.[set]??null)}:{}),
            ...(exercise.setEffort?{setEffort:Array.from({length:adjustment.setCount},(_,set)=>changedIdentity?null:exercise.setEffort?.[set]??null)}:{}),
          },
    ),
  };
}
const exercise = (
  name: string,
  target: number,
): Exercise => ({ name, weight:0, weightConfirmed:false, target, previous:[], sets: [null, null, null] });
export const workoutPlans = [
  {
    id: "upper",
    title: "Upper Body",
    minutes: 42,
    description: "A balanced session for your chest, back, and arms.",
    exercises: [
      exercise("Bench Press", 8),
      exercise("Incline Dumbbell Press", 10),
      exercise("Seated Cable Row", 12),
      exercise("Triceps Pushdown", 12),
    ],
  },
  {
    id: "lower",
    title: "Lower Body",
    minutes: 35,
    description: "Build your session around legs and glutes.",
    exercises: [
      exercise("Goblet Squat", 10),
      exercise("Dumbbell Romanian Deadlift", 10),
      exercise("Reverse Lunge", 10),
      exercise("Standing Calf Raise", 15),
    ],
  },
  {
    id: "full",
    title: "Full Body",
    minutes: 30,
    description: "A little of everything, with room in your day.",
    exercises: [
      exercise("Goblet Squat", 10),
      exercise("Bench Press", 10),
      exercise("Seated Cable Row", 12),
    ],
  },
];
export function startPlan(workout: Workout, planId: string): Workout {
  if (workout.status === "active") return workout;
  const plan = workoutPlans.find((p) => p.id === planId) ?? workoutPlans[0];
  const history = [...(workout.history ?? [])];
  if (workout.startedAt)
    history.push({
      title: workout.title ?? "Upper Body",
      exercises: workout.exercises,
      startedAt: workout.startedAt,
      finishedAt: workout.finishedAt,
    });
  return {
    routines: workout.routines,
    restUntil: null,
    status: "active",
    planId: plan.id,
    title: plan.title,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exercises: plan.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map(() => null),
    })),
    history,
    conversation: [],
  };
}
export function recordSet(
  workout: Workout,
  exerciseIndex: number,
  setIndex: number,
  reps: number,
  text = `Got ${reps}`,
  unit: 'lb' | 'kg' = 'lb',
): Workout {
  const ex = workout.exercises[exerciseIndex];
  if (
    workout.status !== "active" ||
    !ex ||
    (ex.weightConfirmed === false && ex.setWeights?.[setIndex] == null) ||
    setIndex < 0 ||
    setIndex >= ex.sets.length ||
    !Number.isInteger(reps) ||
    reps < 0 ||
    reps > 100
  )
    return workout;
  const correction = ex.sets[setIndex] !== null;
  return {
    ...workout,
    exercises: workout.exercises.map((item, i) =>
      i === exerciseIndex
        ? {
            ...item,
            sets: item.sets.map((value, j) => (j === setIndex ? reps : value)),
            setWeights: item.sets.map((value,j)=>j===setIndex?setLoad(item,j):item.setWeights?.[j]??(value===null?null:item.weight)),
          }
        : item,
    ),
    conversation: [
      ...(workout.conversation ?? []),
      { id: id(), role: "user", text, time: clockTime(), exerciseIndex },
      {
        id: id(),
        role: "assistant",
        text: `${correction ? "Updated" : "Got it"}. ${ex.name}, set ${setIndex + 1}: ${setLoad(ex,setIndex) ? `${displayLoad(setLoad(ex,setIndex),unit)} ${unit} × ` : "Bodyweight · "}${reps} reps.`,
        time: clockTime(),
        exerciseIndex,
      },
    ],
  };
}
export function replyToWorkout(workout: Workout, text: string, unit: 'lb' | 'kg' = 'lb'): Workout {
  const exIndex = workout.exercises.findIndex((ex) =>
    ex.sets.some((r) => r === null),
  );
  const match = text
    .trim()
    .match(/^(?:got |did |i got |i did )?(\d{1,3})(?: reps)?[.!]?$/i);
  if(workout.status==='active' && match && exIndex>=0 && Number(match[1])<=100){
    const exercise=workout.exercises[exIndex], set=exercise.sets.indexOf(null);
    if(exercise.weightConfirmed===false&&exercise.setWeights?.[set]==null)return {...workout,conversation:[...(workout.conversation??[]),{id:id(),role:'user',text,time:clockTime(),exerciseIndex:exIndex},{id:id(),role:'assistant',text:`Choose the load for ${exercise.name}, set ${set+1}, then record your ${Number(match[1])} reps. Use 0 only for bodyweight work. Nothing was logged yet.`,time:clockTime(),exerciseIndex:exIndex}]};
  }
  if (match && exIndex >= 0 && Number(match[1]) <= 100)
    return recordSet(
      workout,
      exIndex,
      workout.exercises[exIndex].sets.indexOf(null),
      Number(match[1]),
      text,
      unit,
    );
  const correction = text
    .trim()
    .match(
      /^(?:actually |change |edit )?set (\d+) (?:was|to) (\d{1,3})(?: reps)?[.!]?$/i,
    );
  const lastIndex =
    workout.conversation?.filter((m) => m.exerciseIndex !== undefined).at(-1)
      ?.exerciseIndex ?? exIndex;
  if (
    correction &&
    lastIndex >= 0 &&
    Number(correction[1]) >= 1 &&
    Number(correction[1]) <= workout.exercises[lastIndex].sets.length &&
    Number(correction[2]) <= 100
  )
    return recordSet(
      workout,
      lastIndex,
      Number(correction[1]) - 1,
      Number(correction[2]),
      text,
      unit,
    );
  return {
    ...workout,
    conversation: [
      ...(workout.conversation ?? []),
      { id: id(), role: "user", text, time: clockTime() },
      {
        id: id(),
        role: "assistant",
        text:
          exIndex < 0
            ? "All your planned sets are recorded. Tap Finish workout to save this session."
            : "Tell me the reps for your next set, like “Got 8”. To correct your last exercise, say “Set 2 was 7”. You can also tap a recorded set to edit it.",
        time: clockTime(),
      },
    ],
  };
}
export function workoutPhoto(name: string) {
  if (name === "Bench Press") return 1;
  if (name === "Incline Dumbbell Press") return 2;
  if (name.includes("Row")) return 3;
  if (name.includes("Triceps")) return 4;
  if (name.includes("Squat") || name.includes("Lunge")) return 5;
  return 0;
}

/** Pounds remain the persisted unit so old history and integrations stay compatible. */
export function displayLoad(pounds: number, unit: 'lb' | 'kg' = 'lb'): number {
  return Math.round((unit === 'kg' ? pounds / 2.2046226218 : pounds) * 100) / 100;
}
export function storedLoad(value: number, unit: 'lb' | 'kg' = 'lb'): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('Choose a nonnegative load.');
  const pounds = unit === 'kg' ? value * 2.2046226218 : value;
  if (pounds > 2000) throw new Error('Choose a load no greater than 2,000 lb (907.18 kg).');
  return Math.round(pounds * 10000) / 10000;
}
export function reopenWorkout(workout: Workout): Workout {
  if (workout.status !== 'finished') return workout;
  return {...workout,status:'active',originalFinishedAt:workout.finishedAt ?? undefined,finishedAt:null};
}
/** Correcting an old session must not turn it into today's training. */
export function finishWorkout(workout: Workout, finishedAt = new Date().toISOString()): Workout {
  if (workout.status !== 'active') return workout;
  const {originalFinishedAt,...session} = workout;
  return {...session,status:'finished',finishedAt:originalFinishedAt ?? finishedAt,restUntil:null};
}
/** Move the actual session out of history, preserving its date and recorded work. */
export function reopenHistoryWorkout(workout: Workout, index: number): Workout {
  if (workout.status === 'active') throw new Error('Finish the current workout before correcting an earlier session.');
  const session = workout.history?.[index];
  if (!session || !Number.isInteger(index)) throw new Error('That workout is no longer in history.');
  const history = (workout.history ?? []).filter((_,i) => i !== index);
  if (workout.startedAt && !history.some(entry => entry.startedAt === workout.startedAt))
    history.push({title:workout.title ?? 'Workout',startedAt:workout.startedAt,finishedAt:workout.finishedAt,exercises:workout.exercises});
  return {...session,routines:workout.routines,restUntil:null,status:'active',originalFinishedAt:session.finishedAt ?? undefined,finishedAt:null,history,conversation:[]};
}
/** Reordering preserves exercise identity, recorded sets, loads and chat references. */
export function moveWorkoutExercise(workout: Workout, from: number, to: number): Workout {
  if (workout.status !== 'active' || !Number.isInteger(from) || !Number.isInteger(to) || !workout.exercises[from] || !workout.exercises[to]) return workout;
  const order = workout.exercises.map((_,index)=>index);
  order.splice(to,0,order.splice(from,1)[0]);
  return {...workout,exercises:order.map(index=>workout.exercises[index]),conversation:workout.conversation?.map(message=>message.exerciseIndex === undefined ? message : {...message,exerciseIndex:order.indexOf(message.exerciseIndex)})};
}

/** A saved routine contains a prescription, never completed performance. */
export function saveWorkoutRoutine(workout: Workout, name: string): Workout {
  const title=name.trim();
  if(!title||title.length>100)throw new Error('Name your routine using up to 100 characters.');
  if(!workout.exercises.length||workout.exercises.length>50)throw new Error('Choose a workout with 1 to 50 exercises.');
  if((workout.routines?.length??0)>=100)throw new Error('You have 100 saved routines. Remove one before saving another.');
  const exercises=workout.exercises.map(ex=>{
    if(!ex.name.trim()||ex.name.length>100||ex.sets.length<1||ex.sets.length>10||!Number.isInteger(ex.target)||ex.target<1||ex.target>100)throw new Error('Review exercise names, set counts and rep targets before saving.');
    let last=-1;ex.sets.forEach((reps,index)=>{if(reps!==null)last=index;});
    const load=last>=0?setLoad(ex,last):ex.weightConfirmed!==false?ex.weight:undefined;
    if(load!==undefined&&(!Number.isFinite(load)||load<0||load>2000))throw new Error('Review this routine’s load references; supported loads are 0 to 2,000 lb.');
    return {name:ex.name.trim(),target:ex.target,setCount:ex.sets.length,...(load!==undefined?{suggestedLoad:load}:{})};
  });
  return {...workout,routines:[...(workout.routines??[]),{id:id(),name:title,exercises}]};
}

export function deleteWorkoutRoutine(workout:Workout,routineId:string):Workout {
  return {...workout,routines:workout.routines?.filter(r=>r.id!==routineId)};
}

export function startWorkoutRoutine(workout:Workout,routineId:string):Workout {
  if(workout.status==='active')throw new Error('Finish your active workout before starting a saved routine.');
  const routine=workout.routines?.find(r=>r.id===routineId);
  if(!routine)throw new Error('This saved routine is no longer available.');
  const history=[...(workout.history??[])];
  if(workout.startedAt&&!history.some(s=>s.startedAt===workout.startedAt))history.push({title:workout.title??'Workout',startedAt:workout.startedAt,finishedAt:workout.finishedAt,exercises:workout.exercises});
  return {status:'active',title:routine.name,planId:routine.id,startedAt:new Date().toISOString(),finishedAt:null,routines:workout.routines,restUntil:null,history,conversation:[],exercises:routine.exercises.map(ex=>({name:ex.name,target:ex.target,weight:ex.suggestedLoad??0,weightConfirmed:false,previous:[],sets:Array.from({length:ex.setCount},()=>null),setWeights:Array.from({length:ex.setCount},()=>null)}))};
}

/** Change planned loads only; never rewrite a set already performed. */
export function applyLoadToRemainingSets(workout:Workout,exerciseIndex:number,fromSet:number,weight:number):Workout {
  const ex=workout.exercises[exerciseIndex];
  if(workout.status!=='active'||!ex||!Number.isInteger(fromSet)||fromSet<0||fromSet>=ex.sets.length||!Number.isFinite(weight)||weight<0||weight>2000)throw new Error('Choose a valid remaining set and a load from 0 to 2,000 lb.');
  return {...workout,exercises:workout.exercises.map((item,i)=>i===exerciseIndex?{...item,setWeights:item.sets.map((reps,j)=>reps===null&&j>=fromSet?weight:item.setWeights?.[j]??(reps===null?null:item.weight))}:item)};
}

export function startWorkoutRest(workout:Workout,seconds=90,now=Date.now()):Workout {
  if(workout.status!=='active'||!Number.isFinite(seconds)||seconds<5||seconds>3600||!Number.isFinite(now)||now<0)throw new Error('Choose a rest from 5 seconds to 60 minutes during an active workout.');
  return {...workout,restUntil:now+Math.round(seconds*1000)};
}
export function endWorkoutRest(workout:Workout):Workout {return {...workout,restUntil:null};}
