import { useEffect, useRef, useState, type FormEvent } from "react";
import ChatLayer from "./ChatLayer";
import NutritionPage from "./NutritionPage";
import WorkoutPage from "./WorkoutPage";
import YouPage from "./YouPage";
import { GroceriesDialog } from "./AICards";
import {
  buildAIRequest,
  requestAI,
  applyAIResult,
  addProposedMeal,
} from "./ai-client";
import { type AIStatus } from "./ai-contract";
import { startPlan } from "./workouts";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Coffee,
  Dumbbell,
  Flame,
  Footprints,
  ImagePlus,
  Inbox,
  Info,
  Leaf,
  MessageCircle,
  Mic,
  Moon,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  Utensils,
  UserRound,
  X,
} from "lucide-react";
import {
  Brand,
  IconTile,
  MealRow,
  Modal,
  NutritionSummary,
  SectionHeading,
} from "./components";
import {
  APP_NAME,
  STORAGE_KEY,
  clockTime,
  id,
  initialState,
  interpretText,
  makeMeal,
  mealSchema,
  readState,
  resolveReview,
  sumNutrition,
  today,
  upgradeChat,
  type AppState,
  type Meal,
  type Page,
} from "./domain";

const navigation = [
  { name: "Today" as const, icon: Sun },
  { name: "Chat" as const, icon: MessageCircle },
  { name: "Nutrition" as const, icon: BarChart3 },
  { name: "Workouts" as const, icon: Dumbbell },
  { name: "Review" as const, icon: Inbox },
  { name: "You" as const, icon: UserRound },
];
const insights = [
  {
    icon: Sprout,
    tone: "green",
    title: "A good day starts at breakfast.",
    description:
      "Your higher-protein days tend to start with a proper breakfast.",
    detail:
      "In the sample history, days with at least 30g of protein at breakfast averaged 38g more protein overall. This is an example of how Fuel could explain a pattern — it is not a conclusion about your actual health data.",
    evidence: "Sample history · 14 days · 6 higher-protein breakfasts",
  },
  {
    icon: Coffee,
    tone: "sand",
    title: "The little things add up.",
    description:
      "Drinks made up most of the extra calories in your sample week.",
    detail:
      "The sample week includes 420 calories from sweetened drinks above the planned meals. A smaller size or less syrup could be an easy experiment if that fits your preferences.",
    evidence: "Sample history · 7 days · 5 drink captures",
  },
  {
    icon: Flame,
    tone: "blue",
    title: "A splash is hard to estimate.",
    description: "Cooking oil is the biggest uncertainty in two of your meals.",
    detail:
      "Oil and sauce can be hard to see in a photo. Fuel should show that uncertainty and let you correct it without requiring a full meal re-entry. This prototype uses sample estimates, not image recognition.",
    evidence: "Sample history · 2 home-cooked meals",
  },
];

export default function App() {
  const [state, setState] = useState<AppState>(readState);
  const [page, setPage] = useState<Page>(
    () =>
      navigation.find((n) => n.name.toLowerCase() === location.hash.slice(1))
        ?.name ?? "Chat",
  );
  const [toast, setToast] = useState("");
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [info, setInfo] = useState<{
    title: string;
    text: string;
    evidence?: string;
  } | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [upload, setUpload] = useState<{ name: string; image: string } | null>(
    null,
  );
  const [composer, setComposer] = useState("");
  const [processing, setProcessing] = useState(false);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const [aiStage, setAIStage] = useState("");
  const [captureContext, setCaptureContext] = useState("");
  const [groceriesOpen, setGroceriesOpen] = useState<string | null>(null);
  const aiBusy = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = state.reviews.filter((r) => !r.resolved);
  const totals = sumNutrition(state.meals);
  const todayMeals = state.meals.filter((m) => m.day === today());
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    setState(upgradeChat);
  }, []);
  useEffect(() => {
    let live = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((value) => {
        if (live)
          setAIStatus({
            available: value.available === true,
            jev: value.jev === true,
            model: value.model,
          });
      })
      .catch(() => {
        if (live) setAIStatus({ available: false, jev: false });
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setToast(
        "Your browser storage is full. Recent changes may not survive a refresh.",
      );
    }
  }, [state]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const onHash = () =>
      setPage(
        navigation.find((n) => n.name.toLowerCase() === location.hash.slice(1))
          ?.name ?? "Chat",
      );
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function navigate(next: Page) {
    setPage(next);
    location.hash = next.toLowerCase();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function notify(message: string) {
    setToast(message);
  }
  function startChat() {
    navigate("Chat");
  }
  function addDemoMeal(key: "dinner" | "takeout", image?: string) {
    const photo =
      image ??
      (key === "dinner" ? "/images/chicken-dinner.png" : "/images/bowl.jpg");
    setState((s) => {
      const user = {
        id: id(),
        role: "user" as const,
        text:
          key === "dinner"
            ? "Made this for dinner"
            : "Just got this for lunch!",
        image: photo,
        time: clockTime(),
      };
      if (key === "dinner")
        return {
          ...s,
          pendingMeal: { key: "dinner" as const, image: photo },
          messages: [
            ...s.messages,
            user,
            {
              id: id(),
              role: "assistant" as const,
              text: "Looks like grilled chicken breast, rice, broccoli, and a light sauce.",
              time: clockTime(),
            },
            {
              id: id(),
              role: "assistant" as const,
              text: "Was that about 1 cup of rice?",
              time: clockTime(),
            },
          ],
        };
      const meal = makeMeal(
        key,
        "Sample takeout capture · preset estimate",
        photo,
      );
      return {
        ...s,
        meals: [...s.meals, meal],
        messages: [
          ...s.messages,
          user,
          {
            id: id(),
            role: "assistant" as const,
            text: "Got it. Chicken shawarma bowl, hummus, pita, and Diet Coke.",
            time: clockTime(),
          },
          {
            id: id(),
            role: "assistant" as const,
            text: "Added to lunch with an estimated portion.",
            time: clockTime(),
          },
          {
            id: id(),
            role: "assistant" as const,
            text: "",
            mealId: meal.id,
            time: clockTime(),
          },
        ],
      };
    });
    setCaptureOpen(false);
    setUpload(null);
    navigate("Chat");
  }
  async function sendAI(text: string, image?: string, retryId?: string) {
    if (aiBusy.current) return;
    if (!aiStatus?.available) {
      notify(
        "The AI connection isn’t available. Please check the server and refresh.",
      );
      return;
    }
    const message = retryId
      ? state.messages.find((m) => m.id === retryId)
      : {
          id: id(),
          role: "user" as const,
          text,
          time: clockTime(),
          image,
          ai: true,
          aiStatus: "pending" as const,
        };
    if (!message) return;
    aiBusy.current = true;
    setProcessing(true);
    setAIStage("Connecting to Fuel…");
    setState((s) => ({
      ...s,
      messages: retryId
        ? s.messages.map((m) =>
            m.id === retryId
              ? { ...m, aiStatus: "pending", aiError: undefined }
              : m,
          )
        : [...s.messages, message],
    }));
    try {
      const result = await requestAI(
        buildAIRequest(state, message),
        setAIStage,
      );
      setState((s) => applyAIResult(s, result));
    } catch (error) {
      const messageText =
        error instanceof Error && error.name === "TimeoutError"
          ? "That took longer than expected. Your capture is still here; please retry."
          : error instanceof Error
            ? error.message
            : "Something interrupted that response. Please retry.";
      setState((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === message.id
            ? { ...m, aiStatus: "error", aiError: messageText }
            : m,
        ),
      }));
    } finally {
      aiBusy.current = false;
      setProcessing(false);
      setAIStage("");
    }
  }
  function submitText(e?: FormEvent, preset?: string) {
    e?.preventDefault();
    const text = (preset ?? composer).trim();
    if (!text || processing) return;
    if (aiStatus === null) {
      notify("Connecting to Fuel. Please try again in a moment.");
      return;
    }
    const localCommand =
      /^(how am i doing(?: today)?|today'?s nutrition|nutrition|daily summary|start (?:my |a )?workout|track (?:my |a )?workout|workout|what needs review|review(?: captures)?|what needs my attention)[?!.]*$/i.test(
        text,
      );
    if (
      aiStatus.available &&
      !state.pendingMeal &&
      !localCommand &&
      interpretText(text).kind !== "workout"
    ) {
      setComposer("");
      void sendAI(text);
      return;
    }
    setComposer("");
    // Persist interpretation and source atomically; the brief delay is only presentation.
    setState((s) => {
      const result = interpretText(text);
      let next = {
        ...s,
        messages: [
          ...s.messages,
          { id: id(), role: "user" as const, text, time: clockTime() },
        ],
      };
      let response = "";
      let mealId: string | undefined;
      const phrase = text
        .trim()
        .toLowerCase()
        .replace(/[?!.,]+$/, "");
      if (
        /^(how am i doing(?: today)?|today'?s nutrition|nutrition|daily summary)$/.test(
          phrase,
        )
      ) {
        const current = sumNutrition(s.meals);
        const caloriesLeft = Math.max(0, s.profile.calories - current.calories);
        const proteinLeft = Math.max(0, s.profile.protein - current.protein);
        const summary =
          current.calories > s.profile.calories
            ? `You’re at ${current.calories.toLocaleString()} calories and ${current.protein}g protein today. Everything you’ve shared is included below.`
            : `You have ${caloriesLeft} calories and ${proteinLeft}g protein left today.`;
        return {
          ...next,
          messages: [
            ...next.messages,
            {
              id: id(),
              role: "assistant" as const,
              kind: "summary" as const,
              text: summary,
              time: clockTime(),
            },
          ],
        };
      }
      if (
        /^(start (?:my |a )?workout|track (?:my |a )?workout|workout)$/.test(
          phrase,
        )
      ) {
        return {
          ...next,
          workout: startPlan(s.workout, s.workout.planId ?? "upper"),
          messages: [
            ...next.messages,
            {
              id: id(),
              role: "assistant" as const,
              kind: "workout" as const,
              text: "Your workout is ready. Tap your reps below, or open Workouts for the full conversation.",
              time: clockTime(),
            },
          ],
        };
      }
      if (
        /^(what needs review|review(?: captures)?|what needs my attention)$/.test(
          phrase,
        )
      ) {
        const count = s.reviews.filter((item) => !item.resolved).length;
        return {
          ...next,
          messages: [
            ...next.messages,
            {
              id: id(),
              role: "assistant" as const,
              kind: "review" as const,
              text: count
                ? `${count} quick ${count === 1 ? "thing needs" : "things need"} your attention. Everything else has already been tracked for you.`
                : "You’re all caught up. Nothing needs your attention.",
              time: clockTime(),
            },
          ],
        };
      }
      if (s.pendingMeal) {
        const cups = /^(yep|yes|yeah|one|1|1 cup|one cup|about 1 cup)$/.test(
          phrase,
        )
          ? 1
          : /^(half|half a cup|0.5|0.5 cup)$/.test(phrase)
            ? 0.5
            : /^(two|2|2 cups|two cups|about 2 cups)$/.test(phrase)
              ? 2
              : undefined;
        if (cups !== undefined) {
          const meal = makeMeal(
            "dinner",
            "Demo photo capture · portion confirmed by you",
            s.pendingMeal.image,
          );
          meal.calories += Math.round((cups - 1) * 205);
          meal.carbs += Math.round((cups - 1) * 45);
          meal.protein += Math.round((cups - 1) * 4);
          meal.note += ` Rice portion confirmed: ${cups} cup${cups === 1 ? "" : "s"}.`;
          return {
            ...next,
            pendingMeal: undefined,
            meals: [...s.meals, meal],
            messages: [
              ...next.messages,
              {
                id: id(),
                role: "assistant" as const,
                text: "",
                mealId: meal.id,
                time: clockTime(),
              },
              {
                id: id(),
                role: "assistant" as const,
                kind: "insight" as const,
                text: "Dinner’s in. You can tap the meal to adjust any of the details.",
                time: clockTime(),
              },
            ],
          };
        }
        return {
          ...next,
          messages: [
            ...next.messages,
            {
              id: id(),
              role: "assistant" as const,
              text: "For this sample dinner, was the rice half a cup, 1 cup, or 2 cups?",
              time: clockTime(),
            },
          ],
        };
      }
      if (result.kind === "meal") {
        const meal = makeMeal(result.key, `Text: ${text}`);
        mealId = meal.id;
        next = { ...next, meals: [...next.meals, meal] };
        response =
          "Added using a sample estimate. You can tap the meal to adjust the portions or nutrition.";
      } else if (result.kind === "repeat") {
        const previous = [...s.meals]
          .reverse()
          .find((m) => m.category === "Breakfast" && m.day < today());
        if (previous) {
          const meal = {
            ...previous,
            id: id(),
            day: today(),
            time: clockTime(),
            source: `Repeated from ${previous.day}`,
          };
          mealId = meal.id;
          next = { ...next, meals: [...next.meals, meal] };
          response = "Your last breakfast is added, with the same portions.";
        } else
          response =
            "I don’t have an earlier breakfast saved yet. Send what you had, and I’ll keep it for next time.";
      } else if (
        result.kind === "workout" &&
        !s.workout.exercises.some((ex) => ex.name === "Bench Press")
      ) {
        response =
          "Your current plan does not include Bench Press. Finish that session in Workouts, then choose Upper Body to record your bench sets.";
      } else if (result.kind === "workout") {
        const session = startPlan(s.workout, s.workout.planId ?? "upper");
        next = {
          ...next,
          workout: {
            ...session,
            status: "active",
            finishedAt: null,
            startedAt: session.startedAt,
            exercises: session.exercises.map((ex) =>
              ex.name === "Bench Press"
                ? { ...ex, weight: result.weight, sets: result.reps }
                : ex,
            ),
          },
        };
        response = `Bench saved: ${result.weight} lb × ${result.reps.join(", ")} reps. It’s in your workout.`;
      } else {
        next = {
          ...next,
          reviews: [
            ...s.reviews,
            {
              id: id(),
              title: "A capture to come back to",
              question: text,
              source: `Text · ${clockTime()}`,
              options: ["Keep as a note"],
              kind: "capture",
              resolved: false,
            },
          ],
        };
        response =
          "Saved your words for review. I can’t estimate this yet in the prototype, but your note is here whenever you need it.";
      }
      return {
        ...next,
        messages: [
          ...next.messages,
          {
            id: id(),
            role: "assistant" as const,
            text: response,
            time: clockTime(),
            mealId,
          },
        ],
      };
    });
    setProcessing(true);
    timer.current = setTimeout(() => setProcessing(false), 600);
  }
  async function onFile(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      notify("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 12000000) {
      notify("Choose an image smaller than 12 MB.");
      return;
    }
    try {
      let image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      if (file.size > 1500000) {
        const original = new Image();
        original.src = image;
        await original.decode();
        const scale = Math.min(
          1,
          2200 / Math.max(original.width, original.height),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(original.width * scale);
        canvas.height = Math.round(original.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Image unavailable");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
        image = canvas.toDataURL("image/jpeg", 0.85);
      }
      if (image.length > 4400000) {
        notify(
          "This image is still too large. Please crop the receipt or choose a smaller photo.",
        );
        return;
      }
      setCaptureContext("");
      setUpload({ name: file.name, image });
      setCaptureOpen(true);
    } catch {
      notify("That image couldn’t be opened. Please try another.");
    }
  }
  function saveUploadForReview() {
    if (!upload) return;
    setState((s) => ({
      ...s,
      reviews: [
        ...s.reviews,
        {
          id: id(),
          title: upload.name,
          question:
            "Your image is saved. Add a meal estimate or keep it as a note.",
          source: `Image · ${clockTime()}`,
          image: upload.image,
          options: ["Keep as a note"],
          kind: "capture",
          resolved: false,
        },
      ],
      messages: [
        ...s.messages,
        {
          id: id(),
          role: "user",
          text: "Saved an image for review.",
          image: upload.image,
          time: clockTime(),
        },
        {
          id: id(),
          role: "assistant",
          text: "Your image is saved for review without guessing nutrition. Ask “What needs review?” to see it here.",
          time: clockTime(),
        },
      ],
    }));
    setCaptureOpen(false);
    setUpload(null);
    navigate("Chat");
    notify("Image saved. You can review it here in chat.");
  }
  function startWorkout() {
    setState((s) => ({
      ...s,
      workout: startPlan(s.workout, s.workout.planId ?? "upper"),
    }));
    navigate("Workouts");
  }
  function setReps(exIndex: number, setIndex: number, reps: number | null) {
    setState((s) =>
      s.workout.status !== "active"
        ? s
        : {
            ...s,
            workout: {
              ...s.workout,
              exercises: s.workout.exercises.map((ex, i) =>
                i === exIndex
                  ? {
                      ...ex,
                      sets: ex.sets.map((v, n) => (n === setIndex ? reps : v)),
                    }
                  : ex,
              ),
            },
          },
    );
  }
  function showInsight(index: number) {
    const insight = insights[index];
    setInfo({
      title: insight.title,
      text: insight.detail,
      evidence: insight.evidence,
    });
  }
  function voice() {
    setInfo({
      title: "A few words are all it takes.",
      text: "Voice capture is planned for the native app. In this browser prototype, use the microphone on your phone’s keyboard to dictate into Chat, or try “Bench was 185 for 8, 8, 7.”",
    });
  }

  return (
    <div
      className={`app-shell ${page === "Chat" || page === "Nutrition" || page === "Workouts" || page === "You" || page === "Review" ? "chat-home" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <button
          className="brand-button"
          aria-label={`${APP_NAME} home`}
          onClick={() => navigate("Chat")}
        >
          <Brand />
        </button>
        <div className="sidebar-label">YOUR EVERYDAY, SIMPLIFIED</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              onClick={() => navigate(name)}
              aria-label={
                name === "Review" && pending.length
                  ? `Review ${pending.length}`
                  : name
              }
              aria-current={page === name ? "page" : undefined}
            >
              <Icon size={21} strokeWidth={1.7} />
              <span>{name}</span>
              {name === "Review" && pending.length > 0 && (
                <span className="nav-badge">{pending.length}</span>
              )}
              {page === name && name !== "Review" && (
                <span className="active-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sprout size={28} strokeWidth={1.4} />
            <p>
              You live your life.
              <br />
              <strong>We’ll keep the details.</strong>
            </p>
            <span>A little less to think about.</span>
          </div>
          <button className="profile-button" onClick={() => navigate("You")}>
            <span className="avatar">
              {state.profile.name.charAt(0).toUpperCase()}
            </span>
            <span>
              <strong>{state.profile.name}</strong>
              <small>Your space, your pace</small>
            </span>
            <Settings2 size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="desktop-crumb">
            <span>Your space</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <button
            className="mobile-brand brand-button"
            onClick={() => navigate("Chat")}
            aria-label="Fuel home"
          >
            <Brand small />
          </button>
          <div className="topbar-right">
            <span className="demo-label">
              <span /> LOCAL DEMO
            </span>
            <span className="topbar-divider" />
            <button
              className="icon-button review-top"
              aria-label={`Review, ${pending.length} pending`}
              onClick={() => navigate("Review")}
            >
              <Inbox size={20} />
              {pending.length > 0 && <i />}
            </button>
            <button
              className="avatar small"
              onClick={() => navigate("You")}
              aria-label="Your profile"
            >
              {state.profile.name.charAt(0).toUpperCase()}
            </button>
          </div>
        </header>
        <main
          id="main"
          className={`main-content ${page === "Chat" || page === "Nutrition" || page === "Workouts" || page === "You" || page === "Review" ? "chat-main" : ""}`}
        >
          {page === "Today" && (
            <div className="page-enter">
              <div className="page-heading">
                <div>
                  <div className="eyebrow date-label">
                    <Sun size={15} />
                    {dateLabel}
                  </div>
                  <h1>
                    Your day, <em>taken care of.</em>
                  </h1>
                  <p>
                    Hey {state.profile.name}. Here’s what matters. We’ve handled
                    the rest.
                  </p>
                </div>
                <button
                  className="button secondary heading-capture"
                  onClick={startChat}
                >
                  <Plus size={18} /> Add a moment
                </button>
              </div>
              <div className="today-top-grid">
                <section className="card nutrition-card">
                  <div className="card-heading">
                    <span className="card-label">
                      <Utensils size={17} /> Today’s nutrition
                    </span>
                    <button
                      className="icon-button"
                      aria-label="View nutrition"
                      onClick={() => navigate("Nutrition")}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  </div>
                  <NutritionSummary totals={totals} goals={state.profile} />
                  <div className="card-footnote">
                    <span className="tiny-leaf">
                      <Leaf size={15} />
                    </span>
                    {totals.protein < state.profile.protein
                      ? "A little more protein will round out your day."
                      : "You’ve reached your protein goal for today."}
                    <span className="muted-dot">•</span>
                    <span>Looking good</span>
                  </div>
                </section>
                <section className="workout-hero">
                  <img
                    src="/images/gym.jpg"
                    alt="A quiet gym with weights and training equipment"
                  />
                  <div className="workout-overlay" />
                  <div className="workout-hero-content">
                    <div className="workout-topline">
                      <span>
                        <Dumbbell size={17} /> MADE FOR TODAY
                      </span>
                      <span className="pill">
                        {state.workout.status === "finished"
                          ? "Complete"
                          : "Strength"}
                      </span>
                    </div>
                    <div>
                      <span className="workout-kicker">
                        A little stronger, every time.
                      </span>
                      <h2>Upper body</h2>
                      <p>
                        <Clock3 size={15} /> ~42 min <span>·</span> 5 exercises
                      </p>
                    </div>
                    <button
                      className="button light"
                      onClick={() =>
                        state.workout.status === "finished"
                          ? navigate("Workouts")
                          : startWorkout()
                      }
                    >
                      {state.workout.status === "ready"
                        ? "Let’s get moving"
                        : state.workout.status === "active"
                          ? "Continue workout"
                          : "See your session"}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </section>
              </div>
              <div className="wellbeing-grid">
                <button
                  className="card metric-card"
                  onClick={() =>
                    setInfo({
                      title: "A little movement goes a long way.",
                      text: "6,842 steps is sample data. Your usual Thursday in this demo is around 8,800 steps. Device connections will eventually bring this in automatically; no device is currently connected.",
                      evidence: "Sample movement · not synced to a device",
                    })
                  }
                >
                  <IconTile icon={Footprints} tone="sand" />
                  <div>
                    <span className="metric-label">A LITTLE MOVEMENT</span>
                    <div className="metric-number">
                      6,842 <span>steps</span>
                    </div>
                    <p>A short walk would feel good.</p>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
                <button
                  className="card metric-card"
                  onClick={() =>
                    setInfo({
                      title: "Room to rest and recover.",
                      text: "7 hours and 12 minutes of sleep is a sample recovery record, close to the demo’s 7-hour average. Fuel is not currently connected to a wearable.",
                      evidence: "Sample recovery · not synced to a device",
                    })
                  }
                >
                  <IconTile icon={Moon} tone="lavender" />
                  <div>
                    <span className="metric-label">TIME TO RECHARGE</span>
                    <div className="metric-number">
                      7<span>h</span> 12<span>m</span>
                    </div>
                    <p>Right around your usual. Nice.</p>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
                <button
                  className="card review-glance"
                  onClick={() => navigate("Review")}
                >
                  <div className="review-glance-top">
                    <span className="status-dot" />
                    {pending.length
                      ? "ALMOST ALL TAKEN CARE OF"
                      : "ALL TAKEN CARE OF"}
                    <ArrowUpRight size={17} />
                  </div>
                  <strong>
                    {pending.length
                      ? `${pending.length} little things to check.`
                      : "You’re all caught up."}
                  </strong>
                  <p>
                    {pending.length
                      ? "A quick answer, and you’re on your way."
                      : "Go enjoy the rest of your day."}
                  </p>
                </button>
              </div>
              <div className="today-bottom-grid">
                <section>
                  <SectionHeading
                    title="Your day, in little moments"
                    action="See nutrition"
                    onClick={() => navigate("Nutrition")}
                  />
                  <div className="card meal-list">
                    {todayMeals.length ? (
                      todayMeals.map((meal) => (
                        <MealRow
                          key={meal.id}
                          meal={meal}
                          onEdit={setEditMeal}
                        />
                      ))
                    ) : (
                      <div className="empty-inline">
                        A fresh day. Capture your first meal whenever you’re
                        ready.
                      </div>
                    )}
                    <div className="list-foot">
                      <ShieldCheck size={14} /> Estimates you can always adjust.
                    </div>
                  </div>
                </section>
                <section>
                  <SectionHeading title="One thing worth knowing" />
                  <button
                    className="daily-insight"
                    onClick={() => showInsight(0)}
                  >
                    <div className="insight-tag">
                      <Sparkles size={15} /> CONNECTING THE DOTS
                    </div>
                    <div className="insight-illustration" aria-hidden="true">
                      <div className="sun-disc" />
                      <Sprout size={73} strokeWidth={1.1} />
                      <span className="illus-dot one" />
                      <span className="illus-dot two" />
                    </div>
                    <h3>
                      A good day starts
                      <br />
                      at breakfast.
                    </h3>
                    <p>
                      In your sample history, a protein-rich breakfast goes with{" "}
                      <strong>38g more protein</strong> by the end of the day.
                    </p>
                    <span className="insight-link">
                      The little things that help
                      <ArrowUpRight size={17} />
                    </span>
                  </button>
                </section>
              </div>
              <section className="capture-strip">
                <IconTile icon={Leaf} />
                <div>
                  <h3>Anything else happen today?</h3>
                  <p>A photo, a quick message. Leave the rest to us.</p>
                </div>
                <div className="capture-actions">
                  <button
                    className="button secondary"
                    onClick={() => cameraRef.current?.click()}
                  >
                    <Camera size={17} />
                    Photo
                  </button>
                  <button className="button secondary" onClick={startChat}>
                    <MessageCircle size={17} />
                    Message
                  </button>
                  <button
                    className="icon-button voice-button"
                    aria-label="Voice capture"
                    onClick={voice}
                  >
                    <Mic size={19} />
                  </button>
                </div>
              </section>
              <p className="page-note">
                <Leaf size={13} /> Less bookkeeping. More living.{" "}
                <span>Sample data · saved on this device</span>
              </p>
            </div>
          )}

          {page === "Nutrition" && (
            <NutritionPage
              state={state}
              onNavigate={navigate}
              onProfile={() => navigate("You")}
              onEditMeal={setEditMeal}
              onChatSummary={() => {
                navigate("Chat");
                submitText(undefined, "How am I doing today?");
              }}
            />
          )}

          {page === "Chat" && (
            <ChatLayer
              state={state}
              composer={composer}
              processing={processing}
              aiAvailable={aiStatus?.available ?? false}
              aiStage={aiStage}
              onRetry={(messageId) => {
                void sendAI("", undefined, messageId);
              }}
              onGroceries={setGroceriesOpen}
              onAddMeal={(messageId) =>
                setState((s) => addProposedMeal(s, messageId))
              }
              onComposerChange={setComposer}
              onSend={submitText}
              onCamera={() => cameraRef.current?.click()}
              onAttach={() => fileRef.current?.click()}
              onVoice={voice}
              onProfile={() => navigate("You")}
              onNavigate={navigate}
              onEditMeal={setEditMeal}
              onSample={() => {
                setUpload(null);
                setCaptureOpen(true);
              }}
              onSetReps={(exercise, set, reps) => {
                setReps(exercise, set, reps);
              }}
              onResolve={(reviewId, answer) => {
                setState((s) => resolveReview(s, reviewId, answer));
                notify("Updated. One less thing to think about.");
              }}
            />
          )}

          {page === "Workouts" && (
            <WorkoutPage
              state={state}
              setState={setState}
              onNavigate={navigate}
              onProfile={() => navigate("You")}
              onVoice={voice}
            />
          )}

          {(page === "You" || page === "Review") && (
            <YouPage
              state={state}
              aiAvailable={aiStatus?.available ?? false}
              onGroceries={() => setGroceriesOpen("*")}
              onNavigate={navigate}
              onEditProfile={() => setProfileOpen(true)}
              onEditMeal={setEditMeal}
              onResolve={(reviewId, answer) => {
                setState((s) => resolveReview(s, reviewId, answer));
                notify("Updated. One less thing to think about.");
              }}
              onAddMeal={(item) =>
                setEditMeal({
                  id: `review-meal-${item.id}`,
                  title: "",
                  category: "Lunch",
                  time: clockTime(),
                  day: today(),
                  calories: 0,
                  protein: 0,
                  carbs: 0,
                  fat: 0,
                  source: item.source + ": " + item.question,
                  image: item.image,
                  confidence: "confirmed",
                  note: "Added by you from a captured moment.",
                })
              }
            />
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={page === name ? "active" : ""}
            onClick={() => navigate(name)}
            aria-label={
              name === "Review" && pending.length
                ? `Review ${pending.length}`
                : name
            }
            aria-current={page === name ? "page" : undefined}
          >
            <span>
              <Icon size={22} strokeWidth={page === name ? 2.2 : 1.7} />
              {name === "Review" && pending.length > 0 && (
                <i>{pending.length}</i>
              )}
            </span>
            {name}
          </button>
        ))}
      </nav>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {info && (
        <Modal title={info.title} onClose={() => setInfo(null)}>
          <div className="info-content">
            <IconTile icon={Leaf} />
            <p>{info.text}</p>
            {info.evidence && (
              <div className="evidence">
                <Info size={16} />
                {info.evidence}
              </div>
            )}
            <button
              className="button primary full-width"
              onClick={() => setInfo(null)}
            >
              Got it
              <Check size={17} />
            </button>
          </div>
        </Modal>
      )}
      {captureOpen && (
        <Modal
          title={upload ? "A moment, captured." : "Show me what happened."}
          onClose={() => {
            setCaptureOpen(false);
            setUpload(null);
          }}
        >
          <div className="capture-modal">
            {upload ? (
              <>
                <img
                  className="upload-preview"
                  src={upload.image}
                  alt="Your uploaded capture"
                />
                <p>
                  {aiStatus?.available
                    ? "Send a meal photo, grocery receipt, or order screenshot. Fuel will read it and look for useful nutrition sources."
                    : "AI is unavailable. You can still save this image for review."}
                </p>
                {aiStatus?.available && (
                  <>
                    <label className="fuel-capture-context">
                      Anything to add? (optional)
                      <textarea
                        maxLength={2000}
                        value={captureContext}
                        onChange={(e) => setCaptureContext(e.target.value)}
                        placeholder="e.g. My grocery receipt, or what I had for lunch"
                      />
                    </label>
                    <button
                      className="button primary full-width"
                      disabled={processing}
                      onClick={() => {
                        const image = upload.image;
                        const text =
                          captureContext.trim() ||
                          "Please help me understand this photo or receipt. If these are groceries I purchased, research their nutrition and save the grocery list separately from meals I ate.";
                        setCaptureOpen(false);
                        setUpload(null);
                        navigate("Chat");
                        void sendAI(text, image);
                      }}
                    >
                      Send to Fuel <ArrowRight size={17} />
                    </button>
                    <p className="section-note">
                      Sent to OpenAI for image reading and web research;
                      extracted details may be checked by TypeSafe. Your saved
                      records stay in this browser.
                    </p>
                  </>
                )}
                <button
                  className="button primary full-width"
                  onClick={saveUploadForReview}
                >
                  Save my image for review
                  <Inbox size={17} />
                </button>
              </>
            ) : (
              <>
                <p>
                  A photo, an order screenshot, or a few words. Start wherever
                  is easiest.
                </p>
                <button
                  className="upload-zone"
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus size={31} />
                  <strong>Choose a photo or screenshot</strong>
                  <span>JPG, PNG, WebP · up to 12 MB</span>
                </button>
              </>
            )}
            <div className="modal-divider">
              <span>OR EXPLORE A DEMO</span>
            </div>
            <button
              className="demo-capture"
              onClick={() => addDemoMeal("dinner", upload?.image)}
            >
              <IconTile icon={Utensils} />
              <span>
                <strong>A home-cooked dinner</strong>
                <small>Chicken, rice & broccoli · sample estimate</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <button
              className="demo-capture"
              onClick={() => addDemoMeal("takeout", upload?.image)}
            >
              <IconTile icon={ImagePlus} tone="sand" />
              <span>
                <strong>A takeout screenshot</strong>
                <small>Shawarma bowl & sides · sample estimate</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <p className="section-note">
              Demo flows use preset meals. Use “Send to Fuel” above for real
              image reading and nutrition research.
            </p>
          </div>
        </Modal>
      )}
      {groceriesOpen && (
        <GroceriesDialog
          receipts={(state.groceries ?? []).filter(
            (g) => groceriesOpen === "*" || g.id === groceriesOpen,
          )}
          onClose={() => setGroceriesOpen(null)}
          onUpdate={(receiptId, item) =>
            setState((s) => ({
              ...s,
              groceries: (s.groceries ?? []).map((g) =>
                g.id === receiptId
                  ? {
                      ...g,
                      items: g.items.map((old) =>
                        old.id === item.id ? item : old,
                      ),
                    }
                  : g,
              ),
            }))
          }
          onAsk={(text) => {
            navigate("Chat");
            void sendAI(text);
          }}
        />
      )}
      {editMeal && (
        <MealEditor
          meal={editMeal}
          onClose={() => setEditMeal(null)}
          onSave={(meal) => {
            setState((s) => ({
              ...s,
              meals: s.meals.some((m) => m.id === meal.id)
                ? s.meals.map((m) => (m.id === meal.id ? meal : m))
                : [...s.meals, meal],
              reviews: s.reviews.map((r) =>
                `review-meal-${r.id}` === meal.id
                  ? { ...r, resolved: true, answer: "Meal added by you" }
                  : r,
              ),
            }));
            setEditMeal(null);
            notify("Meal updated. Your day is up to date.");
          }}
          onDelete={
            state.meals.some((m) => m.id === editMeal.id)
              ? () => {
                  setState((s) => ({
                    ...s,
                    meals: s.meals.filter((m) => m.id !== editMeal.id),
                    messages: s.messages.map((m) =>
                      m.mealId === editMeal.id
                        ? {
                            ...m,
                            mealId: undefined,
                            text: "This meal was removed from your day.",
                          }
                        : m,
                    ),
                  }));
                  setEditMeal(null);
                  notify("Meal removed from your day.");
                }
              : undefined
          }
        />
      )}
      {profileOpen && (
        <ProfileEditor
          profile={state.profile}
          onClose={() => setProfileOpen(false)}
          onSave={(profile) => {
            setState((s) => ({ ...s, profile }));
            setProfileOpen(false);
            notify("Your preferences are saved.");
          }}
          onReset={() => {
            setState(initialState());
            setProfileOpen(false);
            navigate("Chat");
            notify("Fresh start. The sample day is restored.");
          }}
        />
      )}
    </div>
  );
}

function MealEditor({
  meal,
  onClose,
  onSave,
  onDelete,
}: {
  meal: Meal;
  onClose: () => void;
  onSave: (meal: Meal) => void;
  onDelete?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = mealSchema.safeParse({
      ...meal,
      title: String(form.get("title")).trim(),
      category: form.get("category"),
      calories: Number(form.get("calories")),
      protein: Number(form.get("protein")),
      carbs: Number(form.get("carbs")),
      fat: Number(form.get("fat")),
      note: String(form.get("note")),
      confidence: "confirmed",
    });
    if (!parsed.success || !parsed.data.title) {
      setError("Check the name and nutrition values, then try again.");
      return;
    }
    onSave(parsed.data);
  }
  return (
    <Modal
      title={
        meal.title ? "The details are yours to adjust." : "Add a meal estimate."
      }
      onClose={onClose}
    >
      <form className="edit-form" onSubmit={submit}>
        <div className="estimate-notice">
          <Info size={16} />
          <span>
            {meal.confidence === "estimated"
              ? "This is an estimate. A quick correction is always welcome."
              : "Your own values, saved exactly as entered."}
          </span>
        </div>
        <label>
          Meal name
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={meal.title}
            placeholder="What did you have?"
          />
        </label>
        <label>
          Meal
          <select name="category" defaultValue={meal.category}>
            {["Breakfast", "Lunch", "Dinner", "Snack"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
            <label key={key}>
              {key === "calories"
                ? "Calories"
                : `${key.charAt(0).toUpperCase() + key.slice(1)} (g)`}
              <input
                name={key}
                type="number"
                required
                min="0"
                max="20000"
                step="1"
                defaultValue={meal[key]}
              />
            </label>
          ))}
        </div>
        <label>
          Notes
          <textarea
            name="note"
            maxLength={1500}
            defaultValue={meal.note}
            rows={3}
          />
        </label>
        <div className="source-note">
          <ShieldCheck size={13} />
          <span>Source: {meal.source}</span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full-width" type="submit">
          Save changes
          <Check size={18} />
        </button>
        {onDelete && (
          <div className="delete-area">
            {deleting ? (
              <>
                <span>Remove this meal from your totals?</span>
                <button
                  className="text-button"
                  type="button"
                  onClick={onDelete}
                >
                  Yes, remove
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setDeleting(false)}
                >
                  Keep it
                </button>
              </>
            ) : (
              <button
                className="text-button"
                type="button"
                onClick={() => setDeleting(true)}
              >
                Remove this meal
              </button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
function ProfileEditor({
  profile,
  onClose,
  onSave,
  onReset,
}: {
  profile: AppState["profile"];
  onClose: () => void;
  onSave: (profile: AppState["profile"]) => void;
  onReset: () => void;
}) {
  const [resetting, setResetting] = useState(false);
  return (
    <Modal title="Your space, your pace." onClose={onClose}>
      <form
        className="edit-form"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const name = String(data.get("name")).trim();
          if (!name) return;
          onSave({
            name,
            calories: Number(data.get("calories")),
            protein: Number(data.get("protein")),
            carbs: Number(data.get("carbs")),
            fat: Number(data.get("fat")),
          });
        }}
      >
        <p className="modal-intro">
          A few preferences to make this feel like you. The starting targets are
          sample values, not personalized advice.
        </p>
        <label>
          Your first name
          <input
            name="name"
            required
            maxLength={40}
            defaultValue={profile.name}
          />
        </label>
        <div className="form-grid">
          {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
            <label key={key}>
              Daily {key}
              {key === "calories" ? "" : " (g)"}
              <input
                name={key}
                required
                type="number"
                min="1"
                max={key === "calories" ? 10000 : key === "carbs" ? 2000 : 1000}
                step="1"
                defaultValue={profile[key]}
              />
            </label>
          ))}
        </div>
        <button className="button primary full-width" type="submit">
          Save preferences
          <Check size={17} />
        </button>
        <div className="privacy-note">
          <ShieldCheck size={19} />
          <div>
            <strong>Just on this device.</strong>
            <p>
              No account or cloud sync. This demo saves your changes in your
              browser.
            </p>
          </div>
        </div>
        <div className="delete-area">
          {resetting ? (
            <>
              <span>This clears your edits and captures.</span>
              <button className="text-button" type="button" onClick={onReset}>
                Reset demo
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => setResetting(false)}
              >
                Keep my changes
              </button>
            </>
          ) : (
            <button
              type="button"
              className="text-button"
              onClick={() => setResetting(true)}
            >
              Start over with sample data
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
