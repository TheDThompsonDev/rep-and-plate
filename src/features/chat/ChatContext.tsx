import { createContext, useContext, type FormEvent, type ReactNode } from "react";
import type { ChatAction } from "../../ai-contract";
import type { AppState, Meal, Page } from "../../domain";

/** Everything ChatLayer reads from the shell. The same 47 names it used to take
 * as props (audit Q2); App builds this object once per render in `ChatProvider`
 * and ChatLayer's body is unchanged apart from where the names come from. */
export type ChatContextValue = {
  dailyExperience?: ReactNode;
  captureInboxEntry?: ReactNode;
  onDecide?: () => void;
  onCoaching?: () => void;
  firstTrackingStep?: ReactNode;
  replayIntro: boolean;
  onReplayIntro: (replay: boolean) => void;
  onCorrectMeal: (messageId: string) => void;
  captureDay: string | null;
  onClearCaptureDay: () => void;
  onActivityCapture: (messageId: string, accept: boolean) => void;
  onSpotSettings: (patch: Partial<NonNullable<AppState["spot"]>>) => void;
  onWorkoutCapture: (messageId: string, accept: boolean) => void;
  reviewMessageId?: string | null;
  onReviewFocused?: () => void;
  state: AppState;
  composer: string;
  processing: boolean;
  aiAvailable: boolean;
  connectionChecking: boolean;
  chatAccess?: 'signin' | 'setup' | 'restricted';
  onChatAccount: (mode?: 'signin' | 'signup') => void;
  onReconnect: () => void;
  onAccount: () => void;
  aiStage: string;
  onStop: () => void;
  onRetry: (messageId: string) => void;
  onGroceries: (receiptId: string) => void;
  onAddReceipt: () => void;
  onReceiptDinner: (receiptId: string) => void;
  onReceiptSpending: () => void;
  onScan: () => void;
  onPlan: () => void;
  onPreferences: () => void;
  onRecipes: () => void;
  onAction: (action: ChatAction) => void;
  onManualMeal: () => void;
  onRecipePortion: (messageId: string, accept: boolean) => void;
  onAddMeal: (messageId: string) => void;
  onComposerChange: (value: string) => void;
  onSend: (event?: FormEvent, preset?: string) => void;
  onCamera: () => void;
  onAttach: () => void;
  onVoice: () => void;
  onProfile: () => void;
  onNavigate: (page: Page) => void;
  onEditMeal: (meal: Meal) => void;
  onPantryLinks: (mealId: string) => void;
  onPreferenceProposal: (messageId: string, accept: boolean) => void;
  onSetReps: (exercise: number, set: number, reps: number | null) => void;
  onResolve: (id: string, answer: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ value, children }: { value: ChatContextValue; children: ReactNode }) {
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error("ChatLayer must render inside ChatProvider.");
  return value;
}
