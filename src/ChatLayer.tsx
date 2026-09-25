import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUp,
  BarChart3,
  Camera,
  Check,
  CheckCheck,
  ChevronRight,
  Dumbbell,
  Image,
  Inbox,
  Info,
  Mic,
} from "lucide-react";
import { Modal } from "./components";
import { FuelHeader, FuelTabs } from "./FuelNavigation";
import { AIText, Sources, GroceryCard, ProposedMeal } from "./AICards";
import { sumNutrition, type AppState, type Meal, type Page } from "./domain";
import "./chat.css";

export function FuelLeaf({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="26"
      height="28"
      viewBox="0 0 32 34"
      fill="none"
      aria-hidden="true"
    >
      <path d="M14 25C4 25 3 15 5 7c8 2 14 6 14 13l-5 5Z" fill="#66AA91" />
      <path d="M11 27C7 15 17 5 30 3c1 13-4 25-15 24h-4Z" fill="#246F5B" />
      <path
        d="M8 32 24 12"
        stroke="#104C41"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  state: AppState;
  composer: string;
  processing: boolean;
  aiAvailable: boolean;
  aiStage: string;
  onRetry: (messageId: string) => void;
  onGroceries: (receiptId: string) => void;
  onAddMeal: (messageId: string) => void;
  onComposerChange: (value: string) => void;
  onSend: (event?: FormEvent, preset?: string) => void;
  onCamera: () => void;
  onAttach: () => void;
  onVoice: () => void;
  onProfile: () => void;
  onNavigate: (page: Page) => void;
  onEditMeal: (meal: Meal) => void;
  onSample: () => void;
  onSetReps: (exercise: number, set: number, reps: number | null) => void;
  onResolve: (id: string, answer: string) => void;
};

export default function ChatLayer({
  state,
  composer,
  processing,
  aiAvailable,
  aiStage,
  onRetry,
  onGroceries,
  onAddMeal,
  onComposerChange,
  onSend,
  onCamera,
  onAttach,
  onVoice,
  onProfile,
  onNavigate,
  onEditMeal,
  onSample,
  onSetReps,
  onResolve,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCount = useRef(
    state.messages.some((message) => message.ai) ? 0 : state.messages.length,
  );
  const totals = sumNutrition(state.meals);
  const pending = state.reviews.filter((item) => !item.resolved);
  useEffect(() => {
    // Open at the start of the reference conversation; follow new captures as they arrive.
    if (state.messages.length === lastCount.current && !processing) return;
    lastCount.current = state.messages.length;
    const frame = requestAnimationFrame(() => {
      const el = threadRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [state.messages.length, processing]);

  function sendFromMenu(message: string) {
    setMenuOpen(false);
    onSend(undefined, message);
  }
  return (
    <section className="fuel-chat" aria-label="Fuel chat home">
      <FuelHeader
        isHome
        onHome={() => {
          onNavigate("Chat");
          threadRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onMenu={() => setMenuOpen(true)}
        onNutrition={() => onSend(undefined, "How am I doing today?")}
        onProfile={onProfile}
      />
      <div className="fuel-banner">
        <FuelLeaf />
        <div>
          <strong>
            {aiAvailable
              ? "Just send what happened. I’ll track it."
              : "Show me what you ate. I’ll figure it out."}
          </strong>
          <span>
            {aiAvailable
              ? "Meals, groceries, workouts. I’ve got you."
              : "A photo, a quick question, and you’re set."}
          </span>
        </div>
      </div>
      <div
        className="fuel-conversation"
        ref={threadRef}
        role="log"
        aria-label="Capture conversation"
        aria-live="polite"
      >
        <div className="fuel-date">Today</div>
        {state.messages.map((message, index) => {
          if (
            processing &&
            !message.ai &&
            message.role === "assistant" &&
            index === state.messages.length - 1
          )
            return null;
          const meal = state.meals.find((m) => m.id === message.mealId);
          const receipt = (state.groceries ?? []).find(
            (g) => g.id === message.receiptId,
          );
          const isInsight =
            message.kind === "insight" || message.kind === "summary";
          const previous = state.messages[index - 1];
          const grouped =
            previous?.role === "assistant" &&
            message.role === "assistant" &&
            previous.kind !== "insight" &&
            !isInsight &&
            !previous.mealId;
          return (
            <div
              key={message.id}
              className={`fuel-message ${message.role} ${grouped ? "grouped" : ""} ${meal ? "with-meal" : ""} ${isInsight ? "with-insight" : ""}`}
            >
              {message.role === "assistant" && (
                <span
                  className={`fuel-assistant-avatar ${isInsight ? "insight-avatar" : ""} ${grouped ? "avatar-hidden" : ""}`}
                >
                  {isInsight ? (
                    <BarChart3 size={23} strokeWidth={3} />
                  ) : (
                    <FuelLeaf />
                  )}
                </span>
              )}
              <div className="fuel-message-content">
                {message.image && (
                  <img
                    className="fuel-message-photo"
                    src={message.image}
                    alt={
                      message.id === "demo-dinner-photo"
                        ? "Grilled chicken, rice, and broccoli dinner"
                        : "Your captured photo or screenshot"
                    }
                  />
                )}
                {message.text && (
                  <div className="fuel-bubble">
                    {message.ai && message.role === "assistant" ? (
                      <AIText text={message.text} sources={message.sources} />
                    ) : (
                      <p>{message.text}</p>
                    )}
                    <span className="fuel-time">
                      {message.time}
                      {message.role === "user" && (
                        <CheckCheck size={15} strokeWidth={2} />
                      )}
                    </span>
                  </div>
                )}
                {message.ai && message.role === "assistant" && (
                  <Sources sources={message.sources ?? []} />
                )}
                {receipt && (
                  <GroceryCard
                    receipt={receipt}
                    onOpen={() => onGroceries(receipt.id)}
                  />
                )}
                {message.mealProposal && !meal && (
                  <ProposedMeal
                    meal={message.mealProposal}
                    onAdd={() => onAddMeal(message.id)}
                  />
                )}
                {message.warnings?.map((warning, i) => (
                  <p key={i} className="fuel-ai-warning">
                    {warning}
                  </p>
                ))}
                {message.aiStatus === "error" ||
                (message.aiStatus === "pending" && !processing) ? (
                  <div className="fuel-ai-error" role="alert">
                    {message.aiError ??
                      "This response was interrupted. Your capture is saved."}
                    <button
                      disabled={processing}
                      onClick={() => onRetry(message.id)}
                    >
                      Retry this capture
                    </button>
                  </div>
                ) : null}
                {meal && (
                  <button
                    className="fuel-meal-card"
                    aria-label={`Edit ${meal.title}`}
                    onClick={() => onEditMeal(meal)}
                  >
                    <span className="fuel-meal-main">
                      {meal.image ? (
                        <img src={meal.image} alt="" />
                      ) : (
                        <span className="fuel-meal-placeholder">
                          <FuelLeaf />
                        </span>
                      )}
                      <span className="fuel-meal-details">
                        <strong>
                          {meal.category === "Dinner"
                            ? "Dinner added"
                            : meal.title}
                        </strong>
                        <span className="fuel-meal-description">
                          {meal.category === "Dinner"
                            ? meal.title
                            : meal.category === "Lunch"
                              ? "Lunch · estimated portions"
                              : "Saved to your day"}
                        </span>
                        <b>
                          {meal.confidence === "estimated" ? "~" : ""}
                          {meal.calories} cal · {meal.protein}g protein
                        </b>
                        <span className="fuel-meal-saved">
                          <span>
                            <Check size={12} strokeWidth={3} />
                          </span>
                          Added to {meal.category}
                        </span>
                      </span>
                    </span>
                    <span className="fuel-card-time">{message.time}</span>
                    {meal.category === "Dinner" && (
                      <span className="fuel-confidence">
                        <Info size={18} fill="currentColor" />
                        <span>
                          {meal.source.startsWith("AI") ? (
                            meal.note
                          ) : (
                            <>
                              High confidence on chicken and broccoli.
                              <br />
                              Lower confidence on sauce quantity.
                            </>
                          )}
                        </span>
                      </span>
                    )}
                  </button>
                )}
                {message.kind === "summary" && (
                  <div className="fuel-inline-summary">
                    <span>
                      <b>{totals.calories.toLocaleString()}</b> /{" "}
                      {state.profile.calories.toLocaleString()} cal
                    </span>
                    <span>
                      <b>{totals.protein}g</b> / {state.profile.protein}g
                      protein
                    </span>
                    <div className="fuel-inline-track">
                      <i
                        style={{
                          width: `${Math.min(100, (totals.calories / state.profile.calories) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                {message.kind === "workout" && (
                  <div className="fuel-inline-workout">
                    <strong>{state.workout.exercises[0].name}</strong>
                    <span>
                      {state.workout.exercises[0].weight} lb ·{" "}
                      {state.workout.exercises[0].sets.length} ×{" "}
                      {state.workout.exercises[0].target}
                    </span>
                    {state.workout.exercises[0].sets.map((reps, n) => (
                      <div className="fuel-chat-set" key={n}>
                        <span>Set {n + 1}</span>
                        {reps !== null ? (
                          <button
                            onClick={() => onSetReps(0, n, null)}
                            aria-label={`Edit ${state.workout.exercises[0].name === "Bench Press" ? "bench" : state.workout.exercises[0].name} set ${n + 1}`}
                          >
                            {reps} reps <Check size={14} />
                          </button>
                        ) : (
                          <span className="fuel-chat-reps">
                            {[-2, -1, 0, 1]
                              .map((delta) =>
                                Math.max(
                                  1,
                                  state.workout.exercises[0].target + delta,
                                ),
                              )
                              .map((value) => (
                                <button
                                  key={value}
                                  aria-label={`${state.workout.exercises[0].name === "Bench Press" ? "Bench" : state.workout.exercises[0].name} set ${n + 1}: ${value} reps`}
                                  onClick={() => onSetReps(0, n, value)}
                                >
                                  {value}
                                </button>
                              ))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {message.kind === "review" && (
                  <div className="fuel-inline-review">
                    {pending.length ? (
                      pending.map((item) => (
                        <div key={item.id}>
                          <strong>{item.question}</strong>
                          <span>
                            {item.options.map((option) => (
                              <button
                                key={option}
                                onClick={() => onResolve(item.id, option)}
                              >
                                {option}
                              </button>
                            ))}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span>
                        <CheckCheck size={18} />
                        Everything is taken care of.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {processing && (
          <div className="fuel-typing" role="status">
            <span className="fuel-assistant-avatar">
              <FuelLeaf />
            </span>
            <span>
              <i />
              <i />
              <i />
            </span>
            <span className="sr-only">Fuel is responding</span>
            {aiStage && <small className="fuel-ai-status">{aiStage}</small>}
          </div>
        )}
      </div>
      <div className="fuel-compose-wrap">
        <form className="fuel-composer" onSubmit={onSend}>
          <button
            type="button"
            className="fuel-icon"
            aria-label="Take a meal photo"
            onClick={onCamera}
          >
            <Camera size={25} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            className="fuel-icon"
            aria-label="Attach image or screenshot"
            onClick={onAttach}
          >
            <Image size={24} strokeWidth={1.9} />
          </button>
          <input
            ref={inputRef}
            aria-label="Message Fuel"
            placeholder="Send a photo, screenshot, or message…"
            maxLength={2000}
            value={composer}
            onChange={(event) => onComposerChange(event.target.value)}
          />
          {composer.trim() ? (
            <button
              className="fuel-send"
              aria-label="Send message"
              type="submit"
              disabled={processing}
            >
              <ArrowUp size={23} />
            </button>
          ) : (
            <button
              className="fuel-send"
              aria-label="Use voice"
              type="button"
              onClick={onVoice}
            >
              <Mic size={25} strokeWidth={1.8} />
            </button>
          )}
        </form>
      </div>
      <FuelTabs active="Chat" onNavigate={onNavigate} onProfile={onProfile} />
      {menuOpen && (
        <Modal title="Your Fuel" onClose={() => setMenuOpen(false)}>
          <div className="fuel-menu">
            <button onClick={() => sendFromMenu("How am I doing today?")}>
              <BarChart3 size={21} />
              <span>Today’s nutrition</span>
              <ChevronRight size={17} />
            </button>
            <button onClick={() => sendFromMenu("Start my workout")}>
              <Dumbbell size={21} />
              <span>Track a workout here</span>
              <ChevronRight size={17} />
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                onGroceries("*");
              }}
            >
              <Inbox size={21} />
              <span>Your groceries</span>
              <ChevronRight size={17} />
            </button>
            <button onClick={() => sendFromMenu("What needs review?")}>
              <Inbox size={21} />
              <span>Review captures</span>
              <small>{pending.length}</small>
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                onSample();
              }}
            >
              <Camera size={21} />
              <span>Try a sample capture</span>
              <ChevronRight size={17} />
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                setAboutOpen(true);
              }}
            >
              <Info size={21} />
              <span>About this prototype</span>
              <ChevronRight size={17} />
            </button>
            <p>
              {aiAvailable
                ? "AI connected · OpenAI & web research"
                : "Local demo · AI unavailable"}
              <br />
              Saved records stay on this device.
            </p>
          </div>
        </Modal>
      )}
      {aboutOpen && (
        <Modal title="A preview of Fuel" onClose={() => setAboutOpen(false)}>
          <div className="fuel-about">
            <p>
              {aiAvailable
                ? "Chat and image understanding use OpenAI. Nutrition research can search the web, and TypeSafe JEV checks the type of capture. Uploaded images and the relevant conversation are sent for processing."
                : "AI is not connected. Sample flows and local tracking still work."}
            </p>
            <p>
              Save groceries from a receipt, ask for meal ideas, or estimate a
              meal or drink. Nutrition estimates are editable. Voice
              transcription and device connections aren’t connected yet. The
              opening conversation is a sample.
            </p>
            <button onClick={() => setAboutOpen(false)}>
              <Check size={17} />
              Got it
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
