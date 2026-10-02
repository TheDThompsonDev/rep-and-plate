import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  introduction,
  focusChoices,
  firstStepForFocus,
  ONBOARDING_KEY,
} from "../../src/features/onboarding/model";
import {
  useOnboarding,
  type OnboardingAdapter,
} from "../../src/features/onboarding/useOnboarding";
import { cloudClient } from "./api";
import { deviceOwnership } from "./storage";
import { requireDeviceOwner } from "./auth";
import { useHealth } from "./store";
import { Button, Field, s, colors } from "./ui";
import { SpotScene } from "./Spot";
import { PasswordRecovery } from "./PasswordRecovery";
import { InteractionGuide } from './InteractionGuide';
import { interactionTitle } from '../../src/features/onboarding/interaction-examples';
import { today } from '../../src/domain';
import { FitnessSetup } from './FitnessSetup';
import type { FitnessSetupDraft } from '../../src/features/progress/fitness-goal';
import { NutritionSetup } from './NutritionSetup';
import type { NutritionSetupDraft, NutritionSetupResult } from '../../src/features/progress/nutrition-setup';

const adapter: OnboardingAdapter = {
  read: () => AsyncStorage.getItem(ONBOARDING_KEY),
  write: (value) => AsyncStorage.setItem(ONBOARDING_KEY, value),
  owner: deviceOwnership.get,
  client: cloudClient,
  verifyOwner: requireDeviceOwner,
  readDraft: key => AsyncStorage.getItem(key),
  writeDraft: (key, value) => value === null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, value),
};
const WelcomeContext = createContext({ replay: () => {}, firstLog: null as string | null, dismissFirstLog: () => {} });
export const useWelcome = () => useContext(WelcomeContext);
export function NativeOnboarding({ children }: { children: ReactNode }) {
  const h = useHealth(),
    flow = useOnboarding(adapter);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const { name, focus, fitness, nutrition, nutritionInput } = flow.draft;
  const setName = (name: string) => flow.patchDraft({ name });
  const setFocus = (focus: string) => flow.patchDraft({ focus });
  const setFitness = (fitness: FitnessSetupDraft | null) => flow.patchDraft({ fitness });
  const setNutrition = (nutrition: NutritionSetupResult | null) => flow.patchDraft({ nutrition });
  const setNutritionInput = (nutritionInput: NutritionSetupDraft) => flow.patchDraft({ nutritionInput });
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [flow.step, flow.slide]);
  const intro = introduction[flow.slide];
  const title = (text: string) => (
    <Text
      accessibilityRole="header"
      style={[s.title, { fontSize: 33, lineHeight: 39, color: "#073f35" }]}
    >
      {text}
    </Text>
  );
  const text = (value: string) => (
    <Text style={[s.text, { color: "#466459" }]}>{value}</Text>
  );
  const link = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={flow.busy}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Text
        style={{
          color: colors.green,
          textDecorationLine: "underline",
          textAlign: "center",
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <WelcomeContext.Provider value={{ replay: flow.replay, firstLog: flow.firstLog, dismissFirstLog: flow.dismissFirstLog }}>
      {flow.entered && (
        <View style={{ flex: 1, display: flow.replaying ? "none" : "flex" }}>
          {children}
        </View>
      )}
      {(!flow.entered || flow.replaying) && (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#faf8ef" }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : Platform.OS === "android"
                  ? "height"
                  : undefined
            }
          >
            <View
              style={[
                s.between,
                { paddingHorizontal: 22, paddingVertical: 12 },
              ]}
            >
              <Text style={[s.h2, { color: "#073f35" }]}>Rep & Plate</Text>
              {flow.replaying
                ? link("Close tour", flow.closeReplay)
                : flow.user
                  ? link("Sign out", () => void flow.signOut())
                  : link("Sign in", () => flow.account("signin"))}
            </View>
            <ScrollView
              ref={scroll}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 22,
                paddingTop: 10,
                paddingBottom: 50,
                gap: 18,
                maxWidth: 500,
                width: "100%",
                alignSelf: "center",
              }}
            >
              {!['guide', 'goals', 'nutrition'].includes(flow.step) && <SpotScene
                scene={flow.step === "intro" ? intro.scene : "press-conference"}
              />}
              {flow.loading ? (
                <>
                  <ActivityIndicator color={colors.green} />
                  {text("Checking your account and this device…")}
                </>
              ) : (
                <>
                  {flow.step === "welcome" && (
                    <>
                      <Text style={s.eyebrow}>
                        YOUR NEW SIDEKICK HAS ARRIVED
                      </Text>
                      {title("Track your food. Build your fitness. With a little help from Spot.")}
                      {text(
                        "Tell Spot what you ate or how you moved. Review the details, track your calories and workouts, and see your day add up. Grocery receipts help keep the foods you buy handy for later.",
                      )}
                      <Button label="Meet Spot" onPress={flow.startTour} />
                      <Button secondary label="See what I can do" onPress={() => flow.setStep('guide')}/>
                      <Button
                        secondary
                        label={
                          flow.user
                            ? "Continue with my account"
                            : "Create account"
                        }
                        onPress={() =>
                          flow.user
                            ? flow.setStep("setup")
                            : flow.account("signup")
                        }
                      />
                      <Text style={s.tiny}>
                        Start with one meal or workout. Manual tracking works on this device.
                        Connected AI needs an approved account during private preview.
                      </Text>
                    </>
                  )}
                  {flow.step === "intro" && (
                    <>
                      <Text style={s.eyebrow}>
                        MEET SPOT · {flow.slide + 1} OF {introduction.length}
                      </Text>
                      {title(intro.title)}
                      <Text style={s.h3}>{intro.line}</Text>
                      {text(intro.detail)}
                      <Button
                        label={
                          flow.slide < introduction.length - 1
                            ? "Next"
                            : flow.replaying
                              ? "Back to my app"
                              : "Let’s make this official"
                        }
                        onPress={() =>
                          flow.slide === 0
                            ? flow.setStep('guide')
                            : flow.slide < introduction.length - 1
                            ? flow.setSlide(flow.slide + 1)
                            : flow.nextAfterTour()
                        }
                      />
                      <View style={s.between}>
                        {link("Back", () =>
                          flow.slide
                            ? flow.setSlide(flow.slide - 1)
                            : flow.replaying
                              ? flow.closeReplay()
                              : flow.setStep("welcome"),
                        )}
                        {link(
                          flow.replaying ? "Close tour" : "Skip to account",
                          flow.nextAfterTour,
                        )}
                      </View>
                    </>
                  )}
                  {flow.step === 'guide' && <>
                    <Text style={s.eyebrow}>A FEW WORDS. A USEFUL NEXT STEP.</Text>
                    {title(interactionTitle)}
                    <InteractionGuide onTry={flow.nextAfterTour} tryLabel={flow.replaying ? 'Back to my app' : 'Set up my tracking'}/>
                    {link('Back', () => { flow.setSlide(0); flow.setStep('intro'); })}
                    {link('More about Spot', () => { flow.setSlide(1); flow.setStep('intro'); })}
                  </>}
                  {flow.step === "account" && (
                    <>
                      <Text style={s.eyebrow}>SPOT SAVED YOU A SEAT</Text>
                      {title(
                        flow.mode === "signup"
                          ? "Make it official."
                          : "Welcome back.",
                      )}
                      {text(
                        flow.mode === "signup"
                          ? "Create your Rep & Plate account. Spot is already rehearsing your welcome speech."
                          : "Sign in to your account. Your plate has been very normal about waiting.",
                      )}
                      {flow.user ? (
                        <>
                          {text(`Signed in as ${flow.user.email}`)}
                          <Button
                            label="Continue setup"
                            onPress={() => flow.setStep("setup")}
                          />
                        </>
                      ) : (
                        <>
                          <Field
                            label="Email"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            editable={!flow.busy}
                          />
                          <Field
                            label="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                            autoComplete={
                              flow.mode === "signup"
                                ? "new-password"
                                : "current-password"
                            }
                            editable={!flow.busy}
                          />
                          {flow.mode === "signup" && (
                            <Text style={s.tiny}>At least 8 characters.</Text>
                          )}
                          <Button
                            label={
                              flow.busy
                                ? "One moment…"
                                : flow.mode === "signup"
                                  ? "Create account"
                                  : "Sign in"
                            }
                            disabled={
                              flow.busy ||
                              !flow.client ||
                              !/^\S+@\S+\.\S+$/.test(email) ||
                              password.length < (flow.mode === "signup" ? 8 : 1)
                            }
                            onPress={() =>
                              void flow
                                .authenticate(email, password)
                                .then(() => setPassword(""))
                            }
                          />
                          {link(
                            flow.mode === "signup"
                              ? "Already have an account? Sign in"
                              : "New here? Create account",
                            () => {
                              setPassword("");
                              flow.account(
                                flow.mode === "signup" ? "signin" : "signup",
                              );
                            },
                          )}
                        </>
                      )}
                      {flow.available === false && (
                        <>
                          {text(
                            "Account connection is unavailable right now. Check your connection and try again.",
                          )}
                          <Button
                            secondary
                            label="Retry connection"
                            onPress={flow.retry}
                          />
                        </>
                      )}
                      {!flow.user && flow.mode === "signin" && (
                        <PasswordRecovery client={flow.client} />
                      )}
                      {!flow.owner && !flow.user && (
                        <>
                          {link("Try on this device first", flow.tryLocal)}
                          <Text style={s.tiny}>
                            Manual tracking works without an account. AI and
                            connected tools need an approved account during
                            private preview.
                          </Text>
                        </>
                      )}
                      {!!flow.owner && (
                        <Text style={s.tiny}>
                          Each account keeps separate records on this device.
                          Sign in to open yours.
                        </Text>
                      )}
                      {link("Meet Spot first", flow.startTour)}
                    </>
                  )}
                  {flow.step === "setup" && (
                    <>
                      <Text style={s.eyebrow}>
                        YOUR PACE. SPOT’S ENTHUSIASM.
                      </Text>
                      {title("What should I call you?")}
                      {text(
                        "One tiny introduction before I become unnecessarily invested in your day.",
                      )}
                      <Field
                        label="Your name"
                        value={name}
                        onChangeText={setName}
                        maxLength={60}
                        autoComplete="given-name"
                        editable={!flow.busy}
                      />
                      <Text style={s.h3}>Where would you like to start?</Text>
                      {focusChoices.map((value) => (
                        <Pressable
                          key={value}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: focus === value }}
                          accessibilityLabel={value}
                          onPress={() => setFocus(value)}
                          style={{
                            padding: 16,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor:
                              focus === value ? colors.green : colors.line,
                            backgroundColor:
                              focus === value ? colors.mint : "white",
                          }}
                        >
                          <Text style={s.text}>{value}</Text>
                        </Pressable>
                      ))}
                      {!flow.localMode && (
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: flow.confirmed }}
                          accessibilityLabel={
                            flow.owner
                              ? "Open this account’s separate records"
                              : "These device records are mine"
                          }
                          onPress={() => flow.setConfirmed(!flow.confirmed)}
                          style={[
                            s.row,
                            { alignItems: "flex-start", paddingVertical: 12 },
                          ]}
                        >
                          <Text style={s.h3}>{flow.confirmed ? "☑" : "☐"}</Text>
                          <Text style={[s.muted, { flex: 1 }]}>
                            {flow.owner
                              ? "Open this account’s separate records. Existing records stay with their original account."
                              : `These device records are mine. Link them to ${flow.user?.email || "my account"}.`}
                          </Text>
                        </Pressable>
                      )}
                      <Text style={s.tiny}>
                        {flow.localMode
                          ? "Your records stay on this device. Export a backup or sign in to save them to an account."
                          : "Your account saves changes automatically. Other accounts keep separate records."}
                      </Text>
                      <Button
                        label={
                          flow.busy ? "One moment…" : "That’s me. Let’s go."
                        }
                        disabled={
                          flow.busy || !name.trim() || (!flow.localMode && !flow.confirmed)
                        }
                        onPress={() => void flow.prepare(name)}
                      />
                      {link("Back to account", () => flow.account("signin"))}
                    </>
                  )}
                  {flow.step === 'goals' && <>
                    <Text style={s.eyebrow}>YOUR STARTING POINT</Text>
                    {title('What are you working toward?')}
                    {text('Let’s give your tracking a little direction. Start with what you know today.')}
                    <FitnessSetup initialDraft={flow.draft.fitnessInput ?? fitness ?? undefined} onDraftChange={fitnessInput => flow.patchDraft({ fitnessInput })} busy={flow.busy} onSave={draft => { setFitness(draft); setNutrition(null); flow.patchDraft({ nutritionSession: undefined }); flow.setStep('nutrition'); }} onSkip={() => { setFitness(null); setNutrition(null); flow.patchDraft({ nutritionSession: undefined }); flow.setStep('nutrition'); }} />
                    {link('Back to your introduction', () => flow.setStep('setup'))}
                  </>}
                  {flow.step === 'nutrition' && <>
                    <Text style={s.eyebrow}>A STARTING POINT THAT FITS YOU</Text>
                    {title('Your daily targets.')}
                    <NutritionSetup initialDraft={nutritionInput} onDraftChange={setNutritionInput} initialSession={flow.draft.nutritionSession} onSessionChange={nutritionSession => flow.patchDraft({ nutritionSession })} baseline={h.state?.profile.nutritionBaseline} kind={fitness?.kind} weight={fitness?.currentWeight.trim() ? {value:Number(fitness.currentWeight),unit:fitness.unit} : h.state?.bodyWeights?.filter(entry => entry.day <= today()).slice().sort((a,b) => a.day.localeCompare(b.day)).at(-1)} existingTargets={h.state?.profile.targetsConfigured ? h.state.profile : undefined} onSave={result => {setNutrition(result);flow.setStep('ready');}} onSkip={() => {setNutrition(null);flow.setStep('ready');}} busy={flow.busy} />
                    {link('Back to your goals', () => flow.setStep('goals'))}
                  </>}
                  {flow.step === "ready" && (
                    <>
                      <Text style={s.eyebrow}>OFFICIALLY IN YOUR CORNER</Text>
                      {title(
                        name.trim()
                          ? `We’re a team, ${name.trim()}.`
                          : "We’re a team.",
                      )}
                      {text(
                        "You bring the real life. Spot brings the backup dancers nobody asked for.",
                      )}
                      <View style={s.hero}>
                        <Text style={s.h3}>Your first small step</Text>
                        {text(
                          firstStepForFocus(focus),
                        )}
                      </View>
                      <Text style={s.tiny}>
                        {flow.localMode
                          ? "You’re starting with manual tracking on this device. Create an account from your profile when you’re ready for connected features."
                          : "During private preview, AI tools require an approved account. You can start manual tracking now."}
                      </Text>
                      {nutrition && <View style={s.hero}><Text style={s.h3}>{nutrition.targets ? 'Your daily starting targets' : 'Your details are ready'}</Text>{text(nutrition.targets ? `${nutrition.targets.calories} calories · ${nutrition.targets.protein}g protein · ${nutrition.targets.carbs}g carbs · ${nutrition.targets.fat}g fat. Change them anytime in your profile.` : 'Your age, height and usual activity will be saved. Your daily targets stay as they are.')}</View>}
                      <Button
                        label={flow.busy ? "Getting ready…" : "Let’s do this"}
                        disabled={flow.busy}
                        onPress={() =>
                          void flow.finish(focus, name, async (normalizedName) => {
                            await h.saveOnboardingProfile(normalizedName, fitness, flow.draft.weightEntry, nutrition);
                            h.setTab("Chat");
                          })
                        }
                      />
                      {link("Back", () => flow.setStep('nutrition'))}
                    </>
                  )}
                </>
              )}
              {!!flow.error && (
                <Text
                  accessibilityRole="alert"
                  style={[
                    s.text,
                    {
                      color: "#8a3e24",
                      padding: 14,
                      backgroundColor: "#f7e6d9",
                      borderRadius: 12,
                    },
                  ]}
                >
                  {flow.error}
                </Text>
              )}
              {!!flow.notice && (
                <Text
                  accessibilityLiveRegion="polite"
                  style={[
                    s.text,
                    {
                      padding: 14,
                      backgroundColor: colors.mint,
                      borderRadius: 12,
                    },
                  ]}
                >
                  {flow.notice}
                </Text>
              )}
              <Text style={[s.eyebrow, { textAlign: "center", fontSize: 9 }]}>
                GOOD FOOD. SOLID WORK. BRIGHTER DAYS.
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}
    </WelcomeContext.Provider>
  );
}
