import { useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
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
} from "lucide-react";
import { FuelHeader, FuelTabs } from "./FuelNavigation";
import { FuelLeaf } from "./ChatLayer";
import { MealRow, Modal } from "./components";
import { type AppState, type Meal, type Page, type ReviewItem } from "./domain";
import "./you.css";

type Props = {
  state: AppState;
  aiAvailable: boolean;
  onGroceries: () => void;
  onNavigate: (page: Page) => void;
  onEditProfile: () => void;
  onEditMeal: (meal: Meal) => void;
  onResolve: (id: string, answer: string) => void;
  onAddMeal: (item: ReviewItem) => void;
};
type Panel =
  "menu" | "completed" | "meals" | "workouts" | "privacy" | "about" | null;

export default function YouPage({
  state,
  aiAvailable,
  onGroceries,
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
    reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    reviewRef.current?.focus({ preventScroll: true });
  };
  const closeAndEdit = () => {
    setPanel(null);
    onEditProfile();
  };
  return (
    <section className="fuel-chat you-surface" aria-label="You">
      <FuelHeader
        menuLabel="Open your menu"
        onHome={() => onNavigate("Chat")}
        onMenu={() => setPanel("menu")}
        onNutrition={() => onNavigate("Nutrition")}
        onProfile={onEditProfile}
      />
      <div className="you-scroll">
        <div className="you-intro">
          <h1>Your space, your pace.</h1>
          <p>The little details that make Fuel yours.</p>
        </div>
        <section className="you-profile-card">
          <span className="you-avatar">
            {state.profile.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h2>{state.profile.name}</h2>
            <p>A little less to think about.</p>
          </div>
          <button aria-label="Edit your profile" onClick={onEditProfile}>
            <Pencil size={18} />
          </button>
        </section>
        <button className="you-review-summary" onClick={scrollToReviews}>
          <span className="you-summary-icon">
            {pending.length ? <Inbox size={25} /> : <CheckCheck size={25} />}
          </span>
          <span>
            <strong>
              {pending.length
                ? `${pending.length} little ${pending.length === 1 ? "thing" : "things"} to review`
                : "You’re all caught up."}
            </strong>
            <small>
              {pending.length
                ? "A quick answer, and you’re on your way."
                : "Your details are taken care of for now."}
            </small>
          </span>
          <ChevronRight size={21} />
        </button>
        <section
          ref={reviewRef}
          tabIndex={-1}
          className="you-reviews"
          aria-label="Your reviews"
        >
          <div className="you-section-heading">
            <h2>Your reviews</h2>
            <button onClick={() => setPanel("completed")}>
              Completed{resolved.length ? ` · ${resolved.length}` : ""}{" "}
              <ChevronRight size={16} />
            </button>
          </div>
          <div aria-live="polite" className="sr-only">
            {pending.length} pending reviews
          </div>
          {pending.length ? (
            (showAll ? pending : pending.slice(0, 2)).map((item) => (
              <section
                key={item.id}
                className="you-review-card"
                aria-label={item.title}
              >
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
                    <button
                      key={answer}
                      onClick={() => onResolve(item.id, answer)}
                    >
                      {answer}
                      <Check size={15} />
                    </button>
                  ))}
                  {item.kind === "capture" && (
                    <button
                      className="you-add-meal"
                      onClick={() => onAddMeal(item)}
                    >
                      Add meal details <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </section>
            ))
          ) : (
            <div className="you-empty-reviews">
              <FuelLeaf />
              <div>
                <strong>Nothing waiting on you.</strong>
                <p>Anything that needs a little context will appear here.</p>
              </div>
            </div>
          )}
          {pending.length > 2 && (
            <button
              className="you-show-more"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Show fewer" : `See all ${pending.length} reviews`}{" "}
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
              <strong>A direction that works for you.</strong>
              <p>Your targets, always adjustable.</p>
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
        <div className="you-section-heading">
          <h2>Your activity</h2>
        </div>
        <div className="you-row-group">
          <button className="you-row" onClick={onGroceries}>
            <span className="you-row-icon">
              <ShoppingBasket size={23} />
            </span>
            <span>
              <strong>Groceries & pantry</strong>
              <small>
                {(state.groceries ?? []).reduce(
                  (n, g) =>
                    n +
                    g.items.filter((i) => i.availability === "available")
                      .length,
                  0,
                )}{" "}
                available items · from your receipts
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
                {state.meals.length} saved{" "}
                {state.meals.length === 1 ? "meal" : "meals"} ·{" "}
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
          <h2>Make yourself at home</h2>
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
              <strong>About Fuel</strong>
              <small>A little help with the details</small>
            </span>
            <ChevronRight size={20} />
          </button>
        </div>
        <button className="you-chat-return" onClick={() => onNavigate("Chat")}>
          <FuelLeaf />
          <span>Something to share? Just tell Fuel.</span>
          <ArrowRight size={19} />
        </button>
      </div>
      <FuelTabs
        active="You"
        onNavigate={onNavigate}
        onProfile={() => onNavigate("You")}
      />
      {panel === "menu" && (
        <Modal title="Your Fuel" onClose={() => setPanel(null)}>
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
            ) : (
              <p>No completed reviews yet. Your answers will be saved here.</p>
            )}
          </div>
        </Modal>
      )}
      {panel === "meals" && (
        <Modal title="Meals & captures" onClose={() => setPanel(null)}>
          <div className="you-saved-meals">
            {state.meals.length ? (
              state.meals
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
                  Choose a workout and tell Fuel how each set went. Your
                  sessions will be here when you’re done.
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
              this browser. There’s no account or cloud sync in this prototype.
            </p>
            <p>
              {aiAvailable
                ? "AI messages, images you submit, and relevant saved context are sent to OpenAI to answer you. Extracted details can be sent to TypeSafe for classification. Web searches use external sources. API requests ask OpenAI not to store the response; provider retention policies still apply."
                : "AI is currently unavailable. Saved records remain on this device."}
            </p>
            <p>
              Clearing this site’s browser data removes those records. Profile &
              preferences includes an option to start over with sample data.
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
            <FuelLeaf />
            <h3>You live your life. Fuel keeps the details.</h3>
            <p>
              Chat is your starting point. Share a meal, track a workout, or
              answer a quick question. You can always revisit and correct what’s
              saved.
            </p>
            <p>
              This preview includes sample meals, plans, and insights.{" "}
              {aiAvailable
                ? "AI chat, image reading, and web nutrition research are connected."
                : "AI is currently unavailable."}{" "}
              Voice transcription, device connections, and automatic
              grocery-store account imports aren’t connected yet.
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
}
