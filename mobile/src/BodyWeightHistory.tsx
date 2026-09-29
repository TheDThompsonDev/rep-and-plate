import { useState } from "react";
import { Text, View } from "react-native";
import { useHealth } from "./store";
import { Button, Card, Choice, Field, s } from "./ui";
import { id, today } from "../../src/domain";
import {
  saveBodyWeight,
  bodyWeightTrend,
} from "../../src/features/progress/body-weight";
export function BodyWeightHistory() {
  const h = useHealth(),
    entries = h.state!.bodyWeights ?? [];
  const [unit, setUnit] = useState<"lb" | "kg">("lb"),
    [day, setDay] = useState(today()),
    [value, setValue] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [error, setError] = useState("");
  const trend = bodyWeightTrend(entries, unit, today());
  return (
    <Card>
      <Text style={s.h2}>Your weight, over time</Text>
      <Text style={s.muted}>
        Optional measurements from you. Starting nutrition targets are generic;
        edit them in Your profile. Weight entries do not change them
        automatically.
      </Text>
      <Text style={s.muted}>
        {trend.change === null
          ? "Add measurements on two dates to see the change."
          : `${trend.change > 0 ? "+" : ""}${trend.change} ${unit} between ${trend.points[0].day} and ${trend.points.at(-1)!.day}. Individual measurements can fluctuate.`}
      </Text>
      <Field
        label="Measurement date (YYYY-MM-DD)"
        value={day}
        onChangeText={setDay}
      />
      <Field
        label="Body weight"
        keyboardType="decimal-pad"
        value={value}
        onChangeText={setValue}
      />
      <Choice
        values={["lb", "kg"]}
        value={unit}
        onChange={(v) => setUnit(v as "lb" | "kg")}
      />
      <Button
        label={editing ? "Update measurement" : "Save measurement"}
        onPress={() => {
          try {
            const entry = {
              id: editing ?? id(),
              day,
              value: Number(value),
              unit,
            };
            saveBodyWeight(entries, entry, today());
            if (
              h.change((state) => ({
                ...state,
                bodyWeights: saveBodyWeight(
                  state.bodyWeights ?? [],
                  entry,
                  today(),
                ),
              }))
            ) {
              setEditing(null);
              setValue("");
              setError("");
            }
          } catch (cause) {
            setError((cause as Error).message);
          }
        }}
      />
      {editing && (
        <Button
          secondary
          label="Cancel measurement edit"
          onPress={() => {
            setEditing(null);
            setValue("");
          }}
        />
      )}
      {!!error && <Text style={s.muted}>{error}</Text>}
      {entries
        .slice()
        .sort((a, b) => b.day.localeCompare(a.day))
        .slice(0, 30)
        .map((entry) => (
          <View key={entry.id}>
            <Text style={s.muted}>
              {entry.day} · {entry.value} {entry.unit}
            </Text>
            <Button
              secondary
              label={`Edit weight for ${entry.day}`}
              onPress={() => {
                setEditing(entry.id);
                setDay(entry.day);
                setUnit(entry.unit);
                setValue(String(entry.value));
                setError("");
              }}
            />
          </View>
        ))}
      {!entries.length && (
        <Text style={s.muted}>No measurements recorded yet.</Text>
      )}
    </Card>
  );
}
