import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Button, colors, s } from "./ui";
import {
  interactionAccess,
  interactionExamples,
  interactionInstructions,
} from "../../src/features/onboarding/interaction-examples";

export function InteractionGuide({
  onTry,
  tryLabel = "Try with something from today",
}: {
  onTry: () => void;
  tryLabel?: string;
}) {
  const [selected, setSelected] = useState(0);
  const example = interactionExamples[selected];
  return (
    <View style={{ gap: 16 }}>
      <Text style={[s.muted, { color: "#466459" }]}>
        {interactionInstructions}
      </Text>
      <View style={[s.row, { gap: 8 }]}>
        {interactionExamples.map((item, index) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} example`}
            accessibilityState={{ selected: selected === index }}
            onPress={() => setSelected(index)}
            style={{
              flex: 1,
              minHeight: 48,
              padding: 8,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 12,
              borderWidth: 1,
              borderColor: selected === index ? colors.green : colors.line,
              backgroundColor: selected === index ? colors.mint : "white",
            }}
          >
            <Text style={[s.text, { fontWeight: "700", fontSize: 14 }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View
        accessibilityLabel="Example preview"
        accessibilityLiveRegion="polite"
        style={{
          gap: 14,
          padding: 18,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: "white",
        }}
      >
        <Text style={s.eyebrow}>EXAMPLE ONLY · NOTHING IS SAVED</Text>
        <Text style={s.h3}>“{example.input}”</Text>
        <View
          style={{
            gap: 6,
            padding: 14,
            borderRadius: 12,
            backgroundColor: colors.mint,
          }}
        >
          <Text style={s.eyebrow}>WHAT YOU GET</Text>
          <Text style={s.h3}>{example.payoff}</Text>
          {example.preview.map((line) => (
            <Text key={line} style={s.text}>
              {line}
            </Text>
          ))}
        </View>
        <Text style={s.text}>{example.detail}</Text>
        <Text style={[s.tiny, { color: "#466459" }]}>{example.review}</Text>
      </View>
      <Button label={tryLabel} onPress={onTry} />
      <Text style={[s.tiny, { color: "#466459" }]}>{interactionAccess}</Text>
    </View>
  );
}
