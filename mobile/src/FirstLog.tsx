import { Pressable, Text, View } from "react-native";
import { Button, colors, s } from "./ui";
import { firstLogCopy } from "../../src/features/onboarding/first-log";

export function FirstLog({
  focus,
  onMeal,
  onMovement,
  onLater,
}: {
  focus: string;
  onMeal: () => void;
  onMovement: () => void;
  onLater: () => void;
}) {
  const movement = focus === "Movement & workouts";
  return (
    <View style={[s.hero, { marginHorizontal: 15, padding: 14, gap: 6 }]}>
      <Text accessibilityRole="header" style={s.h3}>
        {firstLogCopy.title}
      </Text>
      <Text style={s.tiny}>{firstLogCopy.detail}</Text>
      <Button
        label={movement ? "Log my first movement" : "Log my first meal"}
        onPress={movement ? onMovement : onMeal}
      />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable
          accessibilityRole="button"
          onPress={movement ? onMeal : onMovement}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: colors.green }}>
            {movement ? "Log a meal instead" : "Log movement instead"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onLater}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: colors.green }}>I’ll log later</Text>
        </Pressable>
      </View>
    </View>
  );
}
