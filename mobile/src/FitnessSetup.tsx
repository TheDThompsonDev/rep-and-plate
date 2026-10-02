import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Choice, Field, s } from "./ui";
import {
  cadenceLabels,
  convertSetupUnit,
  fitnessDraft,
  goalLabels,
  parseFitnessSetup,
  type FitnessGoal,
  type FitnessSetupDraft,
} from "../../src/features/progress/fitness-goal";
import type { BodyWeightEntry } from "../../src/features/progress/body-weight";

export function FitnessSetup({
  goal,
  weight,
  initialDraft,
  onDraftChange,
  onSave,
  onSkip,
  busy = false,
}: {
  goal?: FitnessGoal;
  weight?: BodyWeightEntry;
  initialDraft?: FitnessSetupDraft;
  onDraftChange?: (draft: FitnessSetupDraft) => void;
  onSave: (draft: FitnessSetupDraft) => void;
  onSkip?: () => void;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState(() => initialDraft ?? fitnessDraft(goal)),
    [error, setError] = useState("");
  const patch = (value: Partial<FitnessSetupDraft>) => {
    const next = { ...draft, ...value };
    setDraft(next);
    onDraftChange?.(next);
    setError("");
  };
  return (
    <View style={{ gap: 14 }}>
      <Text style={s.h3}>Your main goal</Text>
      <Choice
        values={Object.keys(goalLabels)}
        labels={goalLabels}
        value={draft.kind}
        onChange={(kind) =>
          patch({ kind: kind as FitnessGoal["kind"], targetWeight: "" })
        }
      />
      <Text style={s.muted}>
        Your goal helps frame your progress. Change it anytime from your
        profile.
      </Text>
      <Text style={s.h3}>Weight unit</Text>
      <Choice
        values={["lb", "kg"]}
        value={draft.unit}
        onChange={(unit) => {
          const next = convertSetupUnit(draft, unit as FitnessGoal["unit"]);
          setDraft(next);
          onDraftChange?.(next);
          setError("");
        }}
      />
      <Field
        label="Current weight"
        keyboardType="decimal-pad"
        value={draft.currentWeight}
        onChangeText={(currentWeight) => patch({ currentWeight })}
        editable={!busy}
      />
      {["lose", "gain"].includes(draft.kind) && (
        <Field
          label="Target weight"
          keyboardType="decimal-pad"
          value={draft.targetWeight}
          onChangeText={(targetWeight) => patch({ targetWeight })}
          editable={!busy}
        />
      )}
      <Text style={s.tiny}>
        A current weight becomes today’s first measurement. Don’t know it yet?
        Leave it blank and add it from your profile later.
      </Text>
      <Text style={s.h3}>Weight check-in rhythm</Text>
      <Choice
        values={Object.keys(cadenceLabels)}
        labels={cadenceLabels}
        value={draft.cadence}
        onChange={(cadence) =>
          patch({ cadence: cadence as FitnessGoal["cadence"] })
        }
      />
      <View style={s.hero}>
        <Text style={s.h3}>A small check-in. A clearer picture.</Text>
        <Text style={s.muted}>
          Log your weight in your profile. We’ll show changes across dates and
          when your next check-in is due. One measurement can fluctuate; your
          history gives it context.
        </Text>
        <Text style={s.tiny}>
          This is an in-app prompt. These details won’t automatically set your
          calorie or macro targets.
        </Text>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={s.muted}>
          {error}
        </Text>
      )}
      <Button
        label="Save my starting point"
        disabled={busy}
        onPress={() => {
          try {
            parseFitnessSetup(draft, weight);
            onSave(draft);
          } catch (cause) {
            setError((cause as Error).message);
          }
        }}
      />
      {onSkip && (
        <Button
          label="Set this up later"
          secondary
          disabled={busy}
          onPress={onSkip}
        />
      )}
    </View>
  );
}
