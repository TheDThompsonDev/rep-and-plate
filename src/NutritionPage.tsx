import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  CupSoda,
  Droplet,
  Info,
  MessageCircle,
  Utensils,
} from "lucide-react";
import { FuelHeader, FuelTabs } from "./FuelNavigation";
import { MealRow, Modal } from "./components";
import {
  sumNutrition,
  today,
  type AppState,
  type Meal,
  type Page,
} from "./domain";
import "./nutrition.css";

const insightCards = [
  {
    icon: Droplet,
    tone: "oil",
    title:
      "Cooking oil added more calories than the chicken in 2 meals this week.",
    description: "2 tbsp of oil is about 240 calories.",
    detail:
      "This sample insight compares the estimated oil and chicken portions in two example meals. Oil quantity is difficult to infer from a photo, so both records would remain editable. The comparison illustrates the product’s design; it has not been calculated from your own history.",
    evidence: "Sample history · 2 home-cooked meals · estimated portions",
  },
  {
    icon: BarChart3,
    tone: "protein",
    title: "Your highest-protein days start with breakfast.",
    description:
      "When breakfast has 30g+ protein, you average 41g more protein by the end of the day.",
    detail:
      "In this illustrative history, days with at least 30g of protein at breakfast averaged 41g more protein overall. This describes a sample association, not a proven cause or a finding about your actual meals.",
    evidence: "Sample history · 14 days · breakfast and daily protein totals",
  },
  {
    icon: CupSoda,
    tone: "drinks",
    title: "Most of your extra calories this week came from drinks.",
    description:
      "Meals were close to target. Drinks added about 420 extra calories.",
    detail:
      "The example week includes around 420 calories from drinks above the sample target. This is meant to show how Fuel can put a pattern into context, without assigning a score to your food. Your own captures are not yet analyzed for weekly insights.",
    evidence: "Sample history · 7 days · drink captures",
  },
];
const swaps = [
  {
    from: "Starbucks Frappuccino",
    fromNote: "420 calories",
    to: "Iced Americano",
    toNote: "(with splash of milk)",
    calories: "~30 calories",
    sourceClass: "frappuccino",
    targetClass: "americano",
    detail:
      "An illustrative drink swap: a sweet blended coffee at about 420 calories for an iced Americano with a splash of milk at about 30 calories. Cup size, recipe, and milk change the estimate. This comparison uses the reference design’s sample values, not a live restaurant lookup.",
    difference: "About 390 fewer calories in this sample comparison.",
  },
  {
    from: "Ranch Dressing",
    fromNote: "140 calories (2 tbsp)",
    to: "Salsa",
    toNote: "",
    calories: "10 calories (2 tbsp)",
    sourceClass: "ranch",
    targetClass: "salsa",
    detail:
      "An illustrative dressing swap using a 2-tablespoon serving of each: ranch at about 140 calories and salsa at about 10 calories. Brands and recipes vary. Use the values on your own label when you need a more precise estimate.",
    difference: "About 130 fewer calories for the same sample serving size.",
  },
];

type Props = {
  state: AppState;
  onNavigate: (page: Page) => void;
  onProfile: () => void;
  onEditMeal: (meal: Meal) => void;
  onChatSummary: () => void;
};

export default function NutritionPage({
  state,
  onNavigate,
  onProfile,
  onEditMeal,
  onChatSummary,
}: Props) {
  const [dialog, setDialog] = useState<"menu" | "meals" | "all" | null>(null);
  const [insight, setInsight] = useState<number | null>(null);
  const [swap, setSwap] = useState<number | null>(null);
  const totals = sumNutrition(state.meals);
  const remaining = state.profile.calories - totals.calories;
  const progress = Math.min(1, totals.calories / state.profile.calories);
  const meals = state.meals.filter((m) => m.day === today());
  return (
    <section className="fuel-chat nutrition-surface" aria-label="Nutrition">
      <FuelHeader
        onHome={() => onNavigate("Chat")}
        onMenu={() => setDialog("menu")}
        onNutrition={onChatSummary}
        onProfile={onProfile}
      />
      <div className="nutrition-scroll">
        <div className="nutrition-intro">
          <h1>
            Here’s what we’re learning
            <br className="nutrition-title-break" /> about your nutrition.
          </h1>
          <p>Real insights from your meals, habits, and progress.</p>
        </div>
        <section className="nutrition-today" aria-label="Today’s nutrition">
          <h2>Today’s nutrition</h2>
          <p className="nutrition-remaining">
            {Math.abs(remaining).toLocaleString()} calories{" "}
            {remaining >= 0 ? "left" : "above target"}
          </p>
          <div className="nutrition-numbers">
            <button
              className="nutrition-ring"
              onClick={() => setDialog("meals")}
              aria-label="View and edit today’s meals"
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
        </section>
        <section className="nutrition-insights">
          <div className="nutrition-section-heading">
            <h2>Your insights</h2>
            <button onClick={() => setDialog("all")}>
              See all
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="nutrition-insight-list">
            {insightCards.map(({ icon: Icon, ...card }, index) => (
              <button
                className="nutrition-insight"
                key={card.title}
                onClick={() => setInsight(index)}
              >
                <span className={`nutrition-insight-icon ${card.tone}`}>
                  <Icon
                    size={27}
                    strokeWidth={card.tone === "protein" ? 3 : 2.1}
                    fill={card.tone === "oil" ? "#178463" : "none"}
                  />
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
        <section className="nutrition-swaps">
          <div className="nutrition-section-heading">
            <h2>Smart swaps</h2>
            <span>Simple changes. A big difference.</span>
          </div>
          <div className="nutrition-swap-list">
            {swaps.map((item, index) => (
              <button
                className="nutrition-swap"
                key={item.from}
                onClick={() => setSwap(index)}
                aria-label={`${item.from} to ${item.to}`}
              >
                <span
                  className={`swap-photo ${item.sourceClass}`}
                  role="img"
                  aria-label={item.from}
                />
                <span className="swap-copy">
                  <strong>{item.from}</strong>
                  <span>{item.fromNote}</span>
                </span>
                <ArrowRight className="swap-arrow" size={21} />
                <span
                  className={`swap-photo ${item.targetClass}`}
                  role="img"
                  aria-label={item.to}
                />
                <span className="swap-copy swapped">
                  <strong>
                    {item.to}
                    {item.toNote && (
                      <>
                        <br />
                        {item.toNote}
                      </>
                    )}
                  </strong>
                  <span>{item.calories}</span>
                </span>
                <ChevronRight className="nutrition-chevron" size={18} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <FuelTabs
        active="Nutrition"
        onNavigate={onNavigate}
        onProfile={onProfile}
      />
      {dialog === "menu" && (
        <Modal title="Your nutrition" onClose={() => setDialog(null)}>
          <div className="fuel-menu">
            <button onClick={() => setDialog("meals")}>
              <Utensils size={21} />
              <span>Today’s meals</span>
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
              Insights and swaps use sample history.
            </p>
          </div>
        </Modal>
      )}
      {dialog === "meals" && (
        <Modal title="Today’s meals" onClose={() => setDialog(null)}>
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
              These examples show the kinds of patterns Fuel will surface. They
              use sample history, not an analysis of your current meal records.
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
      {insight !== null && (
        <Modal
          title={insightCards[insight].title}
          onClose={() => setInsight(null)}
        >
          <div className="nutrition-detail">
            <p>{insightCards[insight].detail}</p>
            <span className="nutrition-evidence">
              <Info size={17} />
              {insightCards[insight].evidence}
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
      {swap !== null && (
        <Modal
          title={`${swaps[swap].from} → ${swaps[swap].to}`}
          onClose={() => setSwap(null)}
        >
          <div className="nutrition-detail">
            <div className="swap-detail-photos">
              <span
                className={`swap-photo ${swaps[swap].sourceClass}`}
                role="img"
                aria-label={swaps[swap].from}
              />
              <ArrowRight size={25} />
              <span
                className={`swap-photo ${swaps[swap].targetClass}`}
                role="img"
                aria-label={swaps[swap].to}
              />
            </div>
            <p>{swaps[swap].detail}</p>
            <span className="nutrition-evidence">
              <Info size={17} />
              {swaps[swap].difference}
            </span>
            <button
              className="button primary full-width"
              onClick={() => setSwap(null)}
            >
              Got it
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
