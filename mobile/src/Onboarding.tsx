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

const adapter: OnboardingAdapter = {
  read: () => AsyncStorage.getItem(ONBOARDING_KEY),
  write: (value) => AsyncStorage.setItem(ONBOARDING_KEY, value),
  owner: deviceOwnership.get,
  client: cloudClient,
  verifyOwner: requireDeviceOwner,
};
const WelcomeContext = createContext({ replay: () => {} });
export const useWelcome = () => useContext(WelcomeContext);
export function NativeOnboarding({ children }: { children: ReactNode }) {
  const h = useHealth(),
    flow = useOnboarding(adapter);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [focus, setFocus] = useState(focusChoices[2]);
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
    <WelcomeContext.Provider value={{ replay: flow.replay }}>
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
              <SpotScene
                scene={
                  flow.step === "intro"
                    ? intro.scene
                    : flow.step === "ready"
                      ? "shaker-ritual"
                      : flow.step === "setup"
                        ? "dinner-conspiracy"
                        : "press-conference"
                }
              />
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
                      {title("Good food. Real life. A very invested plate.")}
                      {text(
                        "Meet Spot. Your food and workout buddy with helpful ideas, questionable levels of enthusiasm, and absolutely no chill about your small wins.",
                      )}
                      <Button label="Meet Spot" onPress={flow.startTour} />
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
                        A little introduction. A little setup. A lot of
                        personality.
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
                          flow.slide < introduction.length - 1
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
                          This device has records linked to an account. Sign in
                          with that account to continue.
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
                        label="Your name (optional)"
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
                          accessibilityLabel="These device records are mine"
                          onPress={() => flow.setConfirmed(!flow.confirmed)}
                          style={[
                            s.row,
                            { alignItems: "flex-start", paddingVertical: 12 },
                          ]}
                        >
                          <Text style={s.h3}>{flow.confirmed ? "☑" : "☐"}</Text>
                          <Text style={[s.muted, { flex: 1 }]}>
                            These device records are mine. Link them to{" "}
                            {flow.user?.email || "my account"}.
                          </Text>
                        </Pressable>
                      )}
                      <Text style={s.tiny}>
                        Your existing records stay here. Cloud uploads and
                        restores are always your choice.
                      </Text>
                      <Button
                        label={
                          flow.busy ? "One moment…" : "That’s me. Let’s go."
                        }
                        disabled={
                          flow.busy || (!flow.localMode && !flow.confirmed)
                        }
                        onPress={() => void flow.prepare()}
                      />
                      {link("Back to account", () => flow.account("signin"))}
                    </>
                  )}
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
                          focus === focusChoices[0]
                            ? "Start with one meal. A few words are enough."
                            : focus === focusChoices[1]
                              ? "Start with a walk or a workout. It doesn’t have to be epic."
                              : "Start with one meal or one bit of movement. Small is a perfectly good start.",
                        )}
                      </View>
                      <Text style={s.tiny}>
                        {flow.localMode
                          ? "You’re starting with manual tracking on this device. Create an account from your profile when you’re ready for connected features."
                          : "During private preview, AI tools require an approved account. You can start manual tracking now."}
                      </Text>
                      <Button
                        label={flow.busy ? "Getting ready…" : "Let’s do this"}
                        disabled={flow.busy}
                        onPress={() =>
                          void flow.finish(focus, async () => {
                            await h.saveOnboardingProfile(name);
                            h.setTab("Chat");
                          })
                        }
                      />
                      {link("Back", () => flow.setStep("setup"))}
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
