import Onboarding from "./features/onboarding/Onboarding";
import DailyExperience from "./features/daily/DailyExperience";
import { dailyPreferences, toggleUsualMeal } from "./features/daily/model";
import { CaptureInbox } from "./features/capture-inbox/CaptureInbox";
import { appendCapture, newCapture } from "./features/capture-inbox/model";
import type { CaptureItem } from "./features/capture-inbox/contracts";
import { recordLocalEvent } from "./features/life-context/model";
import { trackMealTransition } from "./features/life-context/tracking";
import { releaseHouseholdPortion } from "./features/household/client";
import { addHouseholdTransfer } from "./features/household/domain";
import { remainingRecipePortions } from "./features/recipes/portions";
import type { HouseholdMealProposal, HouseholdTransfer } from "./features/household/contracts";
import { HeaderAccountContext } from './features/cloud/header-account';
import { QuickAccount } from './features/cloud/QuickAccount';
import { FirstLog } from './features/onboarding/FirstLog';
import { hasFirstLog } from './features/onboarding/first-log';
import { persistBrowserRecords } from "./platform/browser-records";
import { useBrowserRecords } from "./platform/useBrowserRecords";
import { saveBodyWeight } from "./features/progress/body-weight";
import { resolveActivityProposal } from "./activities";
import type { RecipeDraft } from "./features/recipes/RecipeDialog";
import { SpotVisuals } from "./features/spot/Spot";
import { resolveWorkoutCapture } from "./features/spot/model";
import { apiFetch } from "./api-fetch";
import { useAIRequest } from "./features/chat/useAIRequest";
import { RECORD_BOUND_DIALOGS, useDialogs } from "./features/chat/dialogs";
import { useAccountSession } from "./features/chat/useAccountSession";
import MealEditor from "./features/meals/MealEditor";
import { useMealEditor } from "./features/meals/useMealEditor";
import { chatGuidance, isChatHelp } from "./chat-guidance";
import { dinnerPrompt, receiptPrompt, saveReceiptCapture, upgradeSavedReceiptCaptures } from './features/receipts/journey';
import { resolveAgentMeal } from "./features/connections/context";
import { cloudEpoch } from "./features/cloud/sync-control";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
const PantryLinkReview = lazy(
  () => import("./features/pantry/PantryLinkReview"),
);
const RecipeDialog = lazy(() => import("./features/recipes/RecipeDialog"));
const DecisionsDialog = lazy(() => import("./features/decisions/DecisionsDialog"));
const CoachingDialog = lazy(() => import("./features/coaching/CoachingDialog"));
const LifeContextPanel = lazy(() => import("./features/life-context/LifeContextPanel").then(module => ({ default: module.LifeContextPanel })));
const HouseholdDialog = lazy(() => import("./features/household/HouseholdDialog"));
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
import { applyFitnessSetup } from './features/progress/fitness-goal';
import { applyNutritionSetup } from './features/progress/nutrition-setup';
import { weightCheckIn } from './features/progress/fitness-goal';
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
import { getPantryLots, mealFromPantry, deleteMealWithPantry } from "./features/pantry/ledger";
import { mealPortionSelections } from "./features/planning/meal-plans";
import { resolveRecipePortionProposal } from "./features/recipes/proposals";
import { productSchema, type FoodProduct } from "./features/products/contracts";
import {
  captureProduct,
  savePrivateProduct,
} from "./features/products/actions";
import ChatLayer from "./ChatLayer";
import { ChatProvider } from "./features/chat/ChatContext";
import NutritionPage from "./NutritionPage";
import WorkoutPage from "./WorkoutPage";
import YouPage from "./YouPage";
import KitchenPage from "./KitchenPage";
const ShoppingDialog = lazy(() => import("./features/shopping/ShoppingDialog"));
import {
  addProposedMeal,
  resolvePreferenceProposal,
  retainComposerDraft,
  PROCESSING_DRAFT_NOTICE,
} from "./ai-client";
import { type ChatAction, type CapturePurpose } from "./ai-contract";
import { startPlan, replyToWorkout, recordSet } from "./workouts";
import {
  ArrowRight,
  Camera,
  Check,
  ImagePlus,
  Inbox,
  ShieldCheck,
  X,
} from "lucide-react";
import { Modal } from "./components";
import {
  clockTime,
  id,
  timestamp,
  interpretText,
  resolveReview,
  repeatMeal,
  mealSchema,
  sumNutrition,
  today,
  upgradeChat,
  type AppState,
  type Page,
} from "./domain";
import { useLocalDay } from "./useLocalDay";

/** Hash routes. The legacy `#today` dashboard has no page and lands on Chat. */
const pages = ["Chat", "Nutrition", "Workouts", "Kitchen", "Review", "You"] as const satisfies readonly Page[];

function App({ onReplayOnboarding, firstLog, dismissFirstLog }: { onReplayOnboarding: () => void; firstLog: string | null; dismissFirstLog: () => void }) {
  useLocalDay();
  const [toast, setToast] = useState("");
  const [state, setState, stateForSync] = useBrowserRecords(() =>
    setToast(
      "Device saving could not finish. Export your records before closing the app.",
    ),
  );
  const visitId = useRef(id());
  useEffect(() => {
    const at = new Date().toISOString();
    setState(current => recordLocalEvent(current, { id: visitId.current + ":" + String(cloudEpoch()), kind: "visit", at, source: "web" }));
  }, [state.lifeContext?.research.enabled, setState]);
  const { dialogs, openDialog, closeDialog, closeDialogs } = useDialogs();
  const [page, setPage] = useState<Page>(() =>
    location.hash === '#receipt' ? 'Kitchen' : location.hash === "#connections"
      ? "You"
      : (pages.find((n) => n.toLowerCase() === location.hash.slice(1)) ?? "Chat"),
  );
  const [firstMovement, setFirstMovement] = useState(false);
  const tracked = hasFirstLog(state);
  useEffect(() => { if (firstLog && tracked) dismissFirstLog(); }, [firstLog, tracked, dismissFirstLog]);
  const [captureDay, setCaptureDay] = useState<string | null>(null);
  const [scannerProduct, setScannerProduct] = useState<
    FoodProduct | undefined
  >();
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft>();
  const [resumeRecipe, setResumeRecipe] = useState(false);
  const [recordRevision, setRecordRevision] = useState(0);
  const resumeReceiptCapture = useRef(false);
  const [receiptCapture, setReceiptCapture] = useState(() => location.hash === '#receipt');
  const [captureError, setCaptureError] = useState("");
  const [upload, setUpload] = useState<{ name: string; image: string; meal?: boolean } | null>(
    null,
  );
  /** A photo from the chat meal camera is food the user is logging, not a receipt or screenshot. */
  const mealPhoto = !receiptCapture && !!upload?.meal;
  const [composer, setComposer] = useState("");
  const [reviewMessageId, setReviewMessageId] = useState<string | null>(null);
  const [captureContext, setCaptureContext] = useState("");
  const [capturePurpose, setCapturePurpose] = useState<CapturePurpose | undefined>();
  const [decisionCapturePrompt, setDecisionCapturePrompt] = useState("");
  const [shoppingTab, setShoppingTab] = useState<"swaps" | "list" | "spending">(
    "swaps",
  );
  const [cloudForReceipt, setCloudForReceipt] = useState(false);
  const [connectionsStarted, setConnectionsStarted] = useState(
    () => location.hash === "#connections",
  );
  const [replaySpotIntro, setReplaySpotIntro] = useState(false);
  const groceriesOpen = dialogs.pantry?.receiptId ?? null;
  const labelGTIN = dialogs.label?.gtin ?? null;
  const linkMealId = dialogs.pantryLinks?.mealId ?? null;
  const meals = useMealEditor({
    state,
    setState,
    notify,
    captureDay,
    onPantryLinks: (mealId) => openDialog({ kind: 'pantryLinks', mealId }),
  });
  const { editMeal, setEditMeal, manualMeal, correctProposal, close: closeMealEditor } = meals;
  const {
    aiStatus,
    processing,
    aiStage,
    isBusy,
    sendAI,
    stopResponse,
    cancelPendingAI,
    retry,
    reconnect,
    showLocalProcessing,
  } = useAIRequest({ state, setState, captureDay, notify, onAccountRequired: requireChatAccount });
  // Stable so the owner-change subscription below runs once (its other
  // dependencies are useState setters, refs and the stable dialog and
  // meal-editor actions).
  const clearCaptureDrafts = useCallback((keepComposer = false) => {
    setRecordRevision((current) => current + 1);
    closeDialogs(RECORD_BOUND_DIALOGS);
    setReviewMessageId(null);
    if (!keepComposer || !resumeReceiptCapture.current) {
      resumeReceiptCapture.current = false;
      setCloudForReceipt(false);
      closeDialog('capture');
      setReceiptCapture(false);
      setCaptureContext('');
      setCapturePurpose(undefined);
      setUpload(null);
    }
    setCaptureError("");
    setRecipeDraft(undefined);
    setResumeRecipe(false);
    setCaptureDay(null);
    setScannerProduct(undefined);
    closeMealEditor();
    if (!keepComposer) setComposer("");
  }, [closeDialog, closeDialogs, closeMealEditor]);
  const {
    chatAccountMode,
    profileAccountMode,
    openChatAccount,
    openProfileAccount,
    dismissCloud,
    restoreRecords,
    resetRecords,
  } = useAccountSession({ setState, cancelPendingAI, clearCaptureDrafts, reconnect, openDialog, closeDialog });
  /** Hoisted bridge so the AI hook above can ask for an account without a declaration cycle. */
  function requireChatAccount() {
    openChatAccount();
  }
  const openReceipt = useCallback(() => {
    setReceiptCapture(true);
    setCapturePurpose(undefined);
    setCaptureContext('');
    setCaptureError('');
    setUpload(null);
    openDialog('capture');
  }, [openDialog]);
  function receiptAccount() {
    resumeReceiptCapture.current = true;
    setCloudForReceipt(true);
    closeDialog('capture');
    openChatAccount();
  }
  function returnToReceipt() {
    if (resumeReceiptCapture.current) {
      resumeReceiptCapture.current = false;
      setCloudForReceipt(false);
      openDialog('capture');
    }
  }
  function chooseReceiptDinner(receiptId: string) {
    const receipt = state.groceries?.find(r => r.id === receiptId);
    if (!receipt) return;
    askFromGroceries(dinnerPrompt(receipt));
  }
  function askFromGroceries(text: string) {
    navigate('Chat');
    setComposer(text);
    if (isBusy()) {
      notify('Spot is finishing the current response. Your dinner request stays in the composer to send next.');
      return;
    }
    if (aiStatus?.available) { setComposer(''); void sendAI(text); }
    else if (aiStatus?.access === 'signin' || aiStatus?.access === 'setup') openChatAccount();
    else notify('Your dinner request is ready. Reconnect to send it; no meal or pantry amounts have changed.');
  }
  const scanAction = useRef(crypto.randomUUID());
  function openScanner() {
    scanAction.current = crypto.randomUUID();
    setScannerProduct(undefined);
    openDialog('scanner');
  }
  function addScannedProduct(
    product: FoodProduct,
    action: "grocery" | "meal",
    servings: number,
  ) {
    const actionId = scanAction.current;
    setState((s) => captureProduct(s, product, action, servings, actionId));
    closeDialog('scanner');
    navigate("Chat");
  }
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // The receipt flow shares the camera input, so each click says which capture it starts.
  const mealCamera = useRef(false);

  useEffect(() => {
    setState(s => upgradeSavedReceiptCaptures(upgradeChat(s)));
    // The Today dashboard was removed; old bookmarks land on Chat.
    if (location.hash === "#today") history.replaceState(null, "", "#chat");
  }, [setState]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const onHash = () => {
      if (location.hash === '#receipt') {
        setPage('Kitchen');
        openReceipt();
        return;
      }
      if (location.hash === "#connections") {
        setPage("You");
        setConnectionsStarted(true);
        openDialog('connections');
        return;
      }
      setPage(
        pages.find((n) => n.toLowerCase() === location.hash.slice(1))
          ?? "Chat",
      );
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [openDialog, openReceipt]);

  function navigate(next: Page) {
    setFirstMovement(false);
    setPage(next);
    location.hash = next.toLowerCase();
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function notify(message: string) {
    setToast(message);
  }
  function openChatAction(action: ChatAction) {
    switch (action) {
      case "pantry":
        openDialog({ kind: 'pantry', receiptId: '*' });
        break;
      case "recipes":
        openDialog('recipes');
        break;
      case "meal-plan":
        openDialog('planner');
        break;
      case "preferences":
        openDialog('preferences');
        break;
      case "workout":
        openDialog('workoutBuilder');
        break;
      case "shopping":
        setShoppingTab("swaps");
        openDialog('shopping');
        break;
    }
  }
  function focusChatCapture() {
    navigate("Chat");
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".fuel-composer input")?.focus());
  }
  function submitText(e?: FormEvent, preset?: string) {
    e?.preventDefault();
    const text = (preset ?? composer).trim();
    if (!text) return;
    if (processing) {
      // Never drop a preset or voice transcript: keep it as the draft (same pattern as askFromGroceries).
      setComposer((current) => retainComposerDraft(current, text));
      notify(PROCESSING_DRAFT_NOTICE);
      return;
    }
    if (aiStatus?.access === 'signin' || aiStatus?.access === 'setup') {
      setComposer(text);
      openChatAccount();
      return;
    }
    if (aiStatus?.access === 'restricted') {
      notify('Chat access is not enabled for this account yet. Open Your account or contact support.');
      return;
    }
    if (isChatHelp(text)) {
      setComposer("");
      setState((s) => ({
        ...s,
        messages: [
          ...s.messages,
          { id: id(), role: "user", text, time: clockTime(), at: timestamp() },
          {
            id: id(),
            role: "assistant",
            text: chatGuidance(aiStatus?.available === true),
            time: clockTime(),
            at: timestamp(),
          },
        ],
      }));
      return;
    }
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
      openDialog('shopping');
      return;
    }
    if (
      /^(?:my |open )?(?:recipes|leftovers|recipes (?:and|&) leftovers)[?!.]*$/i.test(
        text,
      )
    ) {
      setComposer("");
      openDialog('recipes');
      return;
    }
    if (/^(?:my |open )?(?:pantry|groceries)[?!.]*$/i.test(text)) {
      setComposer("");
      openDialog({ kind: 'pantry', receiptId: '*' });
      return;
    }
    if (/^(scan(?: a barcode)?|barcode)$/i.test(text)) {
      setComposer("");
      openScanner();
      return;
    }
    if (/^(?:plan (?:my |a )?week|weekly meal plan|meal plan)$/i.test(text)) {
      setComposer("");
      openDialog('planner');
      return;
    }
    if (/^(?:my preferences|food preferences)$/i.test(text)) {
      setComposer("");
      openDialog('preferences');
      return;
    }
    if (/^(?:create|build|generate) (?:my |a )?workout$/i.test(text)) {
      setComposer("");
      openDialog('workoutBuilder');
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
          { id: id(), role: "user" as const, text, time: clockTime(), at: timestamp() },
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
              at: timestamp(),
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
              at: timestamp(),
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
              at: timestamp(),
            },
          ],
        };
      }
      if (
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
        response =
          "I can’t answer freely while connected chat is unavailable. Your message is kept here, but nothing was logged or added to review. Open Your account to check sign-in, then retry the connection and send your message again. You can also use Nutrition → Enter meal manually, Workouts, or ask “What should I say?” for local shortcuts.";
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
            at: timestamp(),
            mealId,
          },
        ],
      };
    });
    showLocalProcessing();
  }
  async function onFile(file?: File, meal = false) {
    if (!file) return;
    const captureEpoch = cloudEpoch();
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
      if (captureEpoch !== cloudEpoch()) return;
      if (!dialogs.capture && !capturePurpose) setCaptureContext("");
      setUpload({ name: file.name, image, meal });
      openDialog('capture');
    } catch {
      reportError("That image couldn’t be opened. Please try another.");
    }
  }
  async function saveUploadForReview() {
    if (!upload) return;
    if (capturePurpose) {
      try {
        const item = { ...newCapture({ text: decisionCapturePrompt || captureContext || "Help me review this photo.", image: upload.image, purpose: capturePurpose === "menu" ? "menu" : "meal" }), capturePurpose };
        await saveCaptureInbox(appendCapture(stateForSync.current.captureInbox ?? [], item));
        closeDialog("capture"); setUpload(null); setCapturePurpose(undefined); setDecisionCapturePrompt(""); navigate("Chat"); notify("Photo saved in Send to Spot for later.");
      } catch (error) { notify(error instanceof Error ? error.message : "This capture could not be saved."); }
      return;
    }
    setState((s) => receiptCapture ? saveReceiptCapture(s, upload.image, upload.name, captureContext) : ({
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
          at: timestamp(),
        },
        {
          id: id(),
          role: "assistant",
          text: "Your image is saved for review without guessing nutrition. Ask “What needs review?” to see it here.",
          time: clockTime(),
          at: timestamp(),
        },
      ],
    }));
    closeDialog('capture');
    setUpload(null);
    setReceiptCapture(false);
    navigate("Chat");
    notify("Image saved. You can review it here in chat.");
  }
  function setReps(exIndex: number, setIndex: number, reps: number | null) {
    if (reps !== null) {
      setState((s) => ({
        ...s,
        workout: recordSet(
          s.workout,
          exIndex,
          setIndex,
          reps,
          undefined,
          s.profile.workoutUnit ?? "lb",
        ),
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
  async function saveCaptureInbox(items: CaptureItem[]) {
    const epoch = cloudEpoch();
    setState(current => ({ ...current, captureInbox: items }));
    await persistBrowserRecords(stateForSync.current);
    if (epoch !== cloudEpoch()) throw Error("Your account changed. Open your inbox again.");
  }
  async function sendSavedCapture(item: CaptureItem) {
    const epoch = cloudEpoch();
    let image = item.image;
    if (image && !image.startsWith("data:image/")) throw Error("This photo has not finished restoring. Reopen account saving and try again.");
    if (image && image.length > 4400000) {
      const original = new Image(); original.src = image; await original.decode();
      const scale = Math.min(1, 1800 / Math.max(original.width, original.height));
      const canvas = document.createElement("canvas"); canvas.width = Math.round(original.width * scale); canvas.height = Math.round(original.height * scale);
      const context = canvas.getContext("2d"); if (!context) throw Error("This photo could not be prepared.");
      context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(original, 0, 0, canvas.width, canvas.height);
      image = canvas.toDataURL("image/jpeg", 0.78);
      if (image.length > 4400000) throw Error("Crop this photo before sending it. Your original remains in your inbox.");
    }
    if (epoch !== cloudEpoch()) return "blocked" as const;
    const text = item.text || (item.purpose === "meal" ? "Estimate the food I ate in this photo." : item.purpose === "menu" ? "Help me choose from this menu. I have not eaten it." : "Help me understand this saved capture. Ask what it is for if unclear; do not assume it is food I ate.");
    const prompt = item.purpose === "receipt" ? receiptPrompt(text) : text;
    navigate("Chat");
    return sendAI(prompt, image, undefined, item.purpose === "meal" ? "meal" : undefined, item.capturePurpose ?? (item.purpose === "menu" ? "menu" : undefined), item.id);
  }
  async function askDecision(text: string, purpose: CapturePurpose) {
    try {
      const item = { ...newCapture({ text, purpose: purpose === "menu" ? "menu" : "general" }), capturePurpose: purpose };
      await saveCaptureInbox(appendCapture(stateForSync.current.captureInbox ?? [], item));
      navigate("Chat");
      const result = await sendSavedCapture(item);
      if (result === "complete") await saveCaptureInbox((stateForSync.current.captureInbox ?? []).filter(capture => capture.id !== item.id));
      else notify("Your request is saved in Send to Spot. Send it when your account and connection are ready.");
    } catch (error) { notify(error instanceof Error ? error.message : "Your request could not be saved. Please try again."); }
  }
  function startDecisionCapture(text: string, purpose: CapturePurpose) {
    setReceiptCapture(false); setCapturePurpose(purpose); setDecisionCapturePrompt(text); setCaptureContext(""); setUpload(null); openDialog("capture");
  }
  function repeatSavedMeal(mealId: string) {
    try {
      closeMealEditor();
      setEditMeal(repeatMeal(stateForSync.current, mealId).meals.at(-1)!);
    } catch (error) { notify(error instanceof Error ? error.message : "This meal could not be repeated."); }
  }
  function saveHouseholdTransfer(transfer: HouseholdTransfer) {
    setState(current => ({ ...current, recipeBatches: (current.recipeBatches ?? []).map(batch => batch.id === transfer.sourceBatchId ? addHouseholdTransfer(batch, transfer.householdBatchId, transfer.portions) : batch) }));
  }
  async function logHouseholdMeal(proposal: HouseholdMealProposal) {
    const before = stateForSync.current, epoch = cloudEpoch();
    if (before.meals.some(meal => meal.householdReservationId === proposal.householdReservationId)) return true;
    const meal = mealSchema.parse({ id: proposal.householdReservationId, title: proposal.title, category: "Dinner", day: today(), time: clockTime(), source: "Shared household meal", confidence: "estimated", note: proposal.portions + " portions from the household batch. Nutrition uses the shared preparation snapshot.", ...proposal.nutrition, householdReservationId: proposal.householdReservationId, householdBatchId: proposal.householdBatchId });
    const next = trackMealTransition(before, { ...before, meals: [...before.meals, meal] }, meal.id, "web");
    await persistBrowserRecords(next);
    if (epoch !== cloudEpoch()) return false;
    if (stateForSync.current !== before) { await persistBrowserRecords(stateForSync.current); throw Error("Your records changed during this review. Review the portion again."); }
    setState(next); notify("Your portion is logged privately."); return true;
  }
  async function removeHouseholdMeal() {
    const before = stateForSync.current, epoch = cloudEpoch();
    if (!editMeal?.householdReservationId) return;
    const reservation = editMeal.householdReservationId;
    const next = deleteMealWithPantry(before, editMeal.id);
    await persistBrowserRecords(next);
    if (epoch !== cloudEpoch() || stateForSync.current !== before) { await persistBrowserRecords(stateForSync.current); throw Error("Your records changed. Review the meal again."); }
    setState(next); closeMealEditor();
    try { await releaseHouseholdPortion(reservation); notify("Meal removed and portions returned to the household."); }
    catch { notify("Meal removed privately. Open Household meals to return its reserved portion when connected."); }
  }
  function voice() {
    openDialog('voice');
  }

  return (
    <HeaderAccountContext.Provider value={() => openDialog('headerAccount')}>
    <SpotVisuals value={state.spot?.visuals !== false}>
      <div
        className="app-shell chat-home"
      >
        <a className="skip-link" href="#main">
          Skip to content
        </a>
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
                restoreRecords(value);
              }}
            />
          </Suspense>
          {state.profile.fitnessGoal && page !== 'You' && weightCheckIn(state.bodyWeights ?? [], state.profile.fitnessGoal, today()).due && <div className="quick-account" role="status"><p>{weightCheckIn(state.bodyWeights ?? [], state.profile.fitnessGoal, today()).text}</p><button onClick={() => navigate('You')}>Log your weight</button></div>}
          <main
            id="main"
            className="main-content chat-main"
          >
            {page !== 'Chat' && firstLog && !tracked && <FirstLog focus={firstLog} onMeal={focusChatCapture} onMovement={() => { navigate('Workouts'); setFirstMovement(true); }} onLater={dismissFirstLog} />}

            {page === "Nutrition" && (
              <NutritionPage
                key={recordRevision}
                onManualMeal={manualMeal}
                onCaptureMeal={(day) => {
                  setCaptureDay(day);
                  navigate("Chat");
                }}
                onScan={openScanner}
                onEditGoals={() => openDialog('profile')}
                onOpenPantry={() => openDialog({ kind: 'pantry', receiptId: '*' })}
                onOpenPlan={() => openDialog('planner')}
                onOpenRecipes={() => openDialog('recipes')}
                onAsk={(text) => {
                  navigate('Chat');
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
              <ChatProvider
                value={{
                  dailyExperience: tracked ? <DailyExperience state={state} onChange={setState} onRepeatMeal={repeatSavedMeal} onResumeWorkout={() => navigate("Workouts")} onDecide={() => openDialog("decisions")} onReview={() => navigate("You")} onCapture={focusChatCapture} /> : undefined,
                  captureInboxEntry: <CaptureInbox key={recordRevision} items={state.captureInbox ?? []} scopeKey={String(recordRevision)} onChange={saveCaptureInbox} onSend={sendSavedCapture} disabled={processing} />,
                  onDecide: () => openDialog("decisions"),
                  onCoaching: () => openDialog("coaching"),
                  firstTrackingStep: firstLog && !tracked ? <FirstLog focus={firstLog} onMeal={focusChatCapture} onMovement={() => { navigate('Workouts'); setFirstMovement(true); }} onLater={dismissFirstLog} /> : undefined,
                  replayIntro: replaySpotIntro,
                  onReplayIntro: (replay) =>
                    replay ? onReplayOnboarding() : setReplaySpotIntro(false),
                  onCorrectMeal: correctProposal,
                  captureDay: captureDay,
                  onClearCaptureDay: () => setCaptureDay(null),
                  onActivityCapture: (messageId, accept) => {
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
                  },
                  onSpotSettings: (patch) =>
                    setState((s) => ({ ...s, spot: { ...s.spot, ...patch } })),
                  onWorkoutCapture: (messageId, accept) => {
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
                  },
                  reviewMessageId: reviewMessageId,
                  onReviewFocused: () => setReviewMessageId(null),
                  onPantryLinks: (mealId) => openDialog({ kind: 'pantryLinks', mealId }),
                  onPreferenceProposal: (messageId, accept) => {
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
                  },
                  state: state,
                  composer: composer,
                  processing: processing,
                  aiAvailable: aiStatus?.available ?? false,
                  connectionChecking: aiStatus === null,
                  chatAccess: aiStatus?.access,
                  onChatAccount: openChatAccount,
                  onReconnect: reconnect,
                  onAccount: () => openDialog('cloud'),
                  aiStage: aiStage,
                  onStop: stopResponse,
                  onRetry: retry,
                  onGroceries: (receiptId) => openDialog({ kind: 'pantry', receiptId }),
                  onAddReceipt: openReceipt,
                  onReceiptDinner: chooseReceiptDinner,
                  onReceiptSpending: () => { setShoppingTab('spending'); openDialog('shopping'); },
                  onScan: openScanner,
                  onPlan: () => openDialog('planner'),
                  onPreferences: () => openDialog('preferences'),
                  onRecipes: () => openDialog('recipes'),
                  onAction: openChatAction,
                  onManualMeal: () => manualMeal(captureDay ?? today()),
                  onRecipePortion: (messageId, accept) => {
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
                  },
                  onAddMeal: (messageId) =>
                    setState((s) => trackMealTransition(s, addProposedMeal(s, messageId), messageId, "web")),
                  onComposerChange: setComposer,
                  onSend: submitText,
                  onCamera: () => {
                    if (aiStatus?.access === 'signin' || aiStatus?.access === 'setup') { openChatAccount(); return; }
                    setReceiptCapture(false);
                    setCapturePurpose(undefined);
                    mealCamera.current = true;
                    cameraRef.current?.click();
                  },
                  onAttach: () => {
                    if (aiStatus?.access === 'signin' || aiStatus?.access === 'setup') { openChatAccount(); return; }
                    setReceiptCapture(false);
                    setCapturePurpose(undefined);
                    fileRef.current?.click();
                  },
                  onVoice: () => {
                    if (aiStatus?.access === 'signin' || aiStatus?.access === 'setup') { openChatAccount(); return; }
                    voice();
                  },
                  onProfile: () => navigate("You"),
                  onNavigate: navigate,
                  onEditMeal: setEditMeal,
                  onSetReps: (exercise, set, reps) => {
                    setReps(exercise, set, reps);
                  },
                  onResolve: (reviewId, answer) => {
                    setState((s) => resolveReview(s, reviewId, answer));
                    notify("Updated. One less thing to think about.");
                  },
                }}
              >
                <ChatLayer />
              </ChatProvider>
            )}

            {page === "Kitchen" && (
              <KitchenPage
                onDecide={() => openDialog("decisions")}
                onHousehold={() => openDialog("household")}
                state={state}
                onNavigate={navigate}
                onScan={openScanner}
                onTargets={() => openDialog('profile')}
                onAddReceipt={openReceipt}
                onShopping={() => {
                  setShoppingTab("swaps");
                  openDialog('shopping');
                }}
                onPreferences={() => openDialog('preferences')}
                onPantry={() => openDialog({ kind: 'pantry', receiptId: '*' })}
                onReceipt={(receiptId) => openDialog({ kind: 'pantry', receiptId })}
                onPlan={() => openDialog('planner')}
                onRecipes={() => openDialog('recipes')}
                onAsk={askFromGroceries}
              />
            )}

            {page === "Workouts" && (
              <WorkoutPage
                key={`${recordRevision}-${firstMovement}`}
                startWithMovement={firstMovement && !!firstLog && !tracked}
                onFirstMovementClose={() => setFirstMovement(false)}
                onScan={openScanner}
                state={state}
                setState={setState}
                onNavigate={navigate}
                onProfile={() => navigate("You")}
                onVoice={voice}
                onBuild={() => openDialog('workoutBuilder')}
                onSaveFitness={draft => { setState(current => applyFitnessSetup(current, draft, today(), id())); }}
              />
            )}

            {(page === "You" || page === "Review") && (
              <YouPage
                key={recordRevision}
                onLifeContext={() => openDialog("lifeContext")}
                onCoaching={() => openDialog("coaching")}
                onRepeatMeal={repeatSavedMeal}
                onSaveBodyWeight={(entry) =>
                  setState((s) => ({
                    ...s,
                    bodyWeights: saveBodyWeight(s.bodyWeights ?? [], entry),
                  }))
                }
                onScan={openScanner}
                onRecipes={() => openDialog('recipes')}
                onReviewMessage={(messageId) => {
                  setReviewMessageId(messageId);
                  navigate("Chat");
                }}
                onAccount={openProfileAccount}
                onSaveFitness={draft => { const next = applyFitnessSetup(state, draft, today(), id()); setState(next); }}
                onSaveNutrition={result => { const next = applyNutritionSetup(state, result); setState(next); }}
                onConnections={() => {
                  setConnectionsStarted(true);
                  openDialog('connections');
                }}
                onMeetSpot={() => {
                  onReplayOnboarding();
                }}
                state={state}
                aiAvailable={aiStatus?.available ?? false}
                onGroceries={(receiptId) => openDialog({ kind: 'pantry', receiptId: receiptId ?? '*' })}
                onPreferences={() => openDialog('preferences')}
                onPlan={() => openDialog('planner')}
                onNavigate={navigate}
                onEditProfile={() => openDialog('profile')}
                onEditMeal={setEditMeal}
                onResolve={(reviewId, answer) => {
                  setState((s) => resolveReview(s, reviewId, answer));
                  notify("Updated. One less thing to think about.");
                }}
                onAddMeal={meals.addFromReview}
              />
            )}
          </main>
        </div>
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
            void onFile(e.target.files?.[0], mealCamera.current);
            mealCamera.current = false;
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
        {dialogs.capture && (
          <Modal
            title={
              receiptCapture
                ? upload
                  ? "Your receipt, ready to read."
                  : "Add a grocery receipt"
                : upload
                  ? mealPhoto
                    ? "Your meal, ready to estimate."
                    : "A moment, captured."
                  : "Show me what happened."
            }
            onClose={() => {
              closeDialog('capture');
              setUpload(null);
              setReceiptCapture(false);
              setCapturePurpose(undefined);
              setDecisionCapturePrompt("");
            }}
          >
            <div className="capture-modal">
              {receiptCapture && <div className="receipt-capture-benefit"><strong>Give this grocery trip a dinner plan.</strong><p>Save what you bought, check the products and amounts, then choose dinner from your groceries and see what else you need.</p><small>Purchases never count as food eaten. You review uncertain details.</small></div>}
              {receiptCapture && !aiStatus?.available && <div className="receipt-access" role="status">
                <p>{aiStatus === null ? 'Checking receipt reading…' : aiStatus.access === 'signin' ? 'Sign in to read your receipt and get meal ideas.' : aiStatus.access === 'setup' ? 'Finish account setup to read your receipt.' : aiStatus.access === 'restricted' ? 'Receipt reading is not enabled for this account during private preview.' : 'AI is unavailable. Save your photo now and read this receipt when connected.'}</p>
                {aiStatus?.access === 'signin' || aiStatus?.access === 'setup' ? <button className="button primary full-width" onClick={receiptAccount}>{aiStatus.access === 'setup' ? 'Finish setup for receipts' : 'Sign in to read receipts'}</button> : aiStatus && <button className="button secondary full-width" onClick={() => { if (aiStatus.access === 'restricted') receiptAccount(); else reconnect(); }}>{aiStatus.access === 'restricted' ? 'Check receipt access' : 'Retry receipt connection'}</button>}
              </div>}
              {captureError && <p role="alert">{captureError}</p>}
              {upload ? (
                <>
                  <img
                    className="upload-preview"
                    src={upload.image}
                    alt={
                      receiptCapture
                        ? "Your grocery receipt"
                        : mealPhoto
                          ? "Your meal photo"
                          : "Your uploaded capture"
                    }
                  />
                  <p>
                    {aiStatus?.available
                      ? receiptCapture
                        ? "Check that the store, items, and prices are readable. We’ll identify your groceries and research their nutrition, keeping purchases separate from meals you ate."
                        : capturePurpose === "menu"
                          ? "Spot will help you compare choices from this menu. Choosing food does not log a meal."
                          : mealPhoto
                          ? "Spot will estimate the foods and portions it can see. You review the estimate before anything is added to your day."
                          : "Send a meal photo, grocery receipt, or order screenshot. Rep & Plate will read it and look for useful nutrition sources."
                      : receiptCapture ? 'Save the photo for later, or use the receipt access option above. Saving a photo does not extract groceries.' : "AI is unavailable. You can still save this image for review."}
                  </p>
                      <label className="fuel-capture-context">
                        Anything to add? (optional)
                        <textarea
                          maxLength={4000}
                          value={captureContext}
                          onChange={(e) => setCaptureContext(e.target.value)}
                          placeholder={receiptCapture ? 'e.g. Two packs of chicken, one is already used' : mealPhoto ? 'e.g. Cooked in olive oil, I ate about half the rice' : 'e.g. My grocery receipt, or what I had for lunch'}
                        />
                      </label>
                  {aiStatus?.available && (
                    <>
                      <button
                        className="button primary full-width"
                        disabled={processing}
                        onClick={() => {
                          const image = upload.image;
                          const text = receiptCapture
                            ? receiptPrompt(captureContext)
                            : decisionCapturePrompt ? decisionCapturePrompt + (captureContext.trim() ? " Additional context: " + captureContext.trim() : "") : captureContext.trim() ||
                              (mealPhoto
                                ? "Estimate this meal from my photo."
                                : "Please help me understand this photo or receipt. If these are groceries I purchased, research their nutrition and save the grocery list separately from meals I ate.");
                          const intent = mealPhoto ? "meal" : undefined;
                          closeDialog('capture');
                          setUpload(null);
                          setReceiptCapture(false);
                          navigate("Chat");
                          void sendAI(text, image, undefined, intent, capturePurpose);
                          setCapturePurpose(undefined);
                          setDecisionCapturePrompt("");
                        }}
                      >
                        {receiptCapture ? 'Read my receipt' : capturePurpose === 'menu' ? 'Help me choose' : mealPhoto ? 'Estimate this meal' : 'Send to Rep & Plate'} <ArrowRight size={17} />
                      </button>
                    </>
                  )}
                  <p className="section-note">
                    Reading sends the image to our AI provider for image reading
                    and web research; extracted details may be checked by TypeSafe.
                    Records save on this device. With account saving enabled,
                    a private account copy of records and photos is saved too.
                  </p>
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
                      onClick={() => {
                        mealCamera.current = false;
                        cameraRef.current?.click();
                      }}
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
            </div>
          </Modal>
        )}
        <Suspense fallback={null}>
          {dialogs.coaching && <CoachingDialog key={recordRevision} records={state} onClose={() => closeDialog("coaching")} />}
          {dialogs.decisions && <DecisionsDialog state={state} onClose={() => closeDialog("decisions")} onAsk={(text, purpose) => { void askDecision(text, purpose); }} onCapture={startDecisionCapture} />}
          {dialogs.lifeContext && <Modal title="Life right now" onClose={() => closeDialog("lifeContext")}><LifeContextPanel state={state} onChange={setState} /></Modal>}
          {dialogs.household && <HouseholdDialog candidates={(state.recipeBatches ?? []).filter(batch => remainingRecipePortions(batch) > 0).map(batch => ({ id: batch.id, title: batch.name, remainingPortions: remainingRecipePortions(batch), perPortion: { calories: batch.nutrition.calories / batch.totalPortions, protein: batch.nutrition.protein / batch.totalPortions, carbs: batch.nutrition.carbs / batch.totalPortions, fat: batch.nutrition.fat / batch.totalPortions } }))} loggedReservationIds={state.meals.flatMap(meal => meal.householdReservationId ? [meal.householdReservationId] : [])} onClose={() => closeDialog("household")} onPublished={saveHouseholdTransfer} onLogMeal={logHouseholdMeal} />}
          {connectionsStarted && (
            <ConnectionsHub
              state={state}
              open={!!dialogs.connections}
              onAccount={() => openProfileAccount('signin')}
              onClose={() => {
                closeDialog('connections');
                if (location.hash === "#connections") navigate("You");
              }}
              onApply={async (action, status) => {
                const before = stateForSync.current,
                  epoch = cloudEpoch();
                const next = resolveAgentMeal(before, action, status);
                await persistBrowserRecords(next);
                if (epoch !== cloudEpoch())
                  throw Error(
                    "Your account changed. Reopen Connections to check your review.",
                  );
                if (stateForSync.current !== before) {
                  await persistBrowserRecords(stateForSync.current);
                  throw Error(
                    "Your records changed during this review. Please review the proposal again.",
                  );
                }
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
              onClose={() => closeDialog('pantryLinks')}
            />
          )}
          {dialogs.cloud && (
            <CloudAccount
              state={state}
              initialMode={chatAccountMode ?? profileAccountMode}
              forChat={chatAccountMode !== null}
              forReceipt={cloudForReceipt}
              onChatReady={() => {
                dismissCloud('ready');
                returnToReceipt();
                notify('Account setup complete. Your draft is ready to send once chat connects.');
              }}
              onClose={() => {
                dismissCloud('closed');
                returnToReceipt();
              }}
              onRestore={(restored) => {
                restoreRecords(restored);
                notify("Cloud records loaded onto this device.");
              }}
            />
          )}
          {dialogs.voice && (
            <VoiceCapture
              onClose={() => closeDialog('voice')}
              onSend={(text) => {
                closeDialog('voice');
                if (page === "Workouts" && state.workout.status === "active")
                  setState((s) => ({
                    ...s,
                    workout: replyToWorkout(
                      s.workout,
                      text,
                      s.profile.workoutUnit ?? "lb",
                    ),
                  }));
                else submitText(undefined, text);
              }}
            />
          )}
          {dialogs.shopping && (
            <ShoppingDialog
              initialTab={shoppingTab}
              state={state}
              onChange={setState}
              onClose={() => closeDialog('shopping')}
              onPreferences={() => {
                closeDialog('shopping');
                openDialog('preferences');
              }}
              onPantry={() => {
                closeDialog('shopping');
                openDialog({ kind: 'pantry', receiptId: '*' });
              }}
            />
          )}
          {dialogs.preferences && (
            <PreferencesDialog
              value={state.preferences}
              onClose={() => closeDialog('preferences')}
              onSave={(preferences) => {
                setState((s) => ({ ...s, preferences }));
                closeDialog('preferences');
                notify("Your preferences are saved.");
              }}
            />
          )}
          {dialogs.planner && (
            <MealPlanner
              receipts={state.groceries ?? []}
              lots={getPantryLots(state).slice(0, 100)}
              preferences={state.preferences ?? defaultPreferences()}
              goals={state.profile}
              goalsConfigured={state.profile.targetsConfigured === true}
              value={state.mealPlans?.at(-1)}
              plans={state.mealPlans}
              loggedMealIds={state.meals.map((meal) => meal.id)}
              onClose={() => closeDialog('planner')}
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
                closeDialog('planner');
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
          {dialogs.workoutBuilder && (
            <WorkoutBuilder
              state={state}
              onClose={() => closeDialog('workoutBuilder')}
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
                closeDialog('workoutBuilder');
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
                closeDialog('pantry');
                if (resumeRecipe) {
                  setResumeRecipe(false);
                  openDialog('recipes');
                }
              }}
              onAsk={askFromGroceries}
            />
          )}
          {dialogs.recipes && (
            <RecipeDialog
              state={state}
              onChange={setState}
              draft={recipeDraft}
              onDraftChange={setRecipeDraft}
              onOpenPantry={() => {
                setResumeRecipe(true);
                closeDialog('recipes');
                openDialog({ kind: 'pantry', receiptId: '*' });
              }}
              onClose={() => closeDialog('recipes')}
            />
          )}
          {dialogs.scanner && (
            <ProductScanner
              initialProduct={scannerProduct}
              initialBarcode={scannerProduct?.gtin}
              onClose={() => closeDialog('scanner')}
              onProduct={addScannedProduct}
              lookupOverride={(gtin) =>
                (state.products ?? []).find((p) => p.gtin === gtin)
              }
              onLabel={(gtin) => {
                closeDialog('scanner');
                openDialog({ kind: 'label', gtin });
              }}
            />
          )}
          {labelGTIN && (
            <LabelCapture
              gtin={labelGTIN}
              onClose={() => closeDialog('label')}
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
                closeDialog('label');
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
            meal={editMeal}
            isProposal={meals.isProposal}
            newManual={meals.newManual}
            repeatDraft={meals.repeatDraft}
            onRepeat={meals.repeat}
            isUsual={dailyPreferences(state).usualMealIds.includes(editMeal.id)}
            onToggleUsual={state.meals.some(meal => meal.id === editMeal.id) && !meals.isProposal ? () => { try { setState(current => toggleUsualMeal(current, editMeal.id)); } catch (error) { notify(error instanceof Error ? error.message : "Could not save this usual."); } } : undefined}
            onPantryLinks={meals.pantryLinks}
            onClose={meals.close}
            onSave={meals.save}
            onDelete={editMeal.householdReservationId ? () => { void removeHouseholdMeal().catch(error => notify(error instanceof Error ? error.message : "Could not remove this meal.")); } : meals.remove}
          />
        )}
        {dialogs.headerAccount && (
          <Modal title="Your account" onClose={() => closeDialog('headerAccount')}>
            <QuickAccount
              onSignIn={() => { closeDialog('headerAccount'); openProfileAccount('signin'); }}
              onCreateAccount={() => { closeDialog('headerAccount'); openProfileAccount('signup'); }}
            />
            <div className="header-account-links">
              <button className="button secondary" onClick={() => { closeDialog('headerAccount'); navigate('You'); }}>View your profile</button>
              {/* Connections was only on the profile page, below the weight card, where its own owner could not find it. */}
              <button className="button secondary" onClick={() => { closeDialog('headerAccount'); setConnectionsStarted(true); openDialog('connections'); }}>Connect an assistant</button>
              <button className="button secondary" onClick={() => { closeDialog('headerAccount'); openProfileAccount('signin'); }}>Account settings & backups</button>
            </div>
          </Modal>
        )}
        {dialogs.profile && (
          <ProfileEditor
            profile={state.profile}
            onClose={() => closeDialog('profile')}
            onSave={(profile) => {
              setState((s) => ({ ...s, profile }));
              closeDialog('profile');
              notify("Your preferences are saved.");
            }}
            onReset={() => {
              resetRecords();
              closeDialog('profile');
              navigate("Chat");
              notify("Fresh start. Your food log is empty.");
            }}
          />
        )}
      </div>
    </SpotVisuals>
    </HeaderAccountContext.Provider>
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
    <Onboarding>{(replay, firstLog, dismissFirstLog) => <App onReplayOnboarding={replay} firstLog={firstLog} dismissFirstLog={dismissFirstLog} />}</Onboarding>
  );
}
