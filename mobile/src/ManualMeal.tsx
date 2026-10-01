import { useState } from "react";
import { Text } from "react-native";
import {
  clockTime,
  id,
  mealSchema,
  repeatMeal,
  scaleMealPortion,
  type Meal,
} from "../../src/domain";
import { isCalendarDate } from "../../src/features/pantry/date-contract";
import { useHealth } from "./store";
import { Button, Choice, Field, Sheet, s } from "./ui";

/** A separate intake record: repeating never consumes linked stock a second time. */
export function ManualMeal({
  day,
  source,
  onClose,
  onReview,
  onSaved,
}: {
  day: string;
  source?: Meal;
  onClose: () => void;
  onReview?: (meal: Meal) => boolean;
  onSaved?: (day: string) => void;
}) {
  const h = useHealth();
  const [title, setTitle] = useState(source?.title ?? "");
  const [date, setDate] = useState(day);
  const [category, setCategory] = useState<Meal["category"]>(
    source?.category ?? "Breakfast",
  );
  const [nutrition, setNutrition] = useState({
    calories: source ? String(source.calories) : "",
    protein: source ? String(source.protein) : "",
    carbs: source ? String(source.carbs) : "",
    fat: source ? String(source.fat) : "",
  });
  const [note, setNote] = useState(source?.note ?? "");
  const [error, setError] = useState("");
  const [multiplier, setMultiplier] = useState("1");
  const portionValid =
    Number.isFinite(Number(multiplier)) &&
    Number(multiplier) > 0 &&
    Number(multiplier) <= 100;
  return (
    <Sheet
      title={
        onReview
          ? "Correct estimate"
          : source
            ? "Repeat meal"
            : "Log a meal manually"
      }
      onClose={onClose}
    >
      <Text style={s.muted}>
        Enter nutrition for the portion you ate. Zero means a known zero; all
        four values are required. This works without a connection.
      </Text>
      {source && (
        <Text style={s.muted}>
          {onReview
            ? "The original estimate stays visible until you save this correction. Nothing is logged until you accept the reviewed card."
            : "Review the date and portion before saving. This adds a separate food record and does not deduct pantry ingredients or prepared portions."}
        </Text>
      )}
      <Field label="Meal name" value={title} onChangeText={setTitle} />
      <Field label="Day (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <Choice
        values={["Breakfast", "Lunch", "Dinner", "Snack"]}
        value={category}
        onChange={(v) => setCategory(v as Meal["category"])}
      />
      {source && !onReview && (
        <>
          <Field
            label="Portion multiplier"
            value={multiplier}
            keyboardType="decimal-pad"
            onChangeText={(value) => {
              setMultiplier(value);
              try {
                const scaled = scaleMealPortion(source, Number(value));
                setNutrition({
                  calories: String(scaled.calories),
                  protein: String(scaled.protein),
                  carbs: String(scaled.carbs),
                  fat: String(scaled.fat),
                });
                setError("");
              } catch (cause) {
                setError((cause as Error).message);
              }
            }}
          />
          <Text style={s.tiny}>
            1 is the original portion; 0.5 is half and 2 is double. Review the
            updated nutrition below. Pantry and prepared portions stay
            unchanged.
          </Text>
        </>
      )}
      {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
        <Field
          key={k}
          label={`${k}${k === "calories" ? "" : " (g)"}`}
          keyboardType="decimal-pad"
          value={nutrition[k]}
          onChangeText={(v) => setNutrition({ ...nutrition, [k]: v })}
        />
      ))}
      <Field
        label="Portion and notes"
        value={note}
        onChangeText={setNote}
        multiline
      />
      {!!error && (
        <Text accessibilityRole="alert" style={s.muted}>
          {error}
        </Text>
      )}
      <Button
        label={onReview ? "Update estimate" : "Save meal"}
        onPress={() => {
          if (
            !title.trim() ||
            !isCalendarDate(date) ||
            date > h.day ||
            (source && !onReview && !portionValid) ||
            Object.values(nutrition).some(
              (v) =>
                !v.trim() ||
                !Number.isFinite(Number(v)) ||
                Number(v) < 0 ||
                Number(v) > 20000,
            )
          ) {
            setError(
              "Check the name, calendar date and nutrition values (0–20,000).",
            );
            return;
          }
          const meal = mealSchema.parse({
            id: id(),
            title: title.trim(),
            day: date,
            category,
            time: clockTime(),
            source: source ? `Repeated meal: ${source.title}` : "Manual entry",
            confidence: source?.confidence ?? "confirmed",
            note,
            ...Object.fromEntries(
              Object.entries(nutrition).map(([k, v]) => [k, Number(v)]),
            ),
          });
          if (
            onReview
              ? onReview(meal)
              : h.change((s) => {
                  if (!source) return { ...s, meals: [...s.meals, meal] };
                  const next = repeatMeal(
                    s,
                    source.id,
                    date,
                    Number(multiplier),
                  );
                  const repeated = next.meals[next.meals.length - 1];
                  const unchanged = (
                    ["calories", "protein", "carbs", "fat"] as const
                  ).every((k) => repeated[k] === meal[k]);
                  return {
                    ...next,
                    meals: [
                      ...next.meals.slice(0, -1),
                      {
                        ...repeated,
                        ...meal,
                        id: repeated.id,
                        components: unchanged ? repeated.components : undefined,
                        note: `${repeated.note}${note.trim() ? ` ${note.trim()}` : ""}`,
                      },
                    ],
                  };
                })
          ) {
            h.setNotice(
              onReview
                ? "Estimate updated. Review the card before logging."
                : `Meal saved for ${date}.`,
            );
            onSaved?.(date);
            onClose();
          }
        }}
      />
    </Sheet>
  );
}
