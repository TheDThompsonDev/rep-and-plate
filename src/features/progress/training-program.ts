import { z } from "zod";
import type { AppState } from "../../domain.ts";
import { workoutPlans } from "../../workout-plans.ts";

/** Data module only: native imports this file, so it must never pull a renderer or CSS. */
export const equipmentLabels = {
  bodyweight: "Bodyweight",
  dumbbells: "Dumbbells",
  barbell: "Barbell",
  machines: "Machines & cables",
  bands: "Resistance bands",
} as const;
export type Equipment = keyof typeof equipmentLabels;
/** The choices a person makes; bodyweight is always available and is not asked. */
export const equipmentChoices = ["dumbbells", "barbell", "machines", "bands"] as const satisfies readonly Equipment[];
export type EquipmentChoice = (typeof equipmentChoices)[number];
export const experienceLabels = {
  new: "New to strength training",
  some: "Some experience",
  experienced: "Experienced",
} as const;
export type Experience = keyof typeof experienceLabels;
export const trainingDayChoices = [2, 3, 4, 5, 6] as const;

const equipmentEnum = z.enum(["bodyweight", "dumbbells", "barbell", "machines", "bands"]);
const experienceEnum = z.enum(["new", "some", "experienced"]);
export const trainingProgramSchema = z.object({
  daysPerWeek: z.number().int().min(2).max(6),
  equipment: z.array(equipmentEnum).min(1).max(5),
  experience: experienceEnum.optional(),
  /** Day the program was saved; finished program sessions on or after it advance "next". */
  startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessions: z
    .array(
      z.object({
        planId: z.string().min(1).max(40),
        title: z.string().min(1).max(100),
        minutes: z.number().int().min(5).max(120),
        description: z.string().max(300),
        exercises: z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              target: z.number().int().min(1).max(100),
              sets: z.number().int().min(1).max(10),
            }),
          )
          .min(1)
          .max(10),
      }),
    )
    .min(2)
    .max(6),
});
export type TrainingProgram = z.infer<typeof trainingProgramSchema>;
/** What the person told us, without the derived sessions: this is the AI context shape. */
export const trainingAnswersSchema = trainingProgramSchema.pick({ daysPerWeek: true, equipment: true, experience: true });
export function programAnswers(program: TrainingProgram): z.infer<typeof trainingAnswersSchema> {
  return {
    daysPerWeek: program.daysPerWeek,
    equipment: program.equipment,
    ...(program.experience ? { experience: program.experience } : {}),
  };
}
export type ProgramSession = TrainingProgram["sessions"][number];
export type TrainingAnswers = {
  daysPerWeek: number;
  equipment: readonly Equipment[];
  experience?: Experience;
};

/** Which starter plans make up a week. Full-body weeks for two days; alternating upper/lower beyond that. */
const weekTemplates: Record<number, string[]> = {
  2: ["full", "full"],
  3: ["upper", "lower", "full"],
  4: ["upper", "lower", "upper", "lower"],
  5: ["upper", "lower", "full", "upper", "lower"],
  6: ["upper", "lower", "full", "upper", "lower", "full"],
};
/** Equipment each starter exercise needs, and substitutes in order of preference. The
 * substitute list always ends in a bodyweight movement so every week is startable. */
const exerciseEquipment: Record<string, { needs: Equipment; alternatives: { name: string; needs: Equipment }[] }> = {
  "Bench Press": {
    needs: "barbell",
    alternatives: [
      { name: "Dumbbell Bench Press", needs: "dumbbells" },
      { name: "Band Chest Press", needs: "bands" },
      { name: "Push-Up", needs: "bodyweight" },
    ],
  },
  "Incline Dumbbell Press": {
    needs: "dumbbells",
    alternatives: [
      { name: "Band Chest Press", needs: "bands" },
      { name: "Incline Push-Up", needs: "bodyweight" },
    ],
  },
  "Seated Cable Row": {
    needs: "machines",
    alternatives: [
      { name: "Dumbbell Row", needs: "dumbbells" },
      { name: "Barbell Row", needs: "barbell" },
      { name: "Band Row", needs: "bands" },
      { name: "Prone Back Extension", needs: "bodyweight" },
    ],
  },
  "Triceps Pushdown": {
    needs: "machines",
    alternatives: [
      { name: "Dumbbell Overhead Triceps Extension", needs: "dumbbells" },
      { name: "Band Triceps Pushdown", needs: "bands" },
      { name: "Close-Grip Push-Up", needs: "bodyweight" },
    ],
  },
  "Goblet Squat": {
    needs: "dumbbells",
    alternatives: [{ name: "Bodyweight Squat", needs: "bodyweight" }],
  },
  "Dumbbell Romanian Deadlift": {
    needs: "dumbbells",
    alternatives: [
      { name: "Barbell Romanian Deadlift", needs: "barbell" },
      { name: "Glute Bridge", needs: "bodyweight" },
    ],
  },
  "Reverse Lunge": { needs: "bodyweight", alternatives: [] },
  "Standing Calf Raise": { needs: "bodyweight", alternatives: [] },
};

export function normalizeEquipment(equipment: readonly Equipment[]): Equipment[] {
  const order = Object.keys(equipmentLabels) as Equipment[];
  return order.filter((item) => item === "bodyweight" || equipment.includes(item));
}

function chooseExercise(name: string, available: readonly Equipment[]): string {
  const entry = exerciseEquipment[name];
  if (!entry || available.includes(entry.needs)) return name;
  const substitute = entry.alternatives.find((option) => available.includes(option.needs));
  return substitute ? substitute.name : name;
}

/** Deterministic: the same answers always produce the same week. Loads are never part of a program. */
export function deriveTrainingProgram(answers: TrainingAnswers, startedOn: string): TrainingProgram {
  const template = weekTemplates[answers.daysPerWeek];
  if (!template) throw Error("Choose between 2 and 6 training days per week.");
  const equipment = normalizeEquipment(answers.equipment);
  const sets = answers.experience === undefined || answers.experience === "new" ? 2 : 3;
  const sessions = template.map((planId, index) => {
    const plan = workoutPlans.find((item) => item.id === planId) ?? workoutPlans[0];
    // The plan's own estimate assumes three sets; a two-set session is scaled, rounded to 5 minutes.
    const minutes = sets === 3 ? plan.minutes : Math.max(5, Math.round((plan.minutes * sets) / 3 / 5) * 5);
    return {
      planId: plan.id,
      title: `Session ${index + 1} · ${plan.title}`,
      minutes,
      description: plan.description,
      exercises: plan.exercises.map((exercise) => ({
        name: chooseExercise(exercise.name, equipment),
        target: exercise.target,
        sets,
      })),
    };
  });
  return trainingProgramSchema.parse({
    daysPerWeek: answers.daysPerWeek,
    equipment,
    ...(answers.experience ? { experience: answers.experience } : {}),
    startedOn,
    sessions,
  });
}

export function programEquipmentText(program: Pick<TrainingProgram, "equipment">): string {
  return normalizeEquipment(program.equipment).map((item) => equipmentLabels[item]).join(" · ");
}

export function clearTrainingProgram(state: AppState): AppState {
  const { trainingProgram: _removed, ...profile } = state.profile;
  void _removed;
  return { ...state, profile };
}
