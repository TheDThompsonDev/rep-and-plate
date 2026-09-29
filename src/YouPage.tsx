import { SpotWeeklyReview } from './features/spot/Spot';
import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Dumbbell,
  Inbox,
  Info,
  MessageCircle,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Utensils,
  UserRound,
  ShoppingBasket,
  BarChart3,
  ChefHat,
} from "lucide-react";
import { FuelHeader, FuelTabs } from "./FuelNavigation";
import { PlateMark } from "./features/spot/Spot";
import { MealRow, Modal } from "./components";
import {
  personalMeals,
  type AppState,
  type Meal,
  type Page,
  type ReviewItem,
} from "./domain";
import "./you.css";
import "./refined-tabs.css";
import { weeklyReview } from "./features/reviews/weekly-review";
import { getPantryLots } from "./features/pantry/ledger";
import { remainingRecipePortions } from "./features/recipes/portions";
import { sumProposalComponents } from "./features/meals/proposals";

type Props = {
  state: AppState;
  aiAvailable: boolean;
  onAccount: () => void;
  onScan: () => void;
  onGroceries: (receiptId?: string) => void;
  onPreferences: () => void;
  onPlan: () => void;
  onRecipes: () => void;
  onReviewMessage: (messageId: string) => void;
  onNavigate: (page: Page) => void;
  onEditProfile: () => void;
  onEditMeal: (meal: Meal) => void;
  onResolve: (id: string, answer: string) => void;
  onAddMeal: (item: ReviewItem) => void;
};
type Panel =
  | "menu"
  | "completed"
  | "meals"
  | "workouts"
  | "privacy"
  | "about"
  | "weekly"
  | null;

export default function YouPage({
  state,
  aiAvailable,
  onAccount,
  onScan,
  onGroceries,
  onPreferences,
  onPlan,
  onRecipes,
  onReviewMessage,
  onNavigate,
  onEditProfile,
  onEditMeal,
  onResolve,
  onAddMeal,
}: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [showAll, setShowAll] = useState(false);
  const reviewRef = useRef<HTMLElement>(null);
  const pending = state.reviews.filter((r) => !r.resolved);
  const resolved = state.reviews.filter((r) => r.resolved);
  const savedMeals = personalMeals(state.meals);
  type ConnectedReview = {
    id: string;
    title: string;
    source: string;
    description: string;
    messageId?: string;
    receiptId?: string;
    kind: "meal" | "preferences" | "recipe" | "receipt" | "workout";
    result?: string;
  };
  const chatReviews: ConnectedReview[] = [];
  const completedChatReviews: ConnectedReview[] = [];
  for (const message of state.messages) {
    if (message.workoutProposal) {
      const entry: ConnectedReview = {
        id: `${message.id}:workout`, title: message.workoutProposal.title,
        source: 'Workout from Spot', description: `${message.workoutProposal.day} · ${message.workoutProposal.exercises.length} exercises. Check the date, loads and reps.`,
        messageId: message.id, kind: 'workout',
      };
      if (message.workoutCaptureStatus === 'pending') chatReviews.push(entry);
      else completedChatReviews.push({...entry,result:message.workoutCaptureStatus === 'accepted' ? 'Workout logged' : 'Not logged'});
    }
    if (message.mealProposal && !message.mealId)
      chatReviews.push({
        id: `${message.id}:meal`,
        title: message.mealProposal.title || "Your meal estimate",
        source: "Meal from Chat",
        description: `${message.mealProposal.portion || "Estimated portion"} · ~${message.mealProposal.components ? sumProposalComponents(message.mealProposal.components).calories : message.mealProposal.calories} cal. Review the estimate before adding it to your food log.`,
        messageId: message.id,
        kind: "meal",
      });
    if (message.ai && message.mealId && !message.recipePortionProposal) {
      const meal = savedMeals.find((entry) => entry.id === message.mealId);
      if (meal)
        completedChatReviews.push({
          id: `${message.id}:meal`,
          title: meal.title,
          source: "Meal from Chat",
          description: `${meal.calories} cal · ${meal.protein}g protein`,
          messageId: message.id,
          kind: "meal",
          result: `Added to ${meal.category}`,
        });
    }
    if (message.preferenceProposal) {
      const entry: ConnectedReview = {
        id: `${message.id}:preferences`,
        title: "Your preference update",
        source: "Preferences from Chat",
        description: message.preferenceProposal.description,
        messageId: message.id,
        kind: "preferences",
      };
      if (message.preferenceStatus === "pending") chatReviews.push(entry);
      else if (
        message.preferenceStatus === "accepted" ||
        message.preferenceStatus === "dismissed"
      )
        completedChatReviews.push({
          ...entry,
          result:
            message.preferenceStatus === "accepted"
              ? "Preferences saved"
              : "Not saved",
        });
    }
    if (message.recipePortionProposal) {
      const proposal = message.recipePortionProposal;
      const batch = state.recipeBatches?.find(
        (entry) => entry.id === proposal.batchId,
      );
      const entry: ConnectedReview = {
        id: `${message.id}:recipe`,
        title: batch?.name || "Your prepared meal",
        source: "Prepared portion from Chat",
        description: `${proposal.portions} ${proposal.portions === 1 ? "portion" : "portions"} · ${proposal.category}. Check the batch and amount before logging.`,
        messageId: message.id,
        kind: "recipe",
      };
      if (message.recipePortionProposalStatus === "pending")
        chatReviews.push(entry);
      else if (
        message.recipePortionProposalStatus === "accepted" ||
        message.recipePortionProposalStatus === "dismissed"
      )
        completedChatReviews.push({
          ...entry,
          result:
            message.recipePortionProposalStatus === "accepted"
              ? "Portion accepted"
              : "Not logged",
        });
    }
  }
  const receiptReviews: ConnectedReview[] = (state.groceries || []).flatMap(
    (receipt) => {
      const count = receipt.items.filter(
        (item) =>
          item.match !== "nonfood" &&
          (item.needsReview || item.match === "unresolved"),
      ).length;
      return count
        ? [
            {
              id: `receipt:${receipt.id}`,
              title: `${receipt.store || "Grocery"} receipt`,
              source: `Groceries · ${receipt.date}`,
              description: `${count} ${count === 1 ? "item needs" : "items need"} a match or nutrition check. This receipt counts as one review.`,
              kind: "receipt" as const,
              receiptId: receipt.id,
            },
          ]
        : [];
    },
  );
  const reviews: (
    | { id: string; legacy: ReviewItem }
    | { id: string; connected: ConnectedReview }
  )[] = [...chatReviews, ...receiptReviews].map((entry) => ({
    id: entry.id,
    connected: entry,
  }));
  reviews.push(
    ...pending.map((entry) => ({ id: `legacy:${entry.id}`, legacy: entry })),
  );
  const completedCount = resolved.length + completedChatReviews.length;
  const pantryLots = getPantryLots(state).filter(
    (lot) => lot.item.availability === "available",
  );
  const availablePantry = pantryLots.filter(
    (lot) => lot.remaining !== null && lot.remaining > 0 && !lot.inconsistent,
  ).length;
  const unknownPantry = pantryLots.filter(
    (lot) => lot.remaining === null || lot.inconsistent,
  ).length;
  const availableBatches = (state.recipeBatches || []).filter(
    (batch) => remainingRecipePortions(batch) > 0,
  );
  const week = weeklyReview(state);
  const sessions = [
    ...(state.workout.history ?? []),
    ...(state.workout.startedAt
      ? [
          {
            title: state.workout.title ?? "Upper Body",
            exercises: state.workout.exercises,
            startedAt: state.workout.startedAt,
            finishedAt: state.workout.finishedAt,
          },
        ]
      : []),
  ].reverse();
  const scrollToReviews = () => {
    reviewRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
    reviewRef.current?.focus({ preventScroll: true });
  };
  const closeAndEdit = () => {
    setPanel(null);
    onEditProfile();
  };
  return (
    <section className="fuel-chat you-surface refined-surface" aria-label="You">
      <FuelHeader
        menuLabel="Open your menu"
        onHome={() => onNavigate("Chat")}
        onMenu={() => setPanel("menu")}
        onNutrition={() => onNavigate("Nutrition")}
        onProfile={() => onNavigate("You")}
        profileActive
      />
      <div className="you-scroll">
        <section className="you-personal-heading">
          <span className="you-avatar">
            {state.profile.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1>Looking ahead, {state.profile.name}.</h1>
            <p>Your goals. Your pace. Your progress.</p>
          </div>
          <button aria-label="Edit your profile" onClick={onEditProfile}>
            <Pencil size={17} />
          </button>
        </section>
        <section
          className="you-progress-hero"
          aria-label="Your recorded activity"
        >
          <div className="you-progress-heading">
            <span>Your last seven days</span>
            <button
              onClick={() => setPanel("weekly")}
              aria-label="Open your weekly review"
            >
              See week <ChevronRight size={15} />
            </button>
          </div>
          <div className="you-progress-number">
            <strong>{week.loggedDays}</strong>
            <span>of 7 days</span>
          </div>
          <p>
            {week.loggedDays
              ? "With meals you’ve logged"
              : "Your first log starts the picture"}
          </p>
          <div
            className="you-activity-days"
            aria-label="Days with recorded meals"
          >
            {Array.from({ length: 7 }, (_, index) => {
              const date = new Date(`${week.start}T12:00:00`);
              date.setDate(date.getDate() + index);
              const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              const count = week.meals.filter(
                (meal) => meal.day === key,
              ).length;
              return (
                <div
                  key={key}
                  title={`${date.toLocaleDateString()}: ${count ? `${count} meals logged` : "Not logged"}`}
                >
                  <span className={count ? "has-records" : ""}>
                    {count ? <Check size={17} /> : <span>—</span>}
                  </span>
                  <small>
                    {date.toLocaleDateString(undefined, { weekday: "short" })}
                  </small>
                </div>
              );
            })}
          </div>
          <small className="you-progress-note">
            Unlogged days are unknown, not missed goals.
          </small>
          <div className="you-progress-footer">
            <PlateMark />
            <span>
              {week.loggedDays
                ? "A record you can keep building on."
                : "A meal, a drink, a workout. Start anywhere."}
            </span>
            <button onClick={() => onNavigate("Chat")}>
              Open Chat <ArrowRight size={15} />
            </button>
          </div>
        </section>
        <div className="you-section-heading">
          <h2>Your week, taking shape.</h2>
          <button onClick={() => setPanel("weekly")}>
            See week <ChevronRight size={16} />
          </button>
        </div>
        <div className="you-activity-tiles">
          <button onClick={() => setPanel("workouts")}>
            <Dumbbell size={22} />
            <strong>{week.workouts.length}</strong>
            <span>Workouts recorded</span>
            <small>
              {week.workouts.reduce((sum, session) => sum + session.sets, 0)}{" "}
              sets logged this week
            </small>
          </button>
          <button onClick={() => setPanel("meals")}>
            <BarChart3 size={22} />
            <strong>{week.meals.length}</strong>
            <span>Meals recorded</span>
            <small>
              Across {week.loggedDays} logged{" "}
              {week.loggedDays === 1 ? "day" : "days"}
            </small>
          </button>
        </div>
        {reviews.length > 0 && (
          <button className="you-review-summary" onClick={scrollToReviews}>
            <span className="you-summary-icon">
              <Inbox size={23} />
            </span>
            <span>
              <strong>
                {reviews.length} little{" "}
                {reviews.length === 1 ? "thing" : "things"} to review
              </strong>
              <small>A quick check, then carry on.</small>
            </span>
            <ChevronRight size={20} />
          </button>
        )}
        <section
          ref={reviewRef}
          tabIndex={-1}
          className="you-reviews"
          aria-label="Your reviews"
        >
          <div className="you-section-heading">
            <h2>Your reviews</h2>
            <button onClick={() => setPanel("completed")}>
              Completed{completedCount ? ` · ${completedCount}` : ""}{" "}
              <ChevronRight size={16} />
            </button>
          </div>
          <div aria-live="polite" className="sr-only">
            {reviews.length} pending review entries
          </div>
          {reviews.length ? (
            (showAll ? reviews : reviews.slice(0, 2)).map((entry) => {
              if ("legacy" in entry)
                return (
                  <LegacyReviewCard
                    key={entry.id}
                    item={entry.legacy}
                    onResolve={onResolve}
                    onAddMeal={onAddMeal}
                  />
                );
              const item = entry.connected;
              return (
                <section
                  key={entry.id}
                  className="you-review-card you-connected-review"
                  aria-label={item.title}
                >
                  <div className="you-review-context">
                    <span className="you-review-icon">
                      {item.kind === "receipt" ? (
                        <ShoppingBasket size={23} />
                      ) : item.kind === "preferences" ? (
                        <SlidersHorizontal size={23} />
                      ) : item.kind === "recipe" ? (
                        <ChefHat size={23} />
                      ) : (
                        <Utensils size={23} />
                      )}
                    </span>
                    <div>
                      <small>{item.source}</small>
                      <h3>{item.title}</h3>
                    </div>
                  </div>
                  <p>{item.description}</p>
                  <button
                    className="you-connected-action"
                    onClick={() =>
                      item.messageId
                        ? onReviewMessage(item.messageId)
                        : onGroceries(item.receiptId)
                    }
                  >
                    {item.messageId ? "Review in Chat" : "Review receipt items"}
                    <ArrowRight size={17} />
                  </button>
                </section>
              );
            })
          ) : (
            <div className="you-empty-reviews">
              <PlateMark />
              <div>
                <strong>Nothing waiting on you.</strong>
                <p>Anything that needs a little context will appear here.</p>
              </div>
            </div>
          )}
          {reviews.length > 2 && (
            <button
              className="you-show-more"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll ? "Show fewer" : `See all ${reviews.length} reviews`}
              <ChevronRight size={16} />
            </button>
          )}
        </section>
        <div className="you-section-heading">
          <h2>Your daily goals</h2>
          <button onClick={onEditProfile}>
            Edit goals <Pencil size={14} />
          </button>
        </div>
        <section className="you-goals" aria-label="Your daily goals">
          <div className="you-goal-lead">
            <span>
              <Target size={22} />
            </span>
            <div>
              <strong>Your saved daily targets.</strong>
              <p>Adjust these as your needs change.</p>
            </div>
          </div>
          <div className="you-goal-values">
            {[
              { name: "Calories", value: state.profile.calories, unit: "cal" },
              { name: "Protein", value: state.profile.protein, unit: "g" },
              { name: "Carbs", value: state.profile.carbs, unit: "g" },
              { name: "Fats", value: state.profile.fat, unit: "g" },
            ].map((goal) => (
              <div key={goal.name}>
                <strong>
                  {goal.value.toLocaleString()}
                  <small>{goal.unit}</small>
                </strong>
                <span>{goal.name}</span>
              </div>
            ))}
          </div>
        </section>
        <button
          className="you-next-workout"
          onClick={() => onNavigate("Workouts")}
        >
          <img src="/images/gym.jpg" alt="" loading="lazy" />
          <span>
            <small>
              {state.workout.status === "active"
                ? "IN PROGRESS"
                : "MAKE TIME TO MOVE"}
            </small>
            <strong>
              {state.workout.status === "active"
                ? state.workout.title || "Your workout"
                : "Find your next workout"}
            </strong>
            <span>
              {state.workout.status === "active"
                ? "Pick up where you left off"
                : "Choose a session that works for today"}{" "}
              <ArrowRight size={16} />
            </span>
          </span>
        </button>
        <div className="you-section-heading">
          <h2>Your food & activity</h2>
        </div>
        <div className="you-row-group">
          <button className="you-row" onClick={onRecipes}>
            <span className="you-row-icon">
              <ChefHat size={23} />
            </span>
            <span>
              <strong>Recipes & leftovers</strong>
              <small>
                {availableBatches.length
                  ? `${availableBatches.length} prepared ${availableBatches.length === 1 ? "batch" : "batches"} with portions left`
                  : "Your prepared meals and portions left"}
              </small>
            </span>
            <ChevronRight size={20} />
          </button>
          <button className="you-row" onClick={onPlan}>
            <span className="you-row-icon">
              <Utensils size={22} />
            </span>
            <span>
              <strong>Your weekly meal plan</strong>
              <small>Ingredients on hand, meals ahead</small>
            </span>
            <ChevronRight size={20} />
          </button>
          <button className="you-row" onClick={onPreferences}>
            <span className="you-row-icon">
              <SlidersHorizontal size={22} />
            </span>
            <span>
              <strong>Food & routine preferences</strong>
              <small>Your choices, exclusions, and cooking time</small>
            </span>
            <ChevronRight size={20} />
          </button>
          <button className="you-row" onClick={() => onGroceries()}>
            <span className="you-row-icon">
              <ShoppingBasket size={23} />
            </span>
            <span>
              <strong>Groceries & pantry</strong>
              <small>
                {availablePantry} available{" "}
                {availablePantry === 1 ? "item" : "items"}
                {unknownPantry
                  ? ` · ${unknownPantry} ${unknownPantry === 1 ? "amount needs" : "amounts need"} a check`
                  : " · from your receipts"}
              </small>
            </span>
            <ChevronRight size={20} />
          </button>
          <button className="you-row" onClick={() => setPanel("meals")}>
            <span className="you-row-icon">
              <Utensils size={22} />
            </span>
            <span>
              <strong>Meals & captures</strong>
              <small>
                {savedMeals.length} saved{" "}
                {savedMeals.length === 1 ? "meal" : "meals"} ·{" "}
                {resolved.filter((r) => r.kind === "capture").length} reviewed
                notes
              </small>
            </span>
            <ChevronRight size={20} />
          </button>
          <button className="you-row" onClick={() => setPanel("workouts")}>
            <span className="you-row-icon blue">
              <Dumbbell size={23} />
            </span>
            <span>
              <strong>Workout history</strong>
              <small>
                {sessions.length
                  ? `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}${state.workout.status === "active" ? " · One in progress" : ""}`
                  : "Your next session starts here"}
              </small>
            </span>
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="you-section-heading">
          <h2>Make it yours</h2>
        </div>
        <div className="you-row-group">
          <button className="you-row" onClick={onEditProfile}>
            <span className="you-row-icon neutral">
              <SlidersHorizontal size={22} />
            </span>
            <span>
              <strong>Profile & preferences</strong>
              <small>Your name and daily targets</small>
            </span>
            <ChevronRight size={20} />
          </button>
          <button className="you-row" onClick={onAccount}>
            <span className="you-row-icon neutral">
              <UserRound size={23} />
            </span>
            <span>
              <strong>Account & backups</strong>
              <small>Sign in, export, or save a cloud copy</small>
            </span>
            <ChevronRight size={20} />
          </button>
          <button className="you-row" onClick={() => setPanel("privacy")}>
            <span className="you-row-icon neutral">
              <ShieldCheck size={23} />
            </span>
            <span>
              <strong>Your data & privacy</strong>
              <small>Saved on this device</small>
            </span>
            <ChevronRight size={20} />
          </button>
          <button className="you-row" onClick={() => setPanel("about")}>
            <span className="you-row-icon neutral">
              <Info size={23} />
            </span>
            <span>
              <strong>About Rep & Plate</strong>
              <small>A little help with the details</small>
            </span>
            <ChevronRight size={20} />
          </button>
        </div>
        <button className="you-chat-return" onClick={() => onNavigate("Chat")}>
          <PlateMark />
          <span>Something to share? Just tell Rep & Plate.</span>
          <ArrowRight size={19} />
        </button>
      </div>
      <FuelTabs
        onScan={onScan}
        active="You"
        onNavigate={onNavigate}
      />
      {panel === "menu" && (
        <Modal title="Your space" onClose={() => setPanel(null)}>
          <div className="fuel-menu">
            <button
              onClick={() => {
                setPanel(null);
                scrollToReviews();
              }}
            >
              <Inbox />
              Your reviews
              <ChevronRight />
            </button>
            <button onClick={closeAndEdit}>
              <UserRound />
              Profile & preferences
              <ChevronRight />
            </button>
            <button
              onClick={() => {
                setPanel(null);
                onNavigate("Chat");
              }}
            >
              <MessageCircle />
              Back to chat
              <ChevronRight />
            </button>
          </div>
        </Modal>
      )}
      {panel === "completed" && (
        <Modal title="Completed reviews" onClose={() => setPanel(null)}>
          <div className="you-completed">
            {completedChatReviews
              .slice()
              .reverse()
              .map((item) => (
                <article key={item.id}>
                  <span className="you-row-icon">
                    <Check size={22} />
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <strong>{item.result}</strong>
                    <small>{item.source}</small>
                    <button
                      className="you-connected-action"
                      onClick={() => {
                        setPanel(null);
                        onReviewMessage(item.messageId!);
                      }}
                    >
                      View in Chat
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </article>
              ))}
            {resolved.length ? (
              resolved
                .slice()
                .reverse()
                .map((item) => (
                  <article key={item.id}>
                    <span className="you-row-icon">
                      <Check size={22} />
                    </span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.question}</p>
                      <strong>{item.answer}</strong>
                      <small>{item.source}</small>
                    </div>
                  </article>
                ))
            ) : !completedChatReviews.length ? (
              <p>No completed reviews yet. Your answers will be saved here.</p>
            ) : null}
          </div>
        </Modal>
      )}
      {panel === "weekly" && (
        <Modal title="Weekly Spot Check" onClose={() => setPanel(null)} wide>
          <div className="you-weekly-review">
            <SpotWeeklyReview state={state}/>
            <p className="you-week-range">
              {week.start} to {week.end} · Last seven days
            </p>
            <p>
              A look at your saved records. Unlogged days are unknown, and
              sample meals are left out.
            </p>
            <div className="you-week-stats">
              <div>
                <strong>{week.meals.length}</strong>
                <span>personal meals</span>
              </div>
              <div>
                <strong>{week.loggedDays}</strong>
                <span>days with meals</span>
              </div>
              <div>
                <strong>{week.workouts.length}</strong>
                <span>recorded workouts</span>
              </div>
            </div>
            <h3>Your nutrition</h3>
            {week.insights.map((insight) => (
              <article className="you-week-insight" key={insight.title}>
                <h4>{insight.title}</h4>
                <p>{insight.description}</p>
                <details>
                  <summary>How this was calculated</summary>
                  <p>{insight.detail.split("\n\n")[0]}</p>
                  <small>{insight.evidence}</small>
                </details>
              </article>
            ))}
            {week.meals.length > 0 && (
              <details className="you-week-records">
                <summary>
                  View the {week.meals.length} meal{" "}
                  {week.meals.length === 1 ? "record" : "records"}
                </summary>
                {week.meals.map((meal) => (
                  <div key={meal.id}>
                    <small>{meal.day}</small>
                    <MealRow
                      meal={meal}
                      onEdit={(item) => {
                        setPanel(null);
                        onEditMeal(item);
                      }}
                    />
                  </div>
                ))}
              </details>
            )}
            <h3>Your workouts</h3>
            {week.workouts.length ? (
              week.workouts.map((workout) => (
                <article
                  className="you-week-workout"
                  key={`${workout.startedAt}:${workout.title}`}
                >
                  <span className="you-row-icon">
                    <Dumbbell size={22} />
                  </span>
                  <div>
                    <strong>{workout.title}</strong>
                    <small>
                      {workout.day} · {workout.sets}{" "}
                      {workout.sets === 1 ? "set" : "sets"} recorded ·{" "}
                      {workout.finished ? "Completed" : "In progress"}
                    </small>
                  </div>
                </article>
              ))
            ) : (
              <p>
                No dated workouts with recorded sets in this period. Starting a
                plan alone does not count as a completed workout.
              </p>
            )}
            <p className="you-week-evidence">
              Workout evidence uses saved session dates and recorded sets. It
              does not infer recovery, calorie burn, or progress from missing
              sessions.
            </p>
            <button
              className="you-dialog-action"
              onClick={() => {
                setPanel(null);
                onNavigate("Chat");
              }}
            >
              Continue your week in Chat <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
      {panel === "meals" && (
        <Modal title="Meals & captures" onClose={() => setPanel(null)}>
          <div className="you-saved-meals">
            {savedMeals.length ? (
              savedMeals
                .slice()
                .reverse()
                .map((meal) => (
                  <div key={meal.id}>
                    <small>{meal.day}</small>
                    <MealRow
                      meal={meal}
                      onEdit={(item) => {
                        setPanel(null);
                        onEditMeal(item);
                      }}
                    />
                  </div>
                ))
            ) : (
              <p>Send your first meal in chat and you’ll find it here.</p>
            )}
            {resolved.filter((r) => r.kind === "capture").length > 0 && (
              <>
                <h3>Reviewed captures</h3>
                {resolved
                  .filter((r) => r.kind === "capture")
                  .map((item) => (
                    <article key={item.id}>
                      <p>{item.question}</p>
                      <small>
                        {item.answer} · {item.source}
                      </small>
                    </article>
                  ))}
              </>
            )}
            <button
              className="you-dialog-action"
              onClick={() => {
                setPanel(null);
                onNavigate("Chat");
              }}
            >
              Share something in chat <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
      {panel === "workouts" && (
        <Modal title="Workout history" onClose={() => setPanel(null)}>
          <div className="you-sessions">
            {sessions.length ? (
              sessions.map((session, i) => (
                <article key={`${session.startedAt}-${i}`}>
                  <div>
                    <span className="you-row-icon">
                      <Dumbbell size={24} />
                    </span>
                    <div>
                      <h3>{session.title}</h3>
                      <small>
                        {session.startedAt &&
                          new Date(session.startedAt).toLocaleDateString()}{" "}
                        · {session.finishedAt ? "Saved" : "In progress"}
                      </small>
                    </div>
                  </div>
                  <p>
                    {session.exercises.reduce(
                      (n, ex) => n + ex.sets.filter((r) => r !== null).length,
                      0,
                    )}{" "}
                    sets recorded
                  </p>
                  {session.exercises.map((ex) => (
                    <div className="you-session-exercise" key={ex.name}>
                      <strong>{ex.name}</strong>
                      <span>
                        {ex.sets.map((r) => r ?? "—").join(", ")} reps
                      </span>
                    </div>
                  ))}
                </article>
              ))
            ) : (
              <div className="you-history-empty">
                <Dumbbell size={32} />
                <h3>Your first session is ahead of you.</h3>
                <p>
                  Choose a workout and tell Rep & Plate how each set went.
                  Your sessions will be here when you’re done.
                </p>
              </div>
            )}
            <button
              className="you-dialog-action"
              onClick={() => {
                setPanel(null);
                onNavigate("Workouts");
              }}
            >
              {state.workout.status === "active"
                ? "Continue your workout"
                : "Explore workouts"}{" "}
              <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
      {panel === "privacy" && (
        <Modal title="Your data, in your hands." onClose={() => setPanel(null)}>
          <div className="you-dialog-copy">
            <span className="you-row-icon">
              <ShieldCheck size={26} />
            </span>
            <h3>Saved on this device.</h3>
            <p>
              Your meals, captures, goals, and workout sessions are saved in
              this browser. Account & backups lets you explicitly save a copy to
              your Supabase account or restore one. Changes are not
              automatically synced.
            </p>
            <p>
              {aiAvailable
                ? "AI messages, images and voice recordings you submit, and relevant saved context are sent to OpenAI to answer you. Extracted details can be sent to TypeSafe for classification. Web searches use external sources. API requests ask OpenAI not to store the response; provider retention policies still apply."
                : "AI is currently unavailable. Saved records remain on this device."}
            </p>
            <p>
              Clearing this site’s browser data removes those records. Profile &
              preferences includes an option to start fresh with empty records.
            </p>
            <button className="you-dialog-action" onClick={closeAndEdit}>
              Open preferences <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
      {panel === "about" && (
        <Modal
          title="A little less to think about."
          onClose={() => setPanel(null)}
        >
          <div className="you-dialog-copy">
            <PlateMark />
            <h3>You live your life. Rep & Plate keeps the details.</h3>
            <p>
              Chat is your starting point. Share a meal, track a workout, or
              answer a quick question. You can always revisit and correct what’s
              saved.
            </p>
            <p>
              Your food log starts empty. Insights use your own saved meals;
              workout options have example targets you can adjust.{" "}
              {aiAvailable
                ? "AI chat, image reading, and web nutrition research are connected."
                : "AI is currently unavailable."}{" "}
              Voice messages can be transcribed, reviewed, and sent. Device
              connections and automatic grocery-store account imports aren’t
              connected yet.
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
}

function LegacyReviewCard({
  item,
  onResolve,
  onAddMeal,
}: {
  item: ReviewItem;
  onResolve: Props["onResolve"];
  onAddMeal: Props["onAddMeal"];
}) {
  return (
    <section key={item.id} className="you-review-card" aria-label={item.title}>
      <div className="you-review-context">
        {item.image ? (
          <img src={item.image} alt="Capture to review" />
        ) : (
          <span className="you-review-icon">
            {item.kind === "fries" ? (
              <Utensils size={24} />
            ) : (
              <MessageCircle size={24} />
            )}
          </span>
        )}
        <div>
          <small>{item.source}</small>
          <h3>{item.title}</h3>
        </div>
      </div>
      <p>{item.question}</p>
      <div className="you-review-answers">
        {item.options.map((answer) => (
          <button key={answer} onClick={() => onResolve(item.id, answer)}>
            {answer}
            <Check size={15} />
          </button>
        ))}
        {item.kind === "capture" && (
          <button className="you-add-meal" onClick={() => onAddMeal(item)}>
            Add meal details <ArrowRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}
