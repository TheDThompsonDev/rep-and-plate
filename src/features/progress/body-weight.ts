import { z } from "zod";
import { calendarDate } from "../shopping/contracts";
export const bodyWeightEntrySchema = z.object({
  id: z.string().min(1).max(100),
  day: calendarDate,
  value: z.number().finite().positive().max(2000),
  unit: z.enum(["lb", "kg"]),
});
export type BodyWeightEntry = z.infer<typeof bodyWeightEntrySchema>;
export function saveBodyWeight(
  entries: BodyWeightEntry[],
  input: BodyWeightEntry,
  day = new Date().toLocaleDateString("en-CA"),
) {
  const entry = bodyWeightEntrySchema.parse(input);
  if (entry.day > day)
    throw new Error("Choose today or an earlier measurement date.");
  if (entries.some((item) => item.day === entry.day && item.id !== entry.id))
    throw new Error(
      "A measurement is already saved for this date. Edit that entry instead.",
    );
  return [...entries.filter((item) => item.id !== entry.id), entry].sort(
    (a, b) => a.day.localeCompare(b.day),
  );
}
export function bodyWeightTrend(
  entries: BodyWeightEntry[],
  unit: "lb" | "kg",
  day: string,
) {
  const actual = entries
    .filter(
      (entry) =>
        bodyWeightEntrySchema.safeParse(entry).success && entry.day <= day,
    )
    .sort((a, b) => a.day.localeCompare(b.day));
  const convert = (entry: BodyWeightEntry) =>
    entry.unit === unit
      ? entry.value
      : unit === "kg"
        ? entry.value * 0.45359237
        : entry.value / 0.45359237;
  const points = actual.map((entry) => ({
    day: entry.day,
    value: Math.round(convert(entry) * 100) / 100,
  }));
  return {
    points,
    change:
      points.length >= 2
        ? Math.round((points.at(-1)!.value - points[0].value) * 100) / 100
        : null,
    unit,
  };
}
