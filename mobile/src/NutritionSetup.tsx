import { Pressable, Text, View } from "react-native";
import { useState } from "react";
import { Button, Choice, Field, s } from "./ui";
import {
  activityLabels,
  adjustmentLabels,
  sexLabels,
  type NutritionSetupDraft,
  type NutritionSetupProps,
} from "../../src/features/progress/nutrition-setup";
import {
  targetKeys,
  useNutritionSetup,
} from "../../src/features/progress/useNutritionSetup";

export function NutritionSetup(props: NutritionSetupProps) {
  const form = useNutritionSetup(props),
    { draft, review, targets, error } = form;
  const [alternatives, setAlternatives] = useState(false);
  return (
    <View style={{ gap: 14 }} pointerEvents={props.busy ? "none" : "auto"}>
      {review ? (
        <>
          <View style={s.hero}>
            <Text style={s.h3}>
              {review === "estimate"
                ? "Your estimated starting targets"
                : "Your own daily targets"}
            </Text>
            <Text style={s.text}>
              {review === "estimate"
                ? `Based on your age, height, ${props.weight?.value} ${props.weight?.unit}, activity and chosen calorie approach. Edit any value before using it.`
                : "Enter targets you already follow. They become your daily comparison only when you save."}
            </Text>
            {review === "estimate" && (
              <Text style={s.tiny}>
                Calories use Mifflin–St Jeor with a broad activity estimate.
                Macros start at 20% protein, 50% carbs and 30% fat. This is a
                starting estimate, not a prediction of when you’ll reach your
                goal.
              </Text>
            )}
          </View>
          {targetKeys.map((key) => (
            <Field
              key={key}
              label={`Daily ${key}${key === "calories" ? "" : " (g)"}`}
              keyboardType="decimal-pad"
              value={targets[key]}
              onChangeText={(value) => form.changeTarget(key, value)}
            />
          ))}
          <Button
            label="Use these daily targets"
            onPress={form.save}
            disabled={props.busy}
          />
          <Button
            label="Edit my details"
            secondary
            onPress={form.back}
            disabled={props.busy}
          />
        </>
      ) : (
        <>
          <Text style={s.muted}>
            These details help turn your food log into a useful daily starting
            point. Your weight comes from the previous step or your latest
            measurement.
          </Text>
          <Field
            label="Age (years)"
            keyboardType="number-pad"
            value={draft.age}
            onChangeText={(age) => form.patch({ age })}
          />
          <Field
            label="Height"
            keyboardType="decimal-pad"
            value={draft.height}
            onChangeText={(height) => form.patch({ height })}
          />
          <Text style={s.h3}>Height unit</Text>
          <Choice
            values={["cm", "in"]}
            labels={{ cm: "cm", in: "inches" }}
            value={draft.heightUnit}
            onChange={(unit) =>
              form.unit(unit as NutritionSetupDraft["heightUnit"])
            }
          />
          <Text style={s.h3}>Usual activity</Text>
          <Choice
            values={Object.keys(activityLabels)}
            labels={activityLabels}
            value={draft.activity}
            onChange={(activity) =>
              form.patch({
                activity: activity as NutritionSetupDraft["activity"],
              })
            }
          />
          <Text style={s.h3}>Sex used for the estimate</Text>
          <Choice
            values={Object.keys(sexLabels)}
            labels={sexLabels}
            value={draft.sex}
            onChange={(sex) =>
              form.patch({ sex: sex as NutritionSetupDraft["sex"] })
            }
          />
          <Text style={s.tiny}>
            The equation uses a male or female coefficient. You can leave this
            unselected and use your own targets or save details only.
          </Text>
          <Text style={s.h3}>Calorie approach</Text>
          <Choice
            values={Object.keys(adjustmentLabels)}
            labels={adjustmentLabels}
            value={draft.adjustment}
            onChange={(adjustment) =>
              form.patch({
                adjustment: adjustment as NutritionSetupDraft["adjustment"],
              })
            }
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: draft.eligible }}
            accessibilityLabel="The standard adult estimate applies to me"
            onPress={() => form.patch({ eligible: !draft.eligible })}
            style={s.card}
          >
            <Text style={s.text}>
              {draft.eligible ? "✓ " : "○ "}The standard adult estimate applies
              to me
            </Text>
          </Pressable>
          <Text style={s.tiny}>
            For adults 18 or older who aren’t pregnant or breastfeeding.
            Otherwise, save your details without an estimate or enter targets
            you already follow.
          </Text>
          <Button
            label="Estimate my targets"
            onPress={form.estimate}
            disabled={props.busy}
          />
        </>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={s.text}
        >
          {error}
        </Text>
      )}
      {props.onSkip && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Other ways to set targets"
          accessibilityState={{ expanded: alternatives }}
          disabled={props.busy}
          onPress={() => setAlternatives(!alternatives)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={s.text}>
            Other ways to set targets {alternatives ? "−" : "+"}
          </Text>
        </Pressable>
      )}
      {(!props.onSkip || alternatives) && (
        <>
          {!review && (
            <Button
              label="Use my own targets"
              secondary
              onPress={form.manual}
              disabled={props.busy}
            />
          )}
          <Button
            label="Save details without targets"
            secondary
            onPress={form.detailsOnly}
            disabled={props.busy}
          />
        </>
      )}
      {props.onSkip && (
        <Button
          label="Skip targets for now"
          secondary
          onPress={props.onSkip}
          disabled={props.busy}
        />
      )}
    </View>
  );
}
