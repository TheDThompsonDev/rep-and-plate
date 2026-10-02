import { SpotAvatar, SpotWordmark } from "./src/Spot";
import { weightCheckIn } from '../src/features/progress/fitness-goal';
import { today } from '../src/domain';
import "./src/runtime";
import { Fragment, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  ScanBarcode,
  ChartNoAxesColumnIncreasing,
  Dumbbell,
  CookingPot,
  UserRound,
  Menu,
} from "lucide-react-native";
import { HealthProvider, useHealth, type Tab } from "./src/store";
import { colors, s, IconButton } from "./src/ui";
import { ChatScreen } from "./src/ChatScreen";
import {
  NutritionScreen,
  KitchenScreen,
  WorkoutsScreen,
  YouScreen,
} from "./src/screens";
import { Capture, Scanner, Voice } from "./src/Capture";
import { Profile, Preferences, Connection, Review } from "./src/tools";
import {
  Pantry,
  Recipes,
  Planner,
  WorkoutBuilder,
  Label,
} from "./src/KitchenTools";
import { Shopping } from "./src/Shopping";
import { Cloud } from "./src/Cloud";
import { NativeOnboarding, useWelcome } from "./src/Onboarding";
import { FirstLog } from './src/FirstLog';
import { ManualMeal } from './src/ManualMeal';
import { hasFirstLog } from '../src/features/onboarding/first-log';
import { AccountSync } from "./src/AccountSync";
import { Connections } from "./src/Connections";
function HealthApp() {
  const h = useHealth();
  const welcome = useWelcome();
  const [firstMeal, setFirstMeal] = useState(false), [firstMovement, setFirstMovement] = useState(false);
  const tracked = h.state ? hasFirstLog(h.state) : false;
  useEffect(() => { if (welcome.firstLog && tracked) welcome.dismissFirstLog(); }, [welcome.firstLog, tracked, welcome.dismissFirstLog]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (h.tool) {
        h.setTool(null);
        return true;
      }
      if (h.tab !== "Chat") {
        h.setTab("Chat");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [h.tool, h.tab]);
  if (!h.state)
    return (
      <SafeAreaView
        style={[
          s.fill,
          { alignItems: "center", justifyContent: "center", padding: 25 },
        ]}
      >
        {h.error ? (
          <Text style={s.text}>{h.error}</Text>
        ) : (
          <ActivityIndicator color={colors.green} />
        )}
      </SafeAreaView>
    );
  const tabs = [
    ["Chat", ScanBarcode],
    ["Nutrition", ChartNoAxesColumnIncreasing],
    ["Scan", ScanBarcode],
    ["Workouts", Dumbbell],
    ["Kitchen", CookingPot],
  ] as const;
  return (
    <SafeAreaView style={s.fill}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={s.fill}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
      >
        <View
          style={[s.between, { paddingHorizontal: 15, paddingVertical: 8 }]}
        >
          <IconButton label="Open menu" onPress={() => h.setTab("You")}>
            <Menu color={colors.ink} />
          </IconButton>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rep & Plate home"
            onPress={() => h.setTab("Chat")}
          >
            <SpotWordmark />
          </Pressable>
          <IconButton label="Your profile" onPress={() => h.setTab("You")}>
            <View style={[s.avatar, { width: 38, height: 38 }]}>
              <UserRound color={colors.green} />
            </View>
          </IconButton>
        </View>
        <AccountSync />
        {welcome.firstLog && !tracked && <FirstLog focus={welcome.firstLog} onMeal={() => setFirstMeal(true)} onMovement={() => {setFirstMovement(true);h.setTab('Workouts');}} onLater={welcome.dismissFirstLog} />}
        {firstMeal && <ManualMeal day={h.day} onClose={() => setFirstMeal(false)} onSaved={() => {setFirstMeal(false);h.setTab('Nutrition');}} />}
        {h.state.profile.fitnessGoal && h.tab !== 'You' && weightCheckIn(h.state.bodyWeights ?? [], h.state.profile.fitnessGoal, today()).due && <Pressable accessibilityRole="button" accessibilityLabel="Log your weight" onPress={() => h.setTab('You')} style={[s.hero, { padding: 12, marginHorizontal: 15 }]}><Text style={s.h3}>{weightCheckIn(h.state.bodyWeights ?? [], h.state.profile.fitnessGoal, today()).text}</Text><Text style={s.muted}>Log your weight →</Text></Pressable>}
        <Connections />
        {!!h.notice && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
            onPress={() => h.setNotice("")}
            style={{
              backgroundColor: colors.ink,
              padding: 12,
              marginHorizontal: 15,
              borderRadius: 12,
              flexDirection: "row",
              gap: 8,
            }}
          >
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: "white", fontSize: 14, flex: 1 }}
            >
              {h.notice}
            </Text>
            <Text style={{ color: "white", fontSize: 14 }}>Dismiss</Text>
          </Pressable>
        )}
        <Fragment key={h.recordsRevision}>
          {h.tab === "Chat" ? (
            <ChatScreen />
          ) : h.tab === "Nutrition" ? (
            <NutritionScreen />
          ) : h.tab === "Kitchen" ? (
            <KitchenScreen />
          ) : h.tab === "Workouts" ? (
            <WorkoutsScreen key={String(firstMovement)} startWithMovement={firstMovement && !!welcome.firstLog && !tracked} onFirstMovementClose={() => setFirstMovement(false)} />
          ) : (
            <YouScreen />
          )}
        </Fragment>
        <View
          style={[
            s.row,
            {
              gap: 0,
              borderTopWidth: 1,
              borderColor: colors.line,
              paddingTop: 7,
            },
          ]}
        >
          {tabs.map(([name, Icon]) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={name === "Scan" ? "Scan a barcode" : name}
              accessibilityState={{ selected: h.tab === name }}
              onPress={() =>
                name === "Scan"
                  ? h.setTool("scan")
                  : name === "Chat"
                    ? h.tellSpot()
                    : h.setTab(name as Tab)
              }
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 8,
                gap: 5,
              }}
            >
              <View
                style={
                  name === "Scan"
                    ? {
                        backgroundColor: colors.green,
                        borderRadius: 20,
                        padding: 8,
                        marginTop: -14,
                      }
                    : {
                        width: 24,
                        height: 24,
                        alignItems: "center",
                        justifyContent: "center",
                      }
                }
              >
                {name === "Chat" ? (
                  <SpotAvatar size={34} expression="welcome" />
                ) : (
                  <Icon
                    size={24}
                    color={
                      name === "Scan"
                        ? "white"
                        : h.tab === name
                          ? colors.green
                          : colors.muted
                    }
                  />
                )}
              </View>
              <Text
                style={[
                  s.tiny,
                  { color: h.tab === name ? colors.green : colors.muted },
                ]}
              >
                {name}
              </Text>
            </Pressable>
          ))}
        </View>
      </KeyboardAvoidingView>
      <Fragment key={h.tool === "cloud" ? "account-tool" : h.recordsRevision}>
        {h.tool === "receipt" || h.tool === "capture" ? (
          <Capture receipt={h.tool === "receipt"} />
        ) : h.tool === "scan" ? (
          <Scanner />
        ) : h.tool === "voice" ? (
          <Voice />
        ) : h.tool === "profile" ? (
          <Profile />
        ) : h.tool === "preferences" ? (
          <Preferences />
        ) : h.tool === "connection" ? (
          <Connection />
        ) : h.tool === "review" ? (
          <Review />
        ) : h.tool === "pantry" ? (
          <Pantry />
        ) : h.tool === "recipes" ? (
          <Recipes />
        ) : h.tool === "planner" ? (
          <Planner />
        ) : h.tool === "workout" ? (
          <WorkoutBuilder />
        ) : h.tool === "shopping" ? (
          <Shopping />
        ) : h.tool === "cloud" ? (
          <Cloud />
        ) : h.tool === "label" ? (
          <Label />
        ) : null}
      </Fragment>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <HealthProvider>
        <NativeOnboarding>
          <HealthApp />
        </NativeOnboarding>
      </HealthProvider>
    </SafeAreaProvider>
  );
}
