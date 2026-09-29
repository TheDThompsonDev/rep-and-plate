import { SpotEmptyState } from './features/spot/Spot';
import { useState } from "react";
import {
  BarChart3,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Info,
  MessageCircle,
  Plus,
  ShoppingBasket,
  CalendarDays,
  CookingPot,
  Pencil,
  Utensils,
  ScanBarcode,
} from "lucide-react";
import { FuelHeader, FuelTabs } from "./FuelNavigation";
import { MealRow, Modal } from "./components";
import {
  sumNutrition,
  today,
  personalMeals,
  isExampleMeal,
  type AppState,
  type Meal,
  type Page,
} from "./domain";
import "./nutrition.css";
import "./refined-tabs.css";
import { PlateMark } from "./features/spot/Spot";
import SmartSwaps from "./features/planning/SmartSwaps";
import { getPantryLots } from "./features/pantry/ledger";
import { defaultPreferences } from "./features/preferences/contracts";
import { nutritionInsights } from "./features/insights/insights";

type Props = {
  state: AppState;
  onNavigate: (page: Page) => void;
  onProfile: () => void;
  onScan: () => void;
  onEditGoals: () => void;
  onEditMeal: (meal: Meal) => void;
  onChatSummary: () => void;
  onAsk: (text: string) => void;
  onOpenPantry?: () => void;
  onOpenPlan?: () => void;
  onOpenRecipes?: () => void;
};

export default function NutritionPage({
  state,
  onNavigate,
  onProfile,
  onScan,
  onEditGoals,
  onEditMeal,
  onChatSummary,
  onAsk,
  onOpenPantry,
  onOpenPlan,
  onOpenRecipes,
}: Props) {
  const [dialog, setDialog] = useState<"menu" | "meals" | "all" | null>(null);
  const [insight, setInsight] = useState<number | null>(null);
  const [historyDay, setHistoryDay] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [view, setView] = useState<"day" | "week">("day");
  const currentDay = today();
  const day = selectedDay ?? currentDay;
  const moveDay = (offset: number) => {
    const date = new Date(`${day}T12:00:00`);
    date.setDate(date.getDate() + offset);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setSelectedDay(key === currentDay ? null : key);
    setView("day");
  };
  const insightCards = nutritionInsights(state);
  const totals = sumNutrition(state.meals, day);
  const remaining = state.profile.calories - totals.calories;
  const progress = Math.min(1, totals.calories / state.profile.calories);
  const meals = personalMeals(state.meals, day);
  const hasExamples = state.meals.some(isExampleMeal);
  const dateLabel = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${currentDay}T12:00:00`);
    date.setDate(date.getDate() - 6 + index);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const entries = personalMeals(state.meals, key);
    return {
      day: key,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      date: date.getDate(),
      count: entries.length,
      totals: sumNutrition(entries, key),
    };
  });
  const loggedDays = week.filter((entry) => entry.count > 0).length;
  const selectedInsight = insight === null ? undefined : insightCards[insight];
  const modalOpen = dialog !== null || !!selectedInsight || historyDay !== null;
  const mealGroups = (["Breakfast", "Lunch", "Dinner", "Snack"] as const)
    .map((category) => ({
      category,
      meals: meals.filter((meal) => meal.category === category),
    }))
    .filter((group) => group.meals.length > 0);
  return (
    <section
      className="fuel-chat nutrition-surface refined-surface"
      aria-label="Nutrition"
    >
      <FuelHeader
        onHome={() => onNavigate("Chat")}
        onMenu={() => setDialog("menu")}
        onNutrition={onChatSummary}
        onProfile={onProfile}
      />
      <div
        className="nutrition-scroll"
        inert={modalOpen}
        aria-hidden={modalOpen}
      >
        <div className="nutrition-intro">
          <h1>
            Your day is
            <br /> coming together.
          </h1>
          <p>A clear picture of what fuels you.</p>
        </div>
        <div className="nutrition-date-controls">
          <button onClick={() => moveDay(-1)} aria-label="Previous day">
            <ChevronLeft size={18} />
          </button>
          <span className="nutrition-date">
            {day === currentDay ? "Today · " : ""}
            {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              ...(day !== currentDay ? { weekday: "short" as const } : {}),
            })}
          </span>
          <button
            onClick={() => moveDay(1)}
            disabled={day >= currentDay}
            aria-label="Next day"
          >
            <ChevronRight size={18} />
          </button>
          <div className="refined-segment" aria-label="Food log view">
            <button
              aria-pressed={view === "day"}
              onClick={() => setView("day")}
            >
              Day
            </button>
            <button
              aria-pressed={view === "week"}
              onClick={() => setView("week")}
            >
              Week
            </button>
          </div>
        </div>
        {selectedDay && (
          <button
            className="nutrition-return-today"
            onClick={() => {
              setSelectedDay(null);
              setView("day");
            }}
          >
            Return to today
          </button>
        )}
        <section className="nutrition-today" aria-label="Today’s nutrition">
          <h2>
            {day === currentDay
              ? "Today’s nutrition"
              : "Your recorded nutrition"}
          </h2>
          <p className="nutrition-remaining">
            {meals.length
              ? `${Math.abs(remaining).toLocaleString()} calories ${remaining >= 0 ? "left" : "above target"}`
              : "Nothing logged for this day yet"}
          </p>
          <div className="nutrition-numbers">
            <button
              className="nutrition-ring"
              onClick={() => setDialog("meals")}
              aria-label={
                day === currentDay
                  ? "View and edit today’s meals"
                  : "View and edit this day’s meals"
              }
            >
              <svg viewBox="0 0 110 110" aria-hidden="true">
                <defs>
                  <linearGradient id="nutrition-ring-gradient">
                    <stop offset="0%" stopColor="#65b99e" />
                    <stop offset="100%" stopColor="#006249" />
                  </linearGradient>
                </defs>
                <circle
                  cx="55"
                  cy="55"
                  r="48"
                  className="nutrition-ring-track"
                />
                <circle
                  cx="55"
                  cy="55"
                  r="48"
                  className="nutrition-ring-fill"
                  strokeDasharray={`${progress * 301.6} 301.6`}
                />
              </svg>
              <span className="nutrition-ring-label">
                <strong>{totals.calories.toLocaleString()}</strong>
                <span>of {state.profile.calories.toLocaleString()} cal</span>
              </span>
            </button>
            <div className="nutrition-macro-list">
              {(["protein", "carbs", "fat"] as const).map((key) => {
                const percent = Math.round(
                  (totals[key] / state.profile[key]) * 100,
                );
                return (
                  <div className={`nutrition-macro ${key}`} key={key}>
                    <span className="nutrition-macro-name">
                      <i />
                      {key === "fat"
                        ? "Fats"
                        : key[0].toUpperCase() + key.slice(1)}
                    </span>
                    <span className="nutrition-macro-value">
                      <strong>{totals[key]}g</strong>
                      <span> / {state.profile[key]}g</span>
                    </span>
                    <span
                      className="nutrition-macro-track"
                      role="progressbar"
                      aria-label={key}
                      aria-valuenow={totals[key]}
                      aria-valuemin={0}
                      aria-valuemax={Math.max(totals[key], state.profile[key])}
                    >
                      <i style={{ width: `${Math.min(100, percent)}%` }} />
                    </span>
                    <span className="nutrition-macro-percent">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="nutrition-target-context">
            <span>
              {meals.length
                ? `From ${meals.length} ${meals.length === 1 ? "meal" : "meals"} you logged`
                : "Based on your saved daily targets."}
            </span>
            <button onClick={onEditGoals} aria-label="Edit daily targets">
              Edit targets <Pencil size={13} />
            </button>
          </div>
        </section>
        <button
          className="nutrition-scan"
          onClick={onScan}
          aria-label="Scan a food barcode"
        >
          <span className="nutrition-scan-icon">
            <ScanBarcode size={24} />
          </span>
          <span>
            <strong>Have a label? Scan it.</strong>
            <small>Check the portion, then add it to your day.</small>
          </span>
          <ChevronRight size={18} />
        </button>
        <section
          className="nutrition-diary"
          aria-label={
            day === currentDay
              ? "Today's logged meals"
              : "Selected day’s logged meals"
          }
          hidden={view !== "day"}
        >
          <div className="nutrition-section-heading">
            <h2>What you’ve had</h2>
            {meals.length > 0 && (
              <button
                className="nutrition-log-action"
                onClick={() => onNavigate("Chat")}
              >
                <Plus size={16} /> Log a meal
              </button>
            )}
          </div>
          {hasExamples && (
            <p className="nutrition-example-note">
              Example meals are excluded from your totals and food log.
            </p>
          )}
          {meals.length ? (
            <div className="nutrition-meal-groups">
              {mealGroups.map((group) => (
                <section
                  className="nutrition-meal-group"
                  key={group.category}
                  aria-label={`${group.category} meals`}
                >
                  <div className="nutrition-meal-group-heading">
                    <h3>
                      {group.category === "Snack"
                        ? "Snacks & drinks"
                        : group.category}
                    </h3>
                    <span>
                      {group.meals
                        .reduce((sum, meal) => sum + meal.calories, 0)
                        .toLocaleString()}{" "}
                      cal
                    </span>
                  </div>
                  {group.meals.map((meal) => (
                    <button
                      key={meal.id}
                      className="nutrition-logged-meal"
                      onClick={() => onEditMeal(meal)}
                      aria-label={`Edit ${meal.title}`}
                    >
                      {meal.image ? (
                        <img src={meal.image} alt="" loading="lazy" />
                      ) : (
                        <span className="nutrition-meal-placeholder">
                          <Utensils size={21} />
                        </span>
                      )}
                      <span className="nutrition-logged-meal-copy">
                        <strong>{meal.title}</strong>
                        <span className="nutrition-meal-metadata">
                          {meal.time} ·{" "}
                          {meal.confidence === "estimated"
                            ? "Estimated"
                            : "Confirmed"}
                        </span>
                        <span className="nutrition-meal-nutrients">
                          <b>{meal.calories.toLocaleString()} cal</b>
                          <span>{meal.protein}g protein</span>
                          <span>{meal.carbs}g carbs</span>
                          <span>{meal.fat}g fat</span>
                        </span>
                      </span>
                      <span className="nutrition-meal-edit">
                        <Pencil size={15} />
                        <span>Edit</span>
                      </span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <SpotEmptyState side="plate" onCapture={()=>onNavigate('Chat')}/>
          )}
        </section>
        <section
          className="nutrition-week"
          aria-label="Your last seven days"
          hidden={view !== "week"}
        >
          <div className="nutrition-section-heading">
            <h2>Your last seven days</h2>
            <span>{loggedDays} of 7 days have logs</span>
          </div>
          <div className="nutrition-week-days">
            {week.map((entry) => (
              <button
                key={entry.day}
                onClick={() => setHistoryDay(entry.day)}
                aria-label={`View ${dateLabel(entry.day)}`}
                className={entry.day === currentDay ? "is-today" : ""}
              >
                <span>{entry.label}</span>
                <b>{entry.date}</b>
                <strong>
                  {entry.count
                    ? `${entry.totals.calories.toLocaleString()}`
                    : "—"}
                </strong>
                <small>{entry.count ? "cal logged" : "Not logged"}</small>
              </button>
            ))}
          </div>
          <p>
            Logged calories may be a partial day. No log means unknown intake,
            not zero.
          </p>
        </section>
        {onOpenPlan && (
          <section className="nutrition-inspiration">
            <div className="nutrition-section-heading">
              <h2>A little inspiration for later</h2>
            </div>
            <p>Make room for something you’ll enjoy.</p>
            <button className="refined-meal-inspiration" onClick={onOpenPlan}>
              <img src="/images/bowl.jpg" alt="" loading="lazy" />
              <span>
                <small>MEALS AHEAD</small>
                <strong>
                  What sounds good
                  <br /> for your next meal?
                </strong>
                <b>
                  Explore your meal plan <ArrowRight size={17} />
                </b>
              </span>
            </button>
          </section>
        )}
        {loggedDays > 0 && (
          <section className="nutrition-insights">
            <div className="nutrition-section-heading">
              <h2>Your insights</h2>
              <button onClick={() => setDialog("all")}>
                See all
                <ChevronRight size={17} />
              </button>
            </div>
            <div className="nutrition-insight-list">
              {insightCards.slice(0, 1).map((card, index) => (
                <button
                  className="nutrition-insight"
                  key={card.title}
                  onClick={() => setInsight(index)}
                >
                  <span className={`nutrition-insight-icon ${card.tone}`}>
                    <PlateMark />
                    {card.tone === "oil" && <i />}
                  </span>
                  <span className="nutrition-insight-copy">
                    <strong>{card.title}</strong>
                    <span>{card.description}</span>
                  </span>
                  <ChevronRight className="nutrition-chevron" size={19} />
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="nutrition-section-heading">
          <h2>Your food, organized</h2>
        </div>
        {(onOpenPantry || onOpenPlan || onOpenRecipes) && (
          <nav className="nutrition-tools" aria-label="Food planning tools">
            {onOpenPantry && (
              <button onClick={onOpenPantry}>
                <ShoppingBasket size={20} />
                <strong>Pantry</strong>
                <span>What you have</span>
              </button>
            )}
            {onOpenPlan && (
              <button onClick={onOpenPlan}>
                <CalendarDays size={20} />
                <strong>Meal plan</strong>
                <span>Your week</span>
              </button>
            )}
            {onOpenRecipes && (
              <button onClick={onOpenRecipes}>
                <CookingPot size={20} />
                <strong>Recipes</strong>
                <span>Meals & leftovers</span>
              </button>
            )}
          </nav>
        )}
        <SmartSwaps
          lots={getPantryLots(state)}
          preferences={state.preferences ?? defaultPreferences()}
          onAsk={onAsk}
        />
      </div>
      <FuelTabs
        onScan={onScan}
        active="Nutrition"
        onNavigate={onNavigate}
      />
      {dialog === "menu" && (
        <Modal title="Your nutrition" onClose={() => setDialog(null)}>
          <div className="fuel-menu">
            <button onClick={() => setDialog("meals")}>
              <Utensils size={21} />
              <span>
                {day === currentDay ? "Today’s meals" : "Selected day’s meals"}
              </span>
              <ChevronRight size={17} />
            </button>
            <button
              onClick={() => {
                setDialog(null);
                onChatSummary();
              }}
            >
              <MessageCircle size={21} />
              <span>Talk about my day in Chat</span>
              <ChevronRight size={17} />
            </button>
            <button onClick={() => setDialog("all")}>
              <BarChart3 size={21} />
              <span>All insights</span>
              <ChevronRight size={17} />
            </button>
            <p>
              Live totals from your captured meals.
              <br />
              Insights and comparisons use your saved records.
            </p>
          </div>
        </Modal>
      )}
      {dialog === "meals" && (
        <Modal
          title={day === currentDay ? "Today’s meals" : dateLabel(day)}
          onClose={() => setDialog(null)}
        >
          <div className="nutrition-meals-dialog">
            {meals.length ? (
              meals.map((meal) => (
                <MealRow
                  meal={meal}
                  key={meal.id}
                  onEdit={(selected) => {
                    setDialog(null);
                    onEditMeal(selected);
                  }}
                />
              ))
            ) : (
              <p>
                No meals captured yet. Send a moment in Chat to get started.
              </p>
            )}
            <button
              className="button primary full-width"
              onClick={() => {
                setDialog(null);
                onNavigate("Chat");
              }}
            >
              Capture a meal in Chat
              <MessageCircle size={17} />
            </button>
          </div>
        </Modal>
      )}
      {dialog === "all" && (
        <Modal title="Your insights" onClose={() => setDialog(null)}>
          <div className="nutrition-detail">
            <p>
              These observations summarize your saved meals over the last seven
              days. Missing logs are not treated as zero intake.
            </p>
            {insightCards.map((card, index) => (
              <button
                className="nutrition-all-insight"
                key={card.title}
                onClick={() => {
                  setDialog(null);
                  setInsight(index);
                }}
              >
                {card.title}
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        </Modal>
      )}
      {historyDay !== null && (
        <Modal
          title={dateLabel(historyDay)}
          onClose={() => setHistoryDay(null)}
        >
          <div className="nutrition-meals-dialog">
            {personalMeals(state.meals, historyDay).length ? (
              <>
                <p>
                  {sumNutrition(
                    state.meals,
                    historyDay,
                  ).calories.toLocaleString()}{" "}
                  calories logged · This may be a partial day.
                </p>
                {personalMeals(state.meals, historyDay).map((meal) => (
                  <MealRow
                    key={meal.id}
                    meal={meal}
                    onEdit={(selected) => {
                      setHistoryDay(null);
                      onEditMeal(selected);
                    }}
                  />
                ))}
              </>
            ) : (
              <p>
                No meals logged for this day. That doesn’t tell us how much you
                ate.
              </p>
            )}
          </div>
        </Modal>
      )}
      {selectedInsight && (
        <Modal title={selectedInsight.title} onClose={() => setInsight(null)}>
          <div className="nutrition-detail">
            <p>{selectedInsight.detail}</p>
            <span className="nutrition-evidence">
              <Info size={17} />
              {selectedInsight.evidence}
            </span>
            <button
              className="button primary full-width"
              onClick={() => setInsight(null)}
            >
              Got it
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
