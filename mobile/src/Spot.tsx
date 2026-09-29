import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Image, Text, View } from "react-native";
import { CircleDot } from "lucide-react-native";
import {
  spotIntro,
  spotPose,
  spotWeek,
  type SpotExpression,
  type SpotSide,
} from "../../src/features/spot/model";
import { useHealth } from "./store";
import { Button, Card, Choice, colors, s } from "./ui";
import { spotScenes, type SpotSceneName } from "../../src/features/spot/scenes";
import {
  spotGreetingMoods,
  spotMoments,
  spotReactionFrame,
  type SpotMomentName,
  type SpotReactionName,
} from "../../src/features/spot/personality";

const atlas = require("../assets/spot/spot-atlas.png");
const sceneImages = {
  "press-conference": require("../assets/spot/scenes/press-conference.png"),
  "dinner-conspiracy": require("../assets/spot/scenes/dinner-conspiracy.png"),
  "leg-funeral": require("../assets/spot/scenes/leg-funeral.png"),
  "shaker-ritual": require("../assets/spot/scenes/shaker-ritual.png"),
  "recovery-department": require("../assets/spot/scenes/recovery-department.png"),
};
export function SpotScene({
  scene,
  compact = false,
}: {
  scene: SpotSceneName;
  compact?: boolean;
}) {
  const h = useHealth();
  const [failedScene, setFailedScene] = useState<SpotSceneName | null>(null);
  if (h.state?.spot?.visuals === false || failedScene === scene) return null;
  return (
    <Image
      key={scene}
      testID={`spot-scene-${scene}`}
      source={sceneImages[scene]}
      accessibilityLabel={spotScenes[scene].alt}
      accessible
      resizeMode="contain"
      onError={() => setFailedScene(scene)}
      style={{
        width: compact ? 82 : 220,
        height: compact ? 82 : 220,
        maxWidth: "100%",
        borderRadius: 18,
        alignSelf: "center",
        flexShrink: 0,
        backgroundColor: "#173e30",
      }}
    />
  );
}
const reactions = require("../assets/spot/spot-reactions.png");
const peekingSpot = require("../assets/spot/spot-peek.png");
const reactionImages = {
  peek: peekingSpot,
  tired: reactions,
  burger: reactions,
  cool: reactions,
  coffee: require("../assets/spot/expansion/coffee.png"),
  detective: require("../assets/spot/expansion/detective.png"),
  chef: require("../assets/spot/expansion/chef.png"),
  blanket: require("../assets/spot/expansion/blanket.png"),
  calculator: require("../assets/spot/expansion/calculator.png"),
  groceries: require("../assets/spot/expansion/groceries.png"),
  stretch: require("../assets/spot/expansion/stretch.png"),
  proud: require("../assets/spot/expansion/proud.png"),
  water: require("../assets/spot/expansion/water.png"),
  dumbbell: require("../assets/spot/expansion/dumbbell.png"),
  shrug: require("../assets/spot/expansion/shrug.png"),
  planner: require("../assets/spot/expansion/planner.png"),
};
export function SpotReaction({
  reaction,
  size = 120,
}: {
  reaction: SpotReactionName;
  size?: number;
}) {
  const h = useHealth();
  const [failed, setFailed] = useState(false);
  if (h.state?.spot?.visuals === false || failed) return null;
  const frame = spotReactionFrame(reaction, size);
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        overflow: "hidden",
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{ width: frame.width, height: frame.height, overflow: "hidden" }}
      >
        <Image
          source={reactionImages[reaction]}
          onError={() => setFailed(true)}
          resizeMode="stretch"
          style={{
            position: "absolute",
            width: frame.atlasSize,
            height: frame.atlasSize,
            left: frame.left,
            top: frame.top,
          }}
        />
      </View>
    </View>
  );
}
export function SpotMoment({ moment }: { moment: SpotMomentName }) {
  const copy = spotMoments[moment];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 12,
        paddingLeft: 4,
        borderRadius: 20,
        backgroundColor: "#eaf4ed",
      }}
    >
      {"scene" in copy ? (
        <SpotScene scene={copy.scene} compact />
      ) : (
        <SpotReaction reaction={copy.reaction} size={88} />
      )}
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={[s.h3, { color: "#164b3e" }]}>{copy.title}</Text>
        <Text style={[s.muted, { fontSize: 13, color: "#4d6d60" }]}>
          {copy.caption}
        </Text>
      </View>
    </View>
  );
}
const leaningSpot = require("../assets/spot/spot-lean.png");
export function SpotWordmark() {
  const h = useHealth();
  const [failed, setFailed] = useState(false);
  const visible = h.state?.spot?.visuals !== false && !failed;
  return (
    <View
      style={{
        height: 52,
        justifyContent: "center",
        paddingRight: visible ? 36 : 0,
      }}
    >
      <View style={{ transform: [{ translateY: visible ? 7 : 0 }] }}>
        <Text
          style={[
            s.h2,
            {
              color: colors.green,
              fontSize: 24,
              lineHeight: 28,
              letterSpacing: -1,
            },
          ]}
        >
          Rep & Plate
        </Text>
        {visible && (
          <Image
            source={leaningSpot}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            onError={() => setFailed(true)}
            resizeMode="contain"
            style={{
              position: "absolute",
              width: 56,
              height: 56,
              right: -40,
              top: -23,
            }}
          />
        )}
      </View>
    </View>
  );
}
export function SpotAvatar({
  side = "plate",
  expression = "default",
  size = 72,
}: {
  side?: SpotSide;
  expression?: SpotExpression;
  size?: number;
}) {
  const h = useHealth();
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [turn] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (live) setReduced(v);
    });
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      live = false;
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (reduced) {
      turn.setValue(1);
      return;
    }
    turn.setValue(0);
    const animation = Animated.timing(turn, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [side, reduced, turn]);
  const pose = spotPose({ side, expression });
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        overflow: "hidden",
        borderRadius: size * 0.24,
      }}
    >
      {h.state?.spot?.visuals !== false && !failed ? (
        <Animated.View
          style={{
            width: size,
            height: size,
            overflow: "hidden",
            transform: [
              { perspective: 500 },
              {
                rotateY: turn.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["-75deg", "0deg"],
                }),
              },
            ],
          }}
        >
          <Image
            source={atlas}
            accessibilityIgnoresInvertColors
            onError={() => setFailed(true)}
            style={{
              position: "absolute",
              width: size * 3,
              height: size * 2,
              left: -(pose % 3) * size,
              top: -Math.floor(pose / 3) * size,
            }}
            resizeMode="stretch"
          />
        </Animated.View>
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.mint,
          }}
        >
          <CircleDot size={size * 0.45} color={colors.green} />
        </View>
      )}
    </View>
  );
}
export function SpotCheckHeading({ side = "plate" }: { side?: SpotSide }) {
  return (
    <View style={s.row}>
      {side === "plate" ? (
        <SpotReaction reaction="detective" size={48} />
      ) : (
        <SpotAvatar side={side} expression="confused" size={48} />
      )}
      <View>
        <Text style={s.eyebrow}>{side === "rep" ? "WORKOUT" : "PLATE"}</Text>
        <Text style={s.h2}>Spot Check</Text>
      </View>
    </View>
  );
}
export function SpotWelcome({
  intro,
  comeback,
  onDone,
  onCapture,
  onCatchup,
}: {
  intro: boolean;
  comeback: boolean;
  onDone: () => void;
  onCapture: () => void;
  onCatchup: () => void;
}) {
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState(0);
  const screen = spotIntro[step];
  const greeting = spotMoments[spotGreetingMoods[mood]];
  const finish = () => {
    onDone();
    onCapture();
  };
  if (intro)
    return (
      <View
        style={{
          backgroundColor: "#f7f5eb",
          borderColor: "#d9e3d6",
          borderWidth: 1,
          borderRadius: 24,
          padding: 14,
          gap: 12,
          marginBottom: 16,
        }}
      >
        <View style={s.between}>
          <Text style={[s.eyebrow, { fontSize: 9, color: "#527167" }]}>
            MEET SPOT · {step + 1} OF {spotIntro.length}
          </Text>
          <Button label="Skip intro" secondary onPress={finish} />
        </View>
        <SpotScene scene={screen.scene} />
        <Text
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          style={[s.title, { fontSize: 26, lineHeight: 30, color: "#153e31" }]}
        >
          {screen.title}
        </Text>
        <Text
          style={[s.h3, { fontSize: 16, lineHeight: 22, color: "#174831" }]}
        >
          {screen.punchline}
        </Text>
        <Text
          style={[s.muted, { fontSize: 13, lineHeight: 20, color: "#516c5d" }]}
        >
          {screen.detail}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {step > 0 && (
            <Button
              label="Back"
              secondary
              onPress={() => setStep((n) => n - 1)}
            />
          )}
          <View style={{ flex: 1, minWidth: 150 }}>
            <Button
              label={
                step < spotIntro.length - 1
                  ? "Next"
                  : "Try it. What happened today?"
              }
              onPress={() =>
                step < spotIntro.length - 1 ? setStep((n) => n + 1) : finish()
              }
            />
          </View>
        </View>
      </View>
    );
  return (
    <View
      style={{
        backgroundColor: "#f5f4ed",
        borderRadius: 24,
        padding: 20,
        gap: 14,
        marginBottom: 16,
      }}
    >
      <Text style={[s.eyebrow, { fontSize: 9, color: "#527167" }]}>
        YOUR FOOD. YOUR REPS. YOUR PACE.
      </Text>
      {!comeback && "scene" in greeting && <SpotScene scene={greeting.scene} />}
      <View style={[s.row, { gap: 6 }]}>
        <View style={[s.grow, { gap: 10 }]}>
          <Text
            accessibilityRole="header"
            style={[
              s.title,
              { fontSize: 26, lineHeight: 31, color: "#123f35" },
            ]}
          >
            {comeback ? "Oh hey." : greeting.title}
          </Text>
          <Text style={[s.muted, { color: "#526b61" }]}>
            {comeback ? "Start with today." : greeting.caption}
          </Text>
          {comeback && (
            <Text style={s.tiny}>Same tiny shoes. Same big support.</Text>
          )}
        </View>
        {(comeback || !("scene" in greeting)) && (
          <SpotReaction
            reaction={comeback ? "peek" : greeting.reaction}
            size={115}
          />
        )}
      </View>
      {comeback ? (
        <>
          <Button label="Log something" onPress={finish} />
          <Button
            label="Catch me up"
            secondary
            onPress={() => {
              onDone();
              onCatchup();
            }}
          />
        </>
      ) : (
        <>
          <Text style={s.tiny}>Tell me what you ate or what you did.</Text>
          <Button label="Tell Spot" onPress={onCapture} />
          <Button
            label="Another Spot mood"
            secondary
            onPress={() => setMood((m) => (m + 1) % spotGreetingMoods.length)}
          />
        </>
      )}
    </View>
  );
}

export function SpotWeeklyReview() {
  const h = useHealth();
  const week = spotWeek(h.state!);
  const [side, setSide] = useState<SpotSide>("plate");
  return (
    <Card>
      <View style={s.between}>
        <View style={s.grow}>
          <Text style={s.eyebrow}>A LITTLE PERSPECTIVE</Text>
          <Text style={s.h2}>Weekly Spot Check</Text>
          <Text style={s.tiny}>
            {week.start} – {week.end}
          </Text>
        </View>
        <SpotAvatar side={side} expression="proud" size={95} />
      </View>
      <Choice
        values={["Plate · Food", "Rep · Training"]}
        value={side === "plate" ? "Plate · Food" : "Rep · Training"}
        onChange={(v) => setSide(v.startsWith("Plate") ? "plate" : "rep")}
      />
      {side === "plate" ? (
        <>
          <Text style={s.h2}>
            {week.calories?.toLocaleString() ?? "—"} avg recorded cal
          </Text>
          <Text style={s.h2}>
            {week.protein === null ? "—" : `${week.protein}g`} avg recorded
            protein
          </Text>
          <Text style={s.muted}>
            Across {week.loggedDays} days with meals logged. Recorded amounts,
            not estimates of everything you ate.
          </Text>
        </>
      ) : (
        <>
          <Text style={s.h2}>{week.completed} completed workouts</Text>
          <Text style={s.h2}>
            {week.volume.toLocaleString()} lb recorded volume
          </Text>
          <Text style={s.muted}>
            Completed sessions only. Recorded load × reps, excluding bodyweight
            and unrecorded work.
          </Text>
        </>
      )}
      <Text style={s.tiny}>
        Unlogged days are unknown. Start wherever you are.
      </Text>
    </Card>
  );
}
