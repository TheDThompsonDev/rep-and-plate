import { SpotAvatar, SpotCheck, SpotProcessing, SpotResult, SpotWelcome, SpotWorkoutCheck, PlateMark } from './features/spot/Spot';
import { isComeback, messageSpot } from './features/spot/model';
import PreferenceProposalCard from "./features/preferences/PreferenceProposalCard";
import { defaultPreferences } from "./features/preferences/contracts";
import type { ChatAction } from "./ai-contract";
import RecipePortionProposalCard from "./features/recipes/RecipePortionProposalCard";
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
  ScanBarcode,
} from "lucide-react";
import { Modal } from "./components";
import { FuelHeader, FuelTabs } from "./FuelNavigation";
import { AIText, Sources, GroceryCard, ProposedMeal } from "./AICards";
import { sumNutrition, isExampleMeal, type AppState, type Meal, type Page } from "./domain";
import "./chat.css";


type Props = {
  replayIntro: boolean;
  onReplayIntro: (replay: boolean) => void;
  onDiscardMeal: (messageId: string) => void;
  onSpotSettings: (patch: Partial<NonNullable<AppState['spot']>>) => void;
  onWorkoutCapture: (messageId: string, accept: boolean) => void;
  reviewMessageId?: string | null;
  onReviewFocused?: () => void;
  state: AppState;
  composer: string;
  processing: boolean;
  aiAvailable: boolean;
  aiStage: string;
  onRetry: (messageId: string) => void;
  onGroceries: (receiptId: string) => void;
  onScan: () => void;
  onPlan: () => void;
  onPreferences: () => void;
  onRecipes: () => void;
  onAction: (action: ChatAction) => void;
  onRecipePortion: (messageId:string,accept:boolean)=>void;
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
  onSample: () => void;
  onSetReps: (exercise: number, set: number, reps: number | null) => void;
  onResolve: (id: string, answer: string) => void;
};

export default function ChatLayer({
  replayIntro,
  onReplayIntro: setReplayIntro,
  onDiscardMeal,
  onSpotSettings,
  onWorkoutCapture,
  reviewMessageId,
  onReviewFocused,
  state,
  composer,
  processing,
  aiAvailable,
  aiStage,
  onRetry,
  onGroceries,
  onScan,
  onPlan,
  onPreferences,
  onRecipes,
  onAction,
  onRecipePortion,
  onAddMeal,
  onComposerChange,
  onSend,
  onCamera,
  onAttach,
  onVoice,
  onProfile,
  onNavigate,
  onEditMeal,
  onPantryLinks,
  onPreferenceProposal,
  onSample,
  onSetReps,
  onResolve,
}: Props) {
  const [comeback, setComeback] = useState(() => {
    try { return isComeback(localStorage.getItem('rep-and-plate.spot.last-visit') ?? state.spot?.lastVisit); }
    catch { return isComeback(state.spot?.lastVisit); }
  });
  useEffect(() => {
    const visit = () => { try { localStorage.setItem('rep-and-plate.spot.last-visit', new Date().toISOString()); } catch { /* Capture works without visit metadata. */ } };
    visit();
    window.addEventListener('pagehide',visit);
    return () => {visit();window.removeEventListener('pagehide',visit);};
  }, []);
  const [catchup, setCatchup] = useState(false);
  const intro = replayIntro;
  const latestSpot = messageSpot(state.messages.filter(m => m.role === 'assistant').at(-1));
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
    if (intro) {
      lastCount.current = state.messages.length;
      threadRef.current?.scrollTo({ top: 0 });
      return;
    }
    if (reviewMessageId) {
      lastCount.current = state.messages.length;
      return;
    }
    // Open at the start of the reference conversation; follow new captures as they arrive.
    if (state.messages.length === lastCount.current && !processing) return;
    lastCount.current = state.messages.length;
    const frame = requestAnimationFrame(() => {
      const el = threadRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [state.messages.length, processing, reviewMessageId, intro]);

  useEffect(() => {
    if (!reviewMessageId) return;
    const frame = requestAnimationFrame(() => {
      const thread = threadRef.current;
      const target = thread && Array.from(thread.querySelectorAll<HTMLElement>("[data-message-id]"))
        .find(element => element.dataset.messageId === reviewMessageId);
      if (thread && target) {
        thread.scrollTop += target.getBoundingClientRect().top - thread.getBoundingClientRect().top - 16;
        target.focus({ preventScroll: true });
      }
      onReviewFocused?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [reviewMessageId, onReviewFocused]);

  function sendFromMenu(message: string) {
    setMenuOpen(false);
    onSend(undefined, message);
  }
  return (
    <section className="fuel-chat" aria-label="Rep & Plate chat home">
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
      <div className="spot-context"><PlateMark/><strong>Tell Spot.</strong><span>Your food. Your reps. Your pace.</span></div>
      <div
        className="fuel-conversation"
        ref={threadRef}
        role="log"
        aria-label="Capture conversation"
        aria-live="polite"
      >
        <SpotWelcome key={intro ? 'intro' : 'welcome'} intro={intro} comeback={comeback} onDone={() => {setReplayIntro(false);setComeback(false);onSpotSettings({introSeen:true});}}
          onCapture={() => inputRef.current?.focus()} onCatchup={() => {setCatchup(true);inputRef.current?.focus();}}/>
        {catchup && <div className="spot-catchup"><strong>Catch me up.</strong> Send one moment at a time, with its date if it wasn’t today. A photo, screenshot or a few words is enough. We’ll check uncertain details before saving.<button className="spot-text-button" onClick={()=>setCatchup(false)}>Got it</button></div>}
        <div className="fuel-date">Your conversation</div>
        {state.messages.filter(m => m.id !== "welcome").map((message, index) => {
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
              data-message-id={message.id}
              tabIndex={-1}
              className={`fuel-message ${message.role} ${grouped ? "grouped" : ""} ${meal ? "with-meal" : ""} ${isInsight ? "with-insight" : ""}`}
            >
              {message.role === "assistant" && (
                <span
                  className={`fuel-assistant-avatar ${isInsight ? "insight-avatar" : ""} ${grouped ? "avatar-hidden" : ""}`}
                >
                  {isInsight ? (
                    <BarChart3 size={23} strokeWidth={3} />
                  ) : (
                    <SpotAvatar {...messageSpot(message)} size={38} />
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
                {message.spotCheck && <SpotCheck><p>I need one detail.</p></SpotCheck>}
                {message.workoutProposal && <SpotWorkoutCheck proposal={message.workoutProposal} status={message.workoutCaptureStatus ?? 'pending'} onResolve={accept=>onWorkoutCapture(message.id,accept)} onFix={()=>{onWorkoutCapture(message.id,false);onComposerChange('Correction to my workout: ');inputRef.current?.focus();}}/>}
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
                {message.preferenceProposal && <PreferenceProposalCard proposal={message.preferenceProposal} status={message.preferenceStatus ?? "pending"} current={state.preferences ?? defaultPreferences()} onAccept={()=>onPreferenceProposal(message.id,true)} onDismiss={()=>onPreferenceProposal(message.id,false)}/>}
                {message.recipePortionProposal && <RecipePortionProposalCard proposal={message.recipePortionProposal} batch={state.recipeBatches?.find(batch=>batch.id===message.recipePortionProposal?.batchId)} status={message.recipePortionProposalStatus??"pending"} onAccept={()=>onRecipePortion(message.id,true)} onDismiss={()=>onRecipePortion(message.id,false)}/>}
                {message.suggestedAction && <button className="fuel-pantry-link-action" onClick={()=>onAction(message.suggestedAction!)}>{{pantry:"Open your pantry",recipes:"Open recipes & leftovers","meal-plan":"Open meal planner",preferences:"Review your preferences",workout:"Build a workout",shopping:"Open swaps, list & spending"}[message.suggestedAction]}<ChevronRight size={15}/></button>}
                {message.mealProposal && !meal && (
                  <ProposedMeal
                    meal={message.mealProposal}
                    onAdd={() => onAddMeal(message.id)}
                    onFix={() => {onDiscardMeal(message.id);onComposerChange(`Correction to ${message.mealProposal!.title}: `);inputRef.current?.focus();}}
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
                {meal && !isExampleMeal(meal) && <SpotResult>{meal.calories} cal · {meal.protein}g protein</SpotResult>}
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
                          <PlateMark />
                        </span>
                      )}
                      <span className="fuel-meal-details">
                        <strong>
                          {!isExampleMeal(meal) && meal.category === "Dinner"
                            ? "Dinner added"
                            : meal.title}
                        </strong>
                        <span className="fuel-meal-description">
                          {isExampleMeal(meal) ? "Sample capture" : meal.category === "Dinner"
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
                            {isExampleMeal(meal) ? <Info size={12} /> : <Check size={12} strokeWidth={3} />}
                          </span>
                          {isExampleMeal(meal) ? "Example · not counted" : `Added to ${meal.category}`}
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
                {meal && !isExampleMeal(meal) && !meal.recipeBatchId && (state.groceries?.length ?? 0) > 0 && <button className="fuel-pantry-link-action" onClick={()=>onPantryLinks(meal.id)}>{meal.components?.some(component=>component.lotId) ? "Review pantry links" : "Which pantry ingredients did you use?"}<ChevronRight size={15}/></button>}
                {meal?.recipeBatchId && <button className="fuel-pantry-link-action" onClick={onRecipes}>Review recipe portions<ChevronRight size={15}/></button>}
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
        {processing && <SpotProcessing side={latestSpot.side} detail={aiStage}/>}

      </div>
      <div className="fuel-compose-wrap">
        <form className="fuel-composer" onSubmit={onSend}>
          <button
            type="button"
            className="fuel-icon fuel-composer-scan"
            aria-label="Scan a barcode in chat"
            onClick={onScan}
          >
            <ScanBarcode size={24} strokeWidth={1.9}/>
          </button>
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
            aria-label="Message Rep & Plate"
            placeholder="What happened?"
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
      <FuelTabs active="Chat" onNavigate={onNavigate} onScan={onScan} onCapture={() => inputRef.current?.focus()} />
      {menuOpen && (
        <Modal title="Your space" onClose={() => setMenuOpen(false)}>
          <div className="fuel-menu">
            <label className="spot-settings"><input type="checkbox" checked={state.spot?.visuals !== false} onChange={e=>onSpotSettings({visuals:e.target.checked})}/>Show Spot illustrations</label>
            <button onClick={()=>{setReplayIntro(true);setComeback(false);setMenuOpen(false);threadRef.current?.scrollTo({top:0});}}>Meet Spot</button>
            <button onClick={() => {setMenuOpen(false);onPlan();}}><PlateMark/><span>Plan my week</span><ChevronRight size={17}/></button>
            <button onClick={() => {setMenuOpen(false);onRecipes();}}><PlateMark/><span>Recipes & leftovers</span><ChevronRight size={17}/></button>
            <button onClick={() => {setMenuOpen(false);onPreferences();}}><Info size={21}/><span>Food & routine preferences</span><ChevronRight size={17}/></button>
            <button onClick={() => {setMenuOpen(false);onScan();}}>
              <ScanBarcode size={21}/><span>Scan a barcode</span><ChevronRight size={17}/>
            </button>
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
                ? "AI connected · Image reading & web research"
                : "Local demo · AI unavailable"}
              <br />
              Saved records stay on this device.
            </p>
          </div>
        </Modal>
      )}
      {aboutOpen && (
        <Modal title="A preview of Rep & Plate" onClose={() => setAboutOpen(false)}>
          <div className="fuel-about">
            <p>
              {aiAvailable
                ? "Chat and images are processed by our configured AI provider, QwenCloud or OpenAI. Nutrition research can search the web, and TypeSafe JEV checks the type of capture. Uploaded images and the relevant conversation are sent for processing. Voice transcription uses OpenAI."
                : "AI is not connected. Sample flows and local tracking still work."}
            </p>
            <p>
              Save groceries from a receipt, ask for meal ideas, or estimate a
              meal or drink. Nutrition estimates are editable. Voice recordings can be transcribed and reviewed before sending. Device connections aren’t connected yet. The
              sample captures are excluded from your daily totals.
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
