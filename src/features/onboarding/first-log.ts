import { personalMeals, type AppState } from "../../domain.ts";
import { completedWorkoutHistory } from "../workout-planning/history.ts";

export function hasFirstLog(state: AppState): boolean {
  return (
    personalMeals(state.meals).length > 0 ||
    !!state.activities?.length ||
    completedWorkoutHistory(state.workout).length > 0
  );
}
export const firstLogCopy = {
  title: "Make today your starting point.",
  detail:
    "Log one meal to see your calories and macros, or record some movement. You can start manually right now.",
};
