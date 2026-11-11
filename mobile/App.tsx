import { HouseholdMeals } from "./src/HouseholdMeals";
import { addHouseholdTransfer } from "../src/features/household/domain";
import { remainingRecipePortions } from "../src/features/recipes/portions";
import { saveDevice } from "./src/storage";
import { clockTime, mealSchema, today } from "../src/domain";
import { FoodDecisions } from "./src/FoodDecisions";
import NativeLifeContext from "./src/LifeContext";
import type { CapturePurpose } from "../src/ai-contract";
import { SpotAvatar, SpotWordmark } from "./src/Spot";
import { weightCheckIn } from '../src/features/progress/fitness-goal';
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
import { colors, s, IconButton, Button, Sheet } from "./src/ui";
import { QuickAccount } from './src/QuickAccount';
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
import { hasFirstLog } from '../src/features/onboarding/first-log';
import { AccountSync } from "./src/AccountSync";
import { Connections } from "./src/Connections";
import { CoachingScreen } from "./src/CoachingScreen";
function HealthApp() {
  const h = useHealth();
  const welcome = useWelcome();
  const [headerAccountOpen, setHeaderAccountOpen] = useState(false);
  const [decisionCapture, setDecisionCapture] = useState<{prompt: string; purpose: CapturePurpose} | null>(null);

  const [firstMovement, setFirstMovement] = useState(false);
  const tracked = h.state ? hasFirstLog(h.state) : false;
  useEffect(() => { if (welcome.firstLog && tracked) welcome.dismissFirstLog(); }, [welcome.firstLog, tracked, welcome.dismissFirstLog]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (h.tool) {
        setDecisionCapture(null);
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
          <IconButton label="Open account menu" onPress={() => setHeaderAccountOpen(true)}>
            <View style={[s.avatar, { width: 38, height: 38 }]}>
              <UserRound color={colors.green} />
            </View>
          </IconButton>
        </View>
        {headerAccountOpen && <Sheet title="Your account" onClose={() => setHeaderAccountOpen(false)}>
          <QuickAccount onSignIn={() => { setHeaderAccountOpen(false); h.setTool('cloud'); }} />
          <Button label="View your profile" secondary onPress={() => { setHeaderAccountOpen(false); h.setTab('You'); }} />
          <Button label="Connect an assistant" secondary onPress={() => { setHeaderAccountOpen(false); h.setTool('agents'); }} />
          <Button label="Account settings & backups" secondary onPress={() => { setHeaderAccountOpen(false); h.setTool('cloud'); }} />
        </Sheet>}
        <AccountSync />
        {welcome.firstLog && !tracked && <FirstLog focus={welcome.firstLog} onMeal={h.tellSpot} onMovement={() => {setFirstMovement(true);h.setTab('Workouts');}} onLater={welcome.dismissFirstLog} />}
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
        {h.tool === "coaching" && <CoachingScreen />}
        {h.tool === "household" ? <HouseholdMeals candidates={(h.state.recipeBatches ?? []).filter(batch => remainingRecipePortions(batch) > 0).map(batch => ({ id: batch.id, title: batch.name, remainingPortions: remainingRecipePortions(batch), perPortion: { calories: batch.nutrition.calories / batch.totalPortions, protein: batch.nutrition.protein / batch.totalPortions, carbs: batch.nutrition.carbs / batch.totalPortions, fat: batch.nutrition.fat / batch.totalPortions } }))} loggedReservationIds={h.state.meals.flatMap(meal => meal.householdReservationId ? [meal.householdReservationId] : [])} displayName={h.state.profile.name} onClose={() => h.setTool(null)} onPublished={transfer => { h.change(current => ({ ...current, recipeBatches: (current.recipeBatches ?? []).map(batch => batch.id === transfer.sourceBatchId ? addHouseholdTransfer(batch, transfer.householdBatchId, transfer.portions) : batch) })); }} onLogMeal={async proposal => {
          const scope = h.recordScope();
          const applied = h.change(current => current.meals.some(meal => meal.householdReservationId === proposal.householdReservationId) ? current : ({ ...current, meals: [...current.meals, mealSchema.parse({ id: proposal.householdReservationId, title: proposal.title, category: "Dinner", day: h.day, time: clockTime(), source: "Shared household meal", confidence: "estimated", note: proposal.portions + " portions from the household preparation snapshot.", ...proposal.nutrition, householdReservationId: proposal.householdReservationId, householdBatchId: proposal.householdBatchId })] }));
          if (!applied) return false; const next = h.readyRecords(); if (!next) return false; await saveDevice(next); return scope === h.recordScope();
        }} /> : h.tool === "foodHelp" ? <FoodDecisions onClose={() => h.setTool(null)} onCapture={(prompt,purpose) => { setDecisionCapture({prompt,purpose}); h.setTool("capture"); }} /> : h.tool === "lifeContext" ? <NativeLifeContext onClose={() => h.setTool(null)} /> : h.tool === "receipt" || h.tool === "capture" ? (
          <Capture receipt={h.tool === "receipt"} prompt={decisionCapture?.prompt} purpose={decisionCapture?.purpose} onDone={() => setDecisionCapture(null)} />
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
