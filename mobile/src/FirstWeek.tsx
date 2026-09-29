import { Text, View } from "react-native";
import { useState } from "react";
import { firstWeekSteps } from "../../src/features/planning/first-week";
import { useHealth } from "./store";
import { Button, Card, s } from "./ui";
export function FirstWeek() {
  const h = useHealth(),
    steps = firstWeekSteps(h.state!);
  const [expanded, setExpanded] = useState(false);
  const next = steps.find((step) => !step.done) ?? steps[steps.length - 1];
  return (
    <Card mint>
      <Text style={s.eyebrow}>SPOT’S PLAN FOR YOUR GROCERIES</Text>
      <Text style={s.h2}>
        A receipt today. Less “what’s for dinner?” tomorrow.
      </Text>
      <Text style={s.muted}>Daily nutrition targets start as generic values. Set your own before using them to assess a meal plan.</Text><Button secondary label="Review daily nutrition targets" onPress={()=>h.setTool('profile')}/>
      <Text style={s.muted}>
        {steps.filter((step) => step.done).length} of {steps.length} steps
        complete.
      </Text>
      {(expanded ? steps : [next]).map((step) => (
        <View key={step.key} style={{ gap: 6 }}>
          <Text style={s.h3}>
            {step.done ? "✓ " : ""}
            {step.title}
          </Text>
          <Text style={s.muted}>{step.detail}</Text>
          <Button
            secondary
            label={`${step.done ? "Review" : "Start"}: ${step.title}`}
            onPress={() => h.setTool(step.action)}
          />
        </View>
      ))}
      <Button
        secondary
        label={expanded ? "Show my next step" : "See the whole journey"}
        onPress={() => setExpanded(!expanded)}
      />
    </Card>
  );
}
