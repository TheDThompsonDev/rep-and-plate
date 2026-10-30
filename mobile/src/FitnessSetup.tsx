import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Choice, Field, colors, s } from "./ui";
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
import {
  equipmentChoices,
  equipmentLabels,
  experienceLabels,
  trainingDayChoices,
  type Experience,
  type TrainingProgram,
} from "../../src/features/progress/training-program";

const dayLabels = Object.fromEntries(trainingDayChoices.map((days) => [String(days), `${days} days`]));

export function FitnessSetup({
  goal,
  program,
  weight,
  initialDraft,
  onDraftChange,
  onSave,
  onSkip,
  busy = false,
}: {
  goal?: FitnessGoal;
  /** Existing training week; pre-fills the week fields so re-saving the goal keeps it. */
  program?: TrainingProgram;
  weight?: BodyWeightEntry;
  initialDraft?: FitnessSetupDraft;
  onDraftChange?: (draft: FitnessSetupDraft) => void;
  onSave: (draft: FitnessSetupDraft) => void;
  onSkip?: () => void;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState(() => initialDraft ?? fitnessDraft(goal, program)),
    [error, setError] = useState("");
  const weekChosen = draft.trainingDays.trim() !== "";
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
      <Text style={s.h3}>Your training week (optional)</Text>
      <Text style={s.muted}>Training days per week</Text>
      <Choice
        values={["", ...trainingDayChoices.map(String)]}
        labels={{ "": program ? "Keep my current week" : "Not now", ...dayLabels }}
        value={draft.trainingDays}
        onChange={(trainingDays) => patch({ trainingDays })}
      />
      {weekChosen && (
        <>
          <Text style={s.muted}>Available equipment</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {equipmentChoices.map((item) => {
              const checked = draft.equipment.includes(item);
              return (
                <Pressable
                  key={item}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={equipmentLabels[item]}
                  disabled={busy}
                  onPress={() =>
                    patch({
                      equipment: checked
                        ? draft.equipment.filter((value) => value !== item)
                        : [...draft.equipment, item],
                    })
                  }
                  style={[s.pill, checked && { backgroundColor: colors.mint, borderColor: colors.green }]}
                >
                  <Text style={[s.muted, checked && { color: colors.green, fontWeight: "600" }]}>
                    {equipmentLabels[item]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.tiny}>
            Bodyweight movements are always included. Leave these unchecked if you train without equipment.
          </Text>
          <Text style={s.muted}>Strength training experience</Text>
          <Choice
            values={["", ...Object.keys(experienceLabels)]}
            labels={{ "": "Prefer not to say", ...experienceLabels }}
            value={draft.experience}
            onChange={(experience) => patch({ experience: experience as Experience | "" })}
          />
          <Text style={s.tiny}>
            Your week uses the starter plans, matched to your equipment. Rep targets are starting points you
            confirm, and you choose every load yourself; nothing is prescribed or treated as a record.
          </Text>
        </>
      )}
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
