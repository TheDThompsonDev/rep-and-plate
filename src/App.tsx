import Onboarding from "./features/onboarding/Onboarding";
import { persistBrowserRecords } from "./platform/browser-records";
import { useBrowserRecords } from "./platform/useBrowserRecords";
import { saveBodyWeight } from "./features/progress/body-weight";
import { sumProposalComponents } from "./features/meals/proposals";
import { resolveActivityProposal } from "./activities";
import type { RecipeDraft } from "./features/recipes/RecipeDialog";
import { SpotVisuals } from "./features/spot/Spot";
import { resolveWorkoutCapture } from "./features/spot/model";
import { apiFetch } from "./api-fetch";
import { resolveAgentMeal } from "./features/connections/context";
import { cloudEpoch, onAccountChange } from "./features/cloud/sync-control";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
const PantryLinkReview = lazy(
  () => import("./features/pantry/PantryLinkReview"),
);
const RecipeDialog = lazy(() => import("./features/recipes/RecipeDialog"));
const ProductScanner = lazy(() => import("./features/scanner/ProductScanner"));
const LabelCapture = lazy(() => import("./features/labels/LabelCapture"));
const PantryDialog = lazy(() =>
  import("./features/pantry/PantryDialog").then((module) => ({
    default: module.PantryDialog,
  })),
);
const PreferencesDialog = lazy(
  () => import("./features/preferences/PreferencesDialog"),
);
const MealPlanner = lazy(() => import("./features/planning/MealPlanner"));
const AccountSync = lazy(() => import("./features/cloud/AccountSync"));
const WorkoutBuilder = lazy(
  () => import("./features/workout-planning/WorkoutBuilder"),
);
const CloudAccount = lazy(() => import("./features/cloud/CloudAccount"));
const ConnectionsHub = lazy(
  () => import("./features/connections/ConnectionsHub"),
);
const VoiceCapture = lazy(() =>
  import("./features/voice/VoiceCapture").then((module) => ({
    default: module.VoiceCapture,
  })),
);
import { defaultPreferences } from "./features/preferences/contracts";
import { mealPlanSchema } from "./features/planning/contracts";
import {
  getPantryLots,
  detachMealFromPantry,
  deleteMealWithPantry,
  mealFromPantry,
} from "./features/pantry/ledger";
import { mealPortionSelections } from "./features/planning/meal-plans";
import { resolveRecipePortionProposal } from "./features/recipes/proposals";
import { productSchema, type FoodProduct } from "./features/products/contracts";
import {
  captureProduct,
  savePrivateProduct,
} from "./features/products/actions";
import ChatLayer from "./ChatLayer";
import NutritionPage from "./NutritionPage";
import WorkoutPage from "./WorkoutPage";
import YouPage from "./YouPage";
import KitchenPage from "./KitchenPage";
const ShoppingDialog = lazy(() => import("./features/shopping/ShoppingDialog"));
import {
  buildAIRequest,
  requestAI,
  applyAIResult,
  addProposedMeal,
  resolvePreferenceProposal,
} from "./ai-client";
import { type AIStatus, type ChatAction } from "./ai-contract";
import { startPlan, replyToWorkout, recordSet } from "./workouts";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Coffee,
  CookingPot,
  Dumbbell,
  Flame,
  Footprints,
  ImagePlus,
  Inbox,
  Info,
  CircleDot,
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
  clockTime,
  id,
  initialState,
  interpretText,
  makeMeal,
  mealSchema,
  resolveReview,
  sumNutrition,
  personalMeals,
  repeatMeal,
  scaleMealPortion,
  today,
  upgradeChat,
  type AppState,
  type Meal,
  type Page,
} from "./domain";
import { useLocalDay } from "./useLocalDay";

const navigation = [
  { name: "Today" as const, icon: Sun },
  { name: "Chat" as const, icon: MessageCircle },
  { name: "Nutrition" as const, icon: BarChart3 },
  { name: "Workouts" as const, icon: Dumbbell },
  { name: "Kitchen" as const, icon: CookingPot },
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
      "In the sample history, days with at least 30g of protein at breakfast averaged 38g more protein overall. This is an example of how Rep & Plate could explain a pattern — it is not a conclusion about your actual health data.",
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
      "Oil and sauce can be hard to see in a photo. Rep & Plate should show that uncertainty and let you correct it without requiring a full meal re-entry. This prototype uses sample estimates, not image recognition.",
    evidence: "Sample history · 2 home-cooked meals",
  },
];

function App({ onReplayOnboarding }: { onReplayOnboarding: () => void }) {
  useLocalDay();
  const [state, setState, stateForSync] = useBrowserRecords(() =>
    setToast(
      "Device saving could not finish. Export your records before closing the app.",
    ),
  );
  const [page, setPage] = useState<Page>(() =>
    location.hash === "#connections"
      ? "You"
      : (navigation.find((n) => n.name.toLowerCase() === location.hash.slice(1))
          ?.name ?? "Chat"),
  );
  const [toast, setToast] = useState("");
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const [editProposalId, setEditProposalId] = useState<string | null>(null);
  const [captureDay, setCaptureDay] = useState<string | null>(null);
  const [scannerProduct, setScannerProduct] = useState<
    FoodProduct | undefined
  >();
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>();
  const [resumeRecipe, setResumeRecipe] = useState(false);
  const [recordRevision, setRecordRevision] = useState(0);
  function clearCaptureDrafts() {
    setRecordRevision((current) => current + 1);
    setPlannerOpen(false);
    setPreferencesOpen(false);
    setShoppingOpen(false);
    setWorkoutBuilderOpen(false);
    setVoiceOpen(false);
    setProfileOpen(false);
    setGroceriesOpen(null);
    setReviewMessageId(null);
    setLinkMealId(null);
    setCaptureOpen(false);
    setReceiptCapture(false);
    setCaptureContext("");
    setCaptureError("");
    setRecipeDraft(undefined);
    setResumeRecipe(false);
    setCaptureDay(null);
    setScannerProduct(undefined);
    setEditProposalId(null);
    setEditMeal(null);
    setRecipesOpen(false);
    setScannerOpen(false);
    setLabelGTIN(null);
    setUpload(null);
    setComposer("");
  }
  useEffect(() => {
    let owner = localStorage.getItem("health.records.owner");
    return onAccountChange(() => {
      const next = localStorage.getItem("health.records.owner");
      if (next !== owner) {
        owner = next;
        clearCaptureDrafts();
        cancelPendingAI();
      }
    });
  }, []);
  function manualMeal(day: string) {
    setEditProposalId(null);
    setEditMeal({
      id: id(),
      title: "",
      category: "Lunch",
      day,
      time: clockTime(),
      source: "Manual entry",
      confidence: "confirmed",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      note: "",
    });
  }
  function correctProposal(messageId: string) {
    const proposal = state.messages.find(
      (m) => m.id === messageId,
    )?.mealProposal;
    if (!proposal) return;
    const totals = proposal.components
      ? sumProposalComponents(proposal.components)
      : proposal;
    setEditProposalId(messageId);
    setEditMeal({
      id: messageId,
      title: proposal.title,
      category: proposal.category,
      day: proposal.day ?? captureDay ?? today(),
      time: clockTime(),
      source: "Unlogged estimate — review before logging",
      confidence: "estimated",
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      note: proposal.note,
    });
  }
  const [profileOpen, setProfileOpen] = useState(false);
  const [info, setInfo] = useState<{
    title: string;
    text: string;
    evidence?: string;
  } | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [receiptCapture, setReceiptCapture] = useState(false);
  const [captureError, setCaptureError] = useState("");
  const [upload, setUpload] = useState<{ name: string; image: string } | null>(
    null,
  );
  const [composer, setComposer] = useState("");
  const [reviewMessageId, setReviewMessageId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [aiStatus, setAIStatus] = useState<AIStatus | null>(null);
  const [aiStage, setAIStage] = useState("");
  const [captureContext, setCaptureContext] = useState("");
  const [groceriesOpen, setGroceriesOpen] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [labelGTIN, setLabelGTIN] = useState<string | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [shoppingTab, setShoppingTab] = useState<"swaps" | "list" | "spending">(
    "swaps",
  );
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [workoutBuilderOpen, setWorkoutBuilderOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(
    () => location.hash === "#connections",
  );
  const [connectionsStarted, setConnectionsStarted] = useState(
    () => location.hash === "#connections",
  );
  const connectionState = useRef(state);
  connectionState.current = state;
  const [replaySpotIntro, setReplaySpotIntro] = useState(false);
  const [linkMealId, setLinkMealId] = useState<string | null>(null);
  const scanAction = useRef(crypto.randomUUID());
  function openScanner() {
    scanAction.current = crypto.randomUUID();
    setScannerProduct(undefined);
    setScannerOpen(true);
  }
  function addScannedProduct(
    product: FoodProduct,
    action: "grocery" | "meal",
    servings: number,
  ) {
    const actionId = scanAction.current;
    setState((s) => captureProduct(s, product, action, servings, actionId));
    setScannerOpen(false);
    navigate("Chat");
  }
  const aiBusy = useRef(false);
  const aiGeneration = useRef(0);
  const aiRequestController = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      aiGeneration.current++;
      aiRequestController.current?.abort();
    },
    [],
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = state.reviews.filter((r) => !r.resolved);
  const totals = sumNutrition(state.meals);
  const todayMeals = personalMeals(state.meals, today());
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
    apiFetch("/api/status")
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
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const onHash = () => {
      if (location.hash === "#connections") {
        setPage("You");
        setConnectionsStarted(true);
        setConnectionsOpen(true);
        return;
      }
      setPage(
        navigation.find((n) => n.name.toLowerCase() === location.hash.slice(1))
          ?.name ?? "Chat",
      );
    };
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
  function cancelPendingAI() {
    aiGeneration.current++;
    aiRequestController.current?.abort();
    aiRequestController.current = null;
    aiBusy.current = false;
    setProcessing(false);
    setAIStage("");
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
          captureDay: captureDay ?? undefined,
        };
    if (!message) return;
    const generation = ++aiGeneration.current;
    const controller = new AbortController();
    aiRequestController.current = controller;
    aiBusy.current = true;
    setProcessing(true);
    setAIStage("Connecting to Rep & Plate…");
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
        (stage) => {
          if (generation === aiGeneration.current) setAIStage(stage);
        },
        controller.signal,
      );
      if (generation !== aiGeneration.current) return;
      setState((s) =>
        generation === aiGeneration.current ? applyAIResult(s, result) : s,
      );
    } catch (error) {
      if (generation !== aiGeneration.current) return;
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
      if (generation === aiGeneration.current) {
        aiRequestController.current = null;
        aiBusy.current = false;
        setProcessing(false);
        setAIStage("");
      }
    }
  }
  function openChatAction(action: ChatAction) {
    switch (action) {
      case "pantry":
        setGroceriesOpen("*");
        break;
      case "recipes":
        setRecipesOpen(true);
        break;
      case "meal-plan":
        setPlannerOpen(true);
        break;
      case "preferences":
        setPreferencesOpen(true);
        break;
      case "workout":
        setWorkoutBuilderOpen(true);
        break;
      case "shopping":
        setShoppingTab("swaps");
        setShoppingOpen(true);
        break;
    }
  }
  function submitText(e?: FormEvent, preset?: string) {
    e?.preventDefault();
    const text = (preset ?? composer).trim();
    if (!text || processing) return;
    if (
      /^(?:my |open )?(?:shopping list|smart swaps|shopping|grocery spending)[?!.]*$/i.test(
        text,
      )
    ) {
      setComposer("");
      setShoppingTab(
        /list/i.test(text)
          ? "list"
          : /spending/i.test(text)
            ? "spending"
            : "swaps",
      );
      setShoppingOpen(true);
      return;
    }
    if (
      /^(?:my |open )?(?:recipes|leftovers|recipes (?:and|&) leftovers)[?!.]*$/i.test(
        text,
      )
    ) {
      setComposer("");
      setRecipesOpen(true);
      return;
    }
    if (/^(?:my |open )?(?:pantry|groceries)[?!.]*$/i.test(text)) {
      setComposer("");
      setGroceriesOpen("*");
      return;
    }
    if (/^(scan(?: a barcode)?|barcode)$/i.test(text)) {
      setComposer("");
      openScanner();
      return;
    }
    if (/^(?:plan (?:my |a )?week|weekly meal plan|meal plan)$/i.test(text)) {
      setComposer("");
      setPlannerOpen(true);
      return;
    }
    if (/^(?:my preferences|food preferences)$/i.test(text)) {
      setComposer("");
      setPreferencesOpen(true);
      return;
    }
    if (/^(?:create|build|generate) (?:my |a )?workout$/i.test(text)) {
      setComposer("");
      setWorkoutBuilderOpen(true);
      return;
    }
    if (aiStatus === null) {
      notify("Connecting to Rep & Plate. Please try again in a moment.");
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
          !s.profile.targetsConfigured
            ? `You’ve recorded ${current.calories.toLocaleString()} calories and ${current.protein}g protein today. No daily targets are set; this may be a partial day of food.`
            : current.calories > s.profile.calories
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
              text: "Your workout is ready. Choose your loads in Workouts, then tap your reps here or there.",
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
                text: "That’s the sample dinner. It isn’t counted in your daily totals.",
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
          "This is a sample estimate, so it isn’t counted in your daily totals. Scan a product or use connected Chat to log your own food.";
      } else if (result.kind === "repeat") {
        const previous = [...personalMeals(s.meals)]
          .reverse()
          .find((m) => m.category === "Breakfast" && m.day < today());
        if (previous) {
          const meal = repeatMeal(s, previous.id).meals.at(-1)!;
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
                ? {
                    ...ex,
                    weight: result.weight,
                    weightConfirmed: true,
                    setWeights: result.reps.map(() => result.weight),
                    sets: result.reps,
                  }
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
    setCaptureError("");
    const reportError = (message: string) => {
      setCaptureError(message);
      notify(message);
    };
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reportError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 12000000) {
      reportError("Choose an image smaller than 12 MB.");
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
        reportError(
          "This image is still too large. Please crop the receipt or choose a smaller photo.",
        );
        return;
      }
      if (!captureOpen) setCaptureContext("");
      setUpload({ name: file.name, image });
      setCaptureOpen(true);
    } catch {
      reportError("That image couldn’t be opened. Please try another.");
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
          question: receiptCapture
            ? "Your grocery receipt is saved for review. These purchases have not been added to meals or pantry stock."
            : "Your image is saved. Add a meal estimate or keep it as a note.",
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
    setReceiptCapture(false);
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
    if (reps !== null) {
      setState((s) => ({
        ...s,
        workout: recordSet(s.workout, exIndex, setIndex, reps, undefined, s.profile.workoutUnit ?? 'lb'),
      }));
      return;
    }
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
    setVoiceOpen(true);
  }

  return (
    <SpotVisuals value={state.spot?.visuals !== false}>
      <div
        className={`app-shell ${page === "Chat" || page === "Nutrition" || page === "Kitchen" || page === "Workouts" || page === "You" || page === "Review" ? "chat-home" : ""}`}
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
          <Suspense fallback={null}>
            <AccountSync
              state={state}
              onRestore={async (value) => {
                const before = stateForSync.current;
                await persistBrowserRecords(value);
                if (stateForSync.current !== before) {
                  await persistBrowserRecords(stateForSync.current);
                  throw Error(
                    "Your records changed while loading. Sync will check again.",
                  );
                }
                cancelPendingAI();
                clearCaptureDrafts();
                setState(value);
              }}
            />
          </Suspense>
          <header className="topbar">
            <div className="desktop-crumb">
              <span>Your space</span>
              <ChevronRight size={14} />
              <strong>{page}</strong>
            </div>
            <button
              className="mobile-brand brand-button"
              onClick={() => navigate("Chat")}
              aria-label="Rep & Plate home"
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
            className={`main-content ${page === "Chat" || page === "Nutrition" || page === "Kitchen" || page === "Workouts" || page === "You" || page === "Review" ? "chat-main" : ""}`}
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
                      Hey {state.profile.name}. Here’s what matters. We’ve
                      handled the rest.
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
                        <CircleDot size={15} />
                      </span>
                      {!state.profile.targetsConfigured ? 'Recorded meals, at your own pace.' : totals.protein < state.profile.protein
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
                          <Clock3 size={15} /> ~42 min <span>·</span> 5
                          exercises
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
                        text: "7 hours and 12 minutes of sleep is a sample recovery record, close to the demo’s 7-hour average. Rep & Plate is not currently connected to a wearable.",
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
                        <ShieldCheck size={14} /> Estimates you can always
                        adjust.
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
                        In your sample history, a protein-rich breakfast goes
                        with <strong>38g more protein</strong> by the end of the
                        day.
                      </p>
                      <span className="insight-link">
                        The little things that help
                        <ArrowUpRight size={17} />
                      </span>
                    </button>
                  </section>
                </div>
                <section className="capture-strip">
                  <IconTile icon={CircleDot} />
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
                  <CircleDot size={13} /> Less bookkeeping. More living.{" "}
                  <span>Sample data · saved on this device</span>
                </p>
              </div>
            )}

            {page === "Nutrition" && (
              <NutritionPage
                key={recordRevision}
                onManualMeal={manualMeal}
                onCaptureMeal={(day) => {
                  setCaptureDay(day);
                  navigate("Chat");
                }}
                onScan={openScanner}
                onEditGoals={() => setProfileOpen(true)}
                onOpenPantry={() => setGroceriesOpen("*")}
                onOpenPlan={() => setPlannerOpen(true)}
                onOpenRecipes={() => setRecipesOpen(true)}
                onAsk={(text) => {
                  navigate("Chat");
                  submitText(undefined, text);
                }}
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
                replayIntro={replaySpotIntro}
                onReplayIntro={(replay) =>
                  replay ? onReplayOnboarding() : setReplaySpotIntro(false)
                }
                onCorrectMeal={correctProposal}
                captureDay={captureDay}
                onClearCaptureDay={() => setCaptureDay(null)}
                onActivityCapture={(messageId, accept) => {
                  try {
                    resolveActivityProposal(state, messageId, accept);
                    setState((s) =>
                      resolveActivityProposal(s, messageId, accept),
                    );
                  } catch (error) {
                    notify(
                      error instanceof Error
                        ? error.message
                        : "Review the activity details.",
                    );
                  }
                }}
                onSpotSettings={(patch) =>
                  setState((s) => ({ ...s, spot: { ...s.spot, ...patch } }))
                }
                onWorkoutCapture={(messageId, accept) => {
                  try {
                    resolveWorkoutCapture(state, messageId, accept);
                    setState((s) =>
                      resolveWorkoutCapture(s, messageId, accept),
                    );
                  } catch (e) {
                    notify(
                      e instanceof Error
                        ? e.message
                        : "Check the workout details.",
                    );
                  }
                }}
                reviewMessageId={reviewMessageId}
                onReviewFocused={() => setReviewMessageId(null)}
                onPantryLinks={setLinkMealId}
                onPreferenceProposal={(messageId, accept) => {
                  try {
                    resolvePreferenceProposal(state, messageId, accept);
                    setState((current) =>
                      resolvePreferenceProposal(current, messageId, accept),
                    );
                    notify(
                      accept
                        ? "Preferences saved."
                        : "Your preferences are unchanged.",
                    );
                  } catch (error) {
                    notify(
                      error instanceof Error
                        ? error.message
                        : "These preferences need a check.",
                    );
                  }
                }}
                state={state}
                composer={composer}
                processing={processing}
                aiAvailable={aiStatus?.available ?? false}
                aiStage={aiStage}
                onRetry={(messageId) => {
                  void sendAI("", undefined, messageId);
                }}
                onGroceries={setGroceriesOpen}
                onScan={openScanner}
                onPlan={() => setPlannerOpen(true)}
                onPreferences={() => setPreferencesOpen(true)}
                onRecipes={() => setRecipesOpen(true)}
                onAction={openChatAction}
                onRecipePortion={(messageId, accept) => {
                  try {
                    resolveRecipePortionProposal(state, messageId, accept);
                    setState((current) => {
                      try {
                        return resolveRecipePortionProposal(
                          current,
                          messageId,
                          accept,
                        );
                      } catch {
                        return current;
                      }
                    });
                  } catch (error) {
                    notify(
                      error instanceof Error
                        ? error.message
                        : "Review the remaining portions before logging.",
                    );
                  }
                }}
                onAddMeal={(messageId) =>
                  setState((s) => addProposedMeal(s, messageId))
                }
                onComposerChange={setComposer}
                onSend={submitText}
                onCamera={() => {
                  setReceiptCapture(false);
                  cameraRef.current?.click();
                }}
                onAttach={() => {
                  setReceiptCapture(false);
                  fileRef.current?.click();
                }}
                onVoice={voice}
                onProfile={() => navigate("You")}
                onNavigate={navigate}
                onEditMeal={setEditMeal}
                onSample={() => {
                  setReceiptCapture(false);
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

            {page === "Kitchen" && (
              <KitchenPage
                state={state}
                onNavigate={navigate}
                onScan={openScanner}
                onTargets={() => setProfileOpen(true)}
                onAddReceipt={() => {
                  setReceiptCapture(true);
                  setCaptureError("");
                  setUpload(null);
                  setCaptureContext("");
                  setCaptureOpen(true);
                }}
                onShopping={() => {
                  setShoppingTab("swaps");
                  setShoppingOpen(true);
                }}
                onPreferences={() => setPreferencesOpen(true)}
                onPantry={() => setGroceriesOpen("*")}
                onReceipt={(receiptId) => setGroceriesOpen(receiptId)}
                onPlan={() => setPlannerOpen(true)}
                onRecipes={() => setRecipesOpen(true)}
                onAsk={(text) => {
                  navigate("Chat");
                  submitText(undefined, text);
                }}
              />
            )}

            {page === "Workouts" && (
              <WorkoutPage
                key={recordRevision}
                onScan={openScanner}
                state={state}
                setState={setState}
                onNavigate={navigate}
                onProfile={() => navigate("You")}
                onVoice={voice}
                onBuild={() => setWorkoutBuilderOpen(true)}
              />
            )}

            {(page === "You" || page === "Review") && (
              <YouPage
                key={recordRevision}
                onSaveBodyWeight={(entry) =>
                  setState((s) => ({
                    ...s,
                    bodyWeights: saveBodyWeight(s.bodyWeights ?? [], entry),
                  }))
                }
                onScan={openScanner}
                onRecipes={() => setRecipesOpen(true)}
                onReviewMessage={(messageId) => {
                  setReviewMessageId(messageId);
                  navigate("Chat");
                }}
                onAccount={() => setCloudOpen(true)}
                onConnections={() => {
                  setConnectionsStarted(true);
                  setConnectionsOpen(true);
                }}
                onMeetSpot={() => {
                  onReplayOnboarding();
                }}
                state={state}
                aiAvailable={aiStatus?.available ?? false}
                onGroceries={(receiptId) => setGroceriesOpen(receiptId ?? "*")}
                onPreferences={() => setPreferencesOpen(true)}
                onPlan={() => setPlannerOpen(true)}
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
              <IconTile icon={CircleDot} />
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
            title={
              receiptCapture
                ? upload
                  ? "Your receipt, ready to read."
                  : "Add a grocery receipt"
                : upload
                  ? "A moment, captured."
                  : "Show me what happened."
            }
            onClose={() => {
              setCaptureOpen(false);
              setUpload(null);
              setReceiptCapture(false);
            }}
          >
            <div className="capture-modal">
              {captureError && <p role="alert">{captureError}</p>}
              {upload ? (
                <>
                  <img
                    className="upload-preview"
                    src={upload.image}
                    alt={
                      receiptCapture
                        ? "Your grocery receipt"
                        : "Your uploaded capture"
                    }
                  />
                  <p>
                    {aiStatus?.available
                      ? receiptCapture
                        ? "Check that the store, items, and prices are readable. We’ll identify your groceries and research their nutrition, keeping purchases separate from meals you ate."
                        : "Send a meal photo, grocery receipt, or order screenshot. Rep & Plate will read it and look for useful nutrition sources."
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
                          const text = receiptCapture
                            ? "This is a grocery receipt for items I purchased. Identify the store and items, research their nutrition, and save the grocery list separately from meals I ate. Do not log these purchases as food eaten." +
                              (captureContext.trim()
                                ? `\n\nAdditional context: ${captureContext.trim()}`
                                : "")
                            : captureContext.trim() ||
                              "Please help me understand this photo or receipt. If these are groceries I purchased, research their nutrition and save the grocery list separately from meals I ate.";
                          setCaptureOpen(false);
                          setUpload(null);
                          setReceiptCapture(false);
                          navigate("Chat");
                          void sendAI(text, image);
                        }}
                      >
                        Send to Rep & Plate <ArrowRight size={17} />
                      </button>
                      <p className="section-note">
                        Sent to our AI provider for image reading and web
                        research; extracted details may be checked by TypeSafe.
                        Your saved records stay in this browser.
                      </p>
                    </>
                  )}
                  <button
                    className={`button ${aiStatus?.available ? "" : "primary"} full-width`}
                    onClick={saveUploadForReview}
                  >
                    Save my image for review
                    <Inbox size={17} />
                  </button>
                  {receiptCapture && (
                    <button
                      className="button full-width"
                      onClick={() => setUpload(null)}
                    >
                      Retake or choose another photo
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p>
                    {receiptCapture
                      ? "Lay your receipt flat in good light. Include the store name, items, and total in the photo."
                      : "A photo, an order screenshot, or a few words. Start wherever is easiest."}
                  </p>
                  {receiptCapture && (
                    <button
                      className="button primary full-width"
                      onClick={() => cameraRef.current?.click()}
                    >
                      <Camera size={20} /> Take a photo
                    </button>
                  )}
                  <button
                    className="upload-zone"
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImagePlus size={31} />
                    <strong>
                      {receiptCapture
                        ? "Choose a photo"
                        : "Choose a photo or screenshot"}
                    </strong>
                    <span>JPG, PNG, WebP · up to 12 MB</span>
                  </button>
                </>
              )}
              {!receiptCapture && (
                <>
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
                    Demo flows use preset meals. Use “Send to Rep & Plate” above
                    for real image reading and nutrition research.
                  </p>
                </>
              )}
            </div>
          </Modal>
        )}
        <Suspense fallback={null}>
          {connectionsStarted && (
            <ConnectionsHub
              state={state}
              open={connectionsOpen}
              onClose={() => {
                setConnectionsOpen(false);
                if (location.hash === "#connections") navigate("You");
              }}
              onApply={async (action, status) => {
                const before = connectionState.current,
                  epoch = cloudEpoch();
                const next = resolveAgentMeal(before, action, status);
                await persistBrowserRecords(next);
                if (epoch !== cloudEpoch())
                  throw Error(
                    "Your account changed. Reopen Connections to check your review.",
                  );
                if (connectionState.current !== before) {
                  await persistBrowserRecords(connectionState.current);
                  throw Error(
                    "Your records changed during this review. Please review the proposal again.",
                  );
                }
                connectionState.current = next;
                setState(next);
                notify(
                  status === "accepted"
                    ? "Meal saved on this device. Edit or remove it in Nutrition."
                    : "Proposal dismissed.",
                );
              }}
            />
          )}
          {linkMealId && (
            <PantryLinkReview
              state={state}
              mealId={linkMealId}
              onChange={setState}
              onClose={() => setLinkMealId(null)}
            />
          )}
          {cloudOpen && (
            <CloudAccount
              state={state}
              onClose={() => setCloudOpen(false)}
              onRestore={(restored) => {
                cancelPendingAI();
                clearCaptureDrafts();
                setState(restored);
                notify("Cloud records loaded onto this device.");
              }}
            />
          )}
          {voiceOpen && (
            <VoiceCapture
              onClose={() => setVoiceOpen(false)}
              onSend={(text) => {
                setVoiceOpen(false);
                if (page === "Workouts" && state.workout.status === "active")
                  setState((s) => ({
                    ...s,
                    workout: replyToWorkout(s.workout, text, s.profile.workoutUnit ?? 'lb'),
                  }));
                else submitText(undefined, text);
              }}
            />
          )}
          {shoppingOpen && (
            <ShoppingDialog
              initialTab={shoppingTab}
              state={state}
              onChange={setState}
              onClose={() => setShoppingOpen(false)}
              onPreferences={() => {
                setShoppingOpen(false);
                setPreferencesOpen(true);
              }}
              onPantry={() => {
                setShoppingOpen(false);
                setGroceriesOpen("*");
              }}
            />
          )}
          {preferencesOpen && (
            <PreferencesDialog
              value={state.preferences}
              onClose={() => setPreferencesOpen(false)}
              onSave={(preferences) => {
                setState((s) => ({ ...s, preferences }));
                setPreferencesOpen(false);
                notify("Your preferences are saved.");
              }}
            />
          )}
          {plannerOpen && (
            <MealPlanner
              receipts={state.groceries ?? []}
              lots={getPantryLots(state).slice(0, 100)}
              preferences={state.preferences ?? defaultPreferences()}
              goals={state.profile}
              goalsConfigured={state.profile.targetsConfigured === true}
              value={state.mealPlans?.at(-1)}
              plans={state.mealPlans}
              loggedMealIds={state.meals.map((meal) => meal.id)}
              onClose={() => setPlannerOpen(false)}
              onDraftChange={(plan) =>
                setState((s) => ({
                  ...s,
                  mealPlans: [
                    ...(s.mealPlans ?? []).filter((p) => p.id !== plan.id),
                    plan,
                  ],
                }))
              }
              onGenerate={async (context) => {
                const response = await apiFetch("/api/plans/meals", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...context,
                    goals: {
                      calories: state.profile.calories,
                      protein: state.profile.protein,
                      carbs: state.profile.carbs,
                      fat: state.profile.fat,
                    },
                  }),
                  signal: AbortSignal.timeout(125000),
                });
                const result = await response.json();
                if (!response.ok)
                  throw new Error(result.error ?? "Planning couldn't finish.");
                return mealPlanSchema.parse(result);
              }}
              onSave={(plan) => {
                setState((s) => ({
                  ...s,
                  mealPlans: [
                    ...(s.mealPlans ?? []).filter((p) => p.id !== plan.id),
                    plan,
                  ],
                }));
                notify(
                  plan.status === "draft"
                    ? "Draft saved. Nothing has been logged as eaten."
                    : "Meal plan saved. Nothing has been logged as eaten.",
                );
              }}
              onAsk={(text) => {
                setPlannerOpen(false);
                navigate("Chat");
                void sendAI(text);
              }}
              onLog={(meal, planId) => {
                const selections = mealPortionSelections(
                  meal,
                  getPantryLots(state),
                );
                if (!selections)
                  throw new Error(
                    "Check ingredient availability before logging.",
                  );
                const operation = `plan:${planId}:${meal.id}`;
                const apply = (current: AppState) =>
                  mealFromPantry(
                    current,
                    selections,
                    operation,
                    meal.category ?? "Dinner",
                    meal.title,
                  );
                apply(state);
                // The planner acknowledges the persisted meal; a concurrent stock change stays recoverable.
                setState((current) => {
                  try {
                    return apply(current);
                  } catch {
                    return current;
                  }
                });
              }}
            />
          )}
          {workoutBuilderOpen && (
            <WorkoutBuilder
              state={state}
              onClose={() => setWorkoutBuilderOpen(false)}
              onStart={(plan) => {
                setState((s) => {
                  if (s.workout.status === "active") return s;
                  return {
                    ...s,
                    workout: {
                      status: "active",
                      planId: "personalized",
                      routines: s.workout.routines,
                      title: plan.title,
                      startedAt: new Date().toISOString(),
                      finishedAt: null,
                      history: [
                        ...(s.workout.history ?? []),
                        ...(s.workout.startedAt
                          ? [
                              {
                                title: s.workout.title ?? "Workout",
                                exercises: s.workout.exercises,
                                startedAt: s.workout.startedAt,
                                finishedAt: s.workout.finishedAt,
                              },
                            ]
                          : []),
                      ],
                      exercises: plan.exercises.map((ex) => ({
                        name: ex.name,
                        weight: 0,
                        target: ex.reps,
                        previous: [],
                        sets: Array(ex.sets).fill(null),
                      })),
                      conversation: [
                        {
                          id: id(),
                          role: "assistant",
                          time: clockTime(),
                          text:
                            plan.reason +
                            " Choose comfortable weights before logging your sets.",
                        },
                      ],
                    },
                  };
                });
                setWorkoutBuilderOpen(false);
                navigate("Workouts");
              }}
            />
          )}
          {groceriesOpen && (
            <PantryDialog
              state={state}
              receiptId={groceriesOpen === "*" ? undefined : groceriesOpen}
              onChange={setState}
              onClose={() => {
                setGroceriesOpen(null);
                if (resumeRecipe) {
                  setResumeRecipe(false);
                  setRecipesOpen(true);
                }
              }}
              onAsk={(text) => {
                navigate("Chat");
                void sendAI(text);
              }}
            />
          )}
          {recipesOpen && (
            <RecipeDialog
              state={state}
              onChange={setState}
              draft={recipeDraft}
              onDraftChange={setRecipeDraft}
              onOpenPantry={() => {
                setResumeRecipe(true);
                setRecipesOpen(false);
                setGroceriesOpen("*");
              }}
              onClose={() => setRecipesOpen(false)}
            />
          )}
          {scannerOpen && (
            <ProductScanner
              initialProduct={scannerProduct}
              initialBarcode={scannerProduct?.gtin}
              onClose={() => setScannerOpen(false)}
              onProduct={addScannedProduct}
              lookupOverride={(gtin) =>
                (state.products ?? []).find((p) => p.gtin === gtin)
              }
              onLabel={(gtin) => {
                setScannerOpen(false);
                setLabelGTIN(gtin);
              }}
            />
          )}
          {labelGTIN && (
            <LabelCapture
              gtin={labelGTIN}
              onClose={() => setLabelGTIN(null)}
              onExtract={async (image) => {
                const response = await apiFetch("/api/products/label", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ barcode: labelGTIN, image }),
                  signal: AbortSignal.timeout(125000),
                });
                const value = await response.json();
                if (!response.ok)
                  throw new Error(
                    value.error ?? "This label couldn't be read.",
                  );
                return productSchema.parse(value);
              }}
              onConfirm={(product) => {
                setState((s) => savePrivateProduct(s, product));
                setLabelGTIN(null);
                openScanner();
                setScannerProduct(product);
                notify("Label saved. Review the portion to continue.");
              }}
            />
          )}
        </Suspense>
        {editMeal && (
          <MealEditor
            key={editMeal.id}
            isProposal={!!editProposalId}
            newManual={!editProposalId && !state.meals.some((m) => m.id === editMeal.id) && editMeal.source === 'Manual entry'}
            repeatDraft={!state.meals.some((m) => m.id === editMeal.id) && editMeal.source === 'Repeated saved meal'}
            onRepeat={
              !editProposalId && state.meals.some((m) => m.id === editMeal.id)
                ? () =>
                    setEditMeal(repeatMeal(state, editMeal.id).meals.at(-1)!)
                : undefined
            }
            onPantryLinks={
              !editMeal.recipeBatchId &&
              state.meals.some((meal) => meal.id === editMeal.id) &&
              (state.groceries?.length ?? 0) > 0
                ? () => {
                    setLinkMealId(editMeal.id);
                    setEditMeal(null);
                  }
                : undefined
            }
            meal={editMeal}
            onClose={() => {
              setEditMeal(null);
              setEditProposalId(null);
            }}
            onSave={(meal) => {
              if (editProposalId) {
                setState((s) => ({
                  ...s,
                  messages: s.messages.map((message) => {
                    if (message.id !== editProposalId || !message.mealProposal)
                      return message;
                    const original = message.mealProposal;
                    const totals = original.components
                      ? sumProposalComponents(original.components)
                      : original;
                    const changed = (
                      ["calories", "protein", "carbs", "fat"] as const
                    ).some((key) => totals[key] !== meal[key]);
                    return {
                      ...message,
                      text: "Review your corrected estimate below. It has not been logged yet.",
                      mealProposal: {
                        ...original,
                        title: meal.title,
                        category: meal.category,
                        day: meal.day,
                        calories: meal.calories,
                        protein: meal.protein,
                        carbs: meal.carbs,
                        fat: meal.fat,
                        note: meal.note.slice(0, 1200),
                        ...(changed
                          ? {
                              components: undefined,
                              portion: "Your corrected portion",
                              sources: [],
                            }
                          : {}),
                      },
                    };
                  }),
                }));
                setEditMeal(null);
                setEditProposalId(null);
                notify(
                  "Estimate updated. Review and confirm it before logging.",
                );
                return;
              }
              setState((previous) => {
                const old = previous.meals.find((m) => m.id === meal.id);
                const changed =
                  old &&
                  (["calories", "protein", "carbs", "fat"] as const).some(
                    (k) => old[k] !== meal[k],
                  );
                const s = changed
                  ? detachMealFromPantry(previous, meal.id)
                  : previous;
                const savedMeal = changed
                  ? { ...meal, components: undefined }
                  : meal;
                return {
                  ...s,
                  meals: old
                    ? s.meals.map((m) => (m.id === meal.id ? savedMeal : m))
                    : [...s.meals, savedMeal],
                  messages: s.messages.map((message) =>
                    message.mealId === meal.id && message.role === "assistant"
                      ? {
                          ...message,
                          text: "Your meal was updated. The saved details below reflect your correction.",
                        }
                      : message,
                  ),
                  reviews: s.reviews.map((r) =>
                    `review-meal-${r.id}` === meal.id
                      ? { ...r, resolved: true, answer: "Meal added by you" }
                      : r,
                  ),
                };
              });
              setEditMeal(null);
              notify("Meal updated. Your day is up to date.");
            }}
            onDelete={
              state.meals.some((m) => m.id === editMeal.id)
                ? () => {
                    setState((s) => deleteMealWithPantry(s, editMeal.id));
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
              cancelPendingAI();
              setState(initialState());
              clearCaptureDrafts();
              setProfileOpen(false);
              navigate("Chat");
              notify("Fresh start. Your food log is empty.");
            }}
          />
        )}
      </div>
    </SpotVisuals>
  );
}

function MealEditor({
  onRepeat,
  isProposal = false,
  newManual = false,
  repeatDraft = false,
  onPantryLinks,
  meal,
  onClose,
  onSave,
  onDelete,
}: {
  meal: Meal;
  onRepeat?: () => void;
  isProposal?: boolean;
  newManual?: boolean;
  repeatDraft?: boolean;
  onPantryLinks?: () => void;
  onClose: () => void;
  onSave: (meal: Meal) => void;
  onDelete?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState(() => ({calories:newManual ? '' : String(meal.calories),protein:newManual ? '' : String(meal.protein),carbs:newManual ? '' : String(meal.carbs),fat:newManual ? '' : String(meal.fat)}));
  const [portion, setPortion] = useState('1');
  const [appliedPortion, setAppliedPortion] = useState(1);
  const [reviewedMeal, setReviewedMeal] = useState(meal);
  const [note, setNote] = useState(meal.note);
  function applyPortion() {
    try {
      const multiplier = Number(portion);
      const scaled = scaleMealPortion(meal,multiplier);
      setReviewedMeal(scaled);
      setValues({calories:String(scaled.calories),protein:String(scaled.protein),carbs:String(scaled.carbs),fat:String(scaled.fat)});
      setAppliedPortion(multiplier);
      setNote(`${multiplier} × the original saved portion. Pantry and prepared portions were not changed.`);
      setError('');
    } catch (error) { setError(error instanceof Error ? error.message : 'Check the portion.'); }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (Object.values(values).some(value=>!value.trim())) {
      setError('Enter all four nutrition values. Use 0 only for a known zero; unknown values cannot be saved as zero.');
      return;
    }
    const parsed = mealSchema.safeParse({
      ...reviewedMeal,
      title: String(form.get("title")).trim(),
      category: form.get("category"),
      day: String(form.get("day")),
      calories: Number(form.get("calories")),
      protein: Number(form.get("protein")),
      carbs: Number(form.get("carbs")),
      fat: Number(form.get("fat")),
      note: String(form.get("note")),
      confidence: repeatDraft ? meal.confidence : "confirmed",
    });
    const date = String(form.get("day"));
    if (
      !parsed.success ||
      !parsed.data.title ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date > today() ||
      new Date(`${date}T12:00:00`).getDate() !== Number(date.slice(-2))
    ) {
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
        {newManual && <p>Enter calories, protein, carbs and fat from a label or your own estimate. Use 0 only when you know the value is zero. If you don’t know a value, ask Spot for a reviewed estimate instead.</p>}
        {repeatDraft && <div className="estimate-notice"><div>
          <label>Portion multiplier<input type="number" min="0.0001" max="100" step="any" value={portion} onChange={event=>setPortion(event.target.value)} /></label>
          <button className="button secondary" type="button" onClick={applyPortion}>Apply portion</button>
          <p>1 repeats the original portion; 0.5 is half and 2 is double. Apply, review the values below, then save. Pantry and prepared portions are not changed.</p>
          {Number(portion) !== appliedPortion && <p role="status">Apply the portion before saving.</p>}
        </div></div>}
        {isProposal && (
          <p>
            Editing this estimate does not log it. Your original stays unchanged
            if you close this form.
          </p>
        )}
        {onRepeat && (
          <button className="button secondary" type="button" onClick={onRepeat}>
            Repeat meal
          </button>
        )}
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
          Meal date
          <input
            name="day"
            type="date"
            required
            max={today()}
            defaultValue={meal.day}
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
                step="any"
                value={values[key]}
                onChange={event=>setValues(current=>({...current,[key]:event.target.value}))}
              />
            </label>
          ))}
        </div>
        <label>
          Notes
          <textarea
            name="note"
            maxLength={1500}
            value={note}
            onChange={event=>setNote(event.target.value)}
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
        <button className="button primary full-width" type="submit" disabled={repeatDraft && Number(portion) !== appliedPortion}>
          Save changes
          <Check size={18} />
        </button>
        {onPantryLinks && (
          <button
            className="button secondary full-width"
            type="button"
            onClick={onPantryLinks}
          >
            Review pantry ingredients
            <ChevronRight size={17} />
          </button>
        )}
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
            ...profile,
            name,
            targetsConfigured: data.get("targetsConfigured") === "on",
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
        <label>
          <input
            type="checkbox"
            name="targetsConfigured"
            defaultChecked={profile.targetsConfigured ?? false}
          />{" "}
          I have reviewed these targets for my needs
        </label>
        <details>
          <summary>New to targets?</summary>
          <p>
            You can start by recording meals without choosing a calorie goal.
            The sample numbers are not a recommendation. Use targets you already
            follow, or discuss suitable targets with a registered dietitian.
            Protein, carbs and fat are measured in grams.
          </p>
        </details>
        <button className="button primary full-width" type="submit">
          Save preferences
          <Check size={17} />
        </button>
        <div className="privacy-note">
          <ShieldCheck size={19} />
          <div>
            <strong>Saved on this device, with optional account saving.</strong>
            <p>
              Changes save locally. When you sign in and link your records,
              account saving keeps a private copy updated. Check its status in
              You before switching devices.
            </p>
          </div>
        </div>
        <div className="delete-area">
          {resetting ? (
            <>
              <span>This clears your edits and captures.</span>
              <button className="text-button" type="button" onClick={onReset}>
                Clear my records
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
              Start fresh
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default function OnboardedApp() {
  return (
    <Onboarding>{(replay) => <App onReplayOnboarding={replay} />}</Onboarding>
  );
}
