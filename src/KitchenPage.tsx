import {
  ArrowRight,
  CalendarDays,
  ChefHat,
  ChevronRight,
  CookingPot,
  ReceiptText,
  ScanBarcode,
  ShoppingBasket,
  Utensils,
} from "lucide-react";
import { FuelHeader, FuelTabs } from "./FuelNavigation";
import { PlateMark } from "./features/spot/Spot";
import { today, type AppState, type Page } from "./domain";
import { getPantryLots } from "./features/pantry/ledger";
import {
  displayCalendarDate,
  hasPantryStock,
  pantryDateReminder,
  sortPantryByDate,
} from "./features/pantry/dates";
import { remainingRecipePortions } from "./features/recipes/portions";
import {
  formatIngredientAmount,
  mealEstimate,
  planShoppingList,
} from "./features/planning/meal-plans";
import "./refined-tabs.css";
import "./kitchen.css";
import './features/shopping/shopping.css';
import { receiptSpending, formatMoney } from './features/shopping/shopping';
import FirstWeek from './features/planning/FirstWeek';

type Props = {
  state: AppState;
  onNavigate: (page: Page) => void;
  onScan: () => void;
  onPantry: () => void;
  onReceipt: (id: string) => void;
  onAddReceipt: () => void;
  onPlan: () => void;
  onRecipes: () => void;
  onAsk: (text: string) => void;
  onShopping: () => void;
  onPreferences: () => void;
  onTargets?: () => void;
};

export default function KitchenPage({
  state,
  onNavigate,
  onScan,
  onPantry,
  onReceipt,
  onAddReceipt,
  onPlan,
  onRecipes,
  onAsk,
  onShopping,
  onPreferences,
  onTargets,
}: Props) {
  const lots = getPantryLots(state);
  const stock = sortPantryByDate(lots.filter(hasPantryStock));
  const knownStock = stock.filter(
    (lot) => lot.remaining !== null && lot.remaining > 0 && !lot.inconsistent,
  );
  const uncertainStock = stock.length - knownStock.length;
  const prepared = (state.recipeBatches ?? []).filter(
    (batch) => remainingRecipePortions(batch) > 0,
  );
  const plan = state.mealPlans?.at(-1);
  // Only remaining scheduled meals create new shopping needs; logged portions
  // have already consumed pantry stock through the existing logging flow.
  const upcomingPlan = plan
    ? {
        ...plan,
        days: plan.days
          .filter((day) => day.date >= today())
          .map((day) => ({
            ...day,
            meals: day.meals.filter(
              (meal) =>
                !state.meals.some(
                  (saved) =>
                    saved.id === `pantry-meal:plan:${plan.id}:${meal.id}`,
                ),
            ),
          })),
      }
    : undefined;
  const planned =
    upcomingPlan?.days.flatMap((day) =>
      day.meals.map((meal) => ({ day: day.date, meal })),
    ) ?? [];
  const needs = upcomingPlan ? planShoppingList(upcomingPlan, lots) : [];
  const reminders = stock.filter((lot) => pantryDateReminder(lot));
  const receipts = [...(state.groceries ?? [])].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const weekStart=new Date(`${today()}T12:00:00`);
  weekStart.setDate(weekStart.getDate()-((weekStart.getDay()+6)%7));
  const weekDay=`${weekStart.getFullYear()}-${String(weekStart.getMonth()+1).padStart(2,'0')}-${String(weekStart.getDate()).padStart(2,'0')}`;
  const weekSpending=receiptSpending(receipts.filter(receipt=>receipt.purchase?.purchaseDate&&receipt.purchase.purchaseDate>=weekDay&&receipt.purchase.purchaseDate<=today()));
  const budget=state.preferences?.weeklyBudget;
  const currency=state.preferences?.shoppingCurrency;
  const spent=currency?weekSpending.totals[currency]:undefined;
  return (
    <section
      className="fuel-chat refined-surface kitchen-surface"
      aria-label="Kitchen"
    >
      <FuelHeader
        menuLabel="Open kitchen tools"
        onMenu={onPantry}
        onHome={() => onNavigate("Chat")}
        onNutrition={() => onNavigate("Nutrition")}
        onProfile={() => onNavigate("You")}
      />
      <div className="kitchen-scroll">
        <div className="kitchen-intro">
          <span>YOUR KITCHEN</span>
          <h1>
            What sounds
            <br /> good tonight?
          </h1>
          <p>What you have. What you can make. A little less to figure out.</p>
        </div>
        <button
          className="kitchen-inspiration"
          onClick={onPlan}
          aria-label="Open meal planner"
        >
          <img src="/images/bowl.jpg" alt="" />
          <span>
            <small>MAKE SOMETHING GOOD</small>
            <strong>
              {stock.length
                ? "Start with what’s\nalready here."
                : "A little inspiration\nfor your next meal."}
            </strong>
            <b>
              Explore your meal plan <ArrowRight size={17} />
            </b>
          </span>
        </button>
        <div className="kitchen-quick-actions">
          <button onClick={onScan}>
            <ScanBarcode size={20} />
            <span>Scan a food</span>
          </button>
          <button onClick={onAddReceipt}>
            <ReceiptText size={20} />
            <span>Add a receipt</span>
          </button>
        </div>

        <section className="kitchen-shopping-invitation" aria-label="Shopping for your household">
          <small>GOOD FOOD. YOUR KIND OF BUDGET.</small>
          <h2>Make your next shop work for you.</h2>
          <p>{state.preferences?.shoppingPriority ? `Shopping for ${state.preferences.householdSize}. Compare your usuals, save useful swaps, and build your list.` : 'Saving money, feeding a family, or finding a little more protein? Let’s start with what matters to you.'}</p>
          {budget&&currency&&<p>{spent===undefined?'No reviewed spending yet this week':`${formatMoney(spent,currency)} recorded this week`} · {formatMoney(budget,currency)} weekly budget. Uploaded receipts only; your full spending may differ.</p>}
          <div><button onClick={onShopping}>Swaps, list & spending <ArrowRight size={14}/></button><button onClick={onPreferences}>Shopping preferences</button></div>
        </section>
        <FirstWeek state={state} onTargets={onTargets??(()=>onNavigate('You'))} onAction={action=>({preferences:onPreferences,receipt:onAddReceipt,pantry:onPantry,planner:onPlan,shopping:onShopping})[action]()}/>
        <section className="kitchen-section" aria-label="What you have">
          <div className="kitchen-heading">
            <h2>What you have</h2>
            <button onClick={onPantry} aria-label="Open pantry">
              Your pantry <ChevronRight size={16} />
            </button>
          </div>
          <div className="kitchen-stock-summary">
            <ShoppingBasket size={23} />
            <span>
              <strong>
                {knownStock.length} {knownStock.length === 1 ? "item" : "items"}{" "}
                on hand
              </strong>
              <small>
                {uncertainStock
                  ? `${uncertainStock} ${uncertainStock === 1 ? "quantity needs" : "quantities need"} a check`
                  : "From your saved groceries and pantry updates"}
              </small>
            </span>
          </div>
          {stock.length ? (
            <div className="kitchen-list">
              {stock.slice(0, 4).map((lot) => (
                <button className="kitchen-row" key={lot.id} onClick={onPantry}>
                  <span className="kitchen-item-icon">
                    <Utensils size={22} />
                  </span>
                  <span>
                    <strong>{lot.item.name}</strong>
                    <small>
                      {lot.inconsistent || lot.remaining === null
                        ? "Check remaining amount"
                        : `${lot.remaining} labeled servings left`}{" "}
                      · {lot.store || "Saved groceries"}
                    </small>
                    <small className="kitchen-macros">
                      {lot.item.nutrition && !lot.item.needsReview
                        ? `${lot.item.nutrition.calories} cal · ${lot.item.nutrition.protein}g protein per ${lot.item.serving}`
                        : "Nutrition needs a check"}
                    </small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className="kitchen-empty">
              <PlateMark />
              <div>
                <strong>Let’s see what’s in your kitchen.</strong>
                <p>
                  Add a grocery receipt, or scan a food to start
                  adding what you have.
                </p>
              </div>
            </div>
          )}
          <p className="kitchen-footnote">
            Groceries are what you bought. Only portions you log as eaten count
            toward daily nutrition.
          </p>
        </section>

        <section className="kitchen-section" aria-label="What you can make">
          <div className="kitchen-heading">
            <h2>What you can make</h2>
            <button onClick={onRecipes} aria-label="Open recipes">
              Recipes <ChevronRight size={16} />
            </button>
          </div>
          {prepared.length > 0 && (
            <div className="kitchen-prepared">
              {prepared.slice(0, 3).map((batch) => (
                <button
                  className="kitchen-row"
                  key={batch.id}
                  onClick={onRecipes}
                >
                  <span className="kitchen-item-icon">
                    <CookingPot size={23} />
                  </span>
                  <span>
                    <strong>{batch.name}</strong>
                    <small>
                      {remainingRecipePortions(batch)} prepared portions left
                    </small>
                    <small className="kitchen-macros">
                      ~
                      {Math.round(
                        batch.nutrition.calories / batch.totalPortions,
                      )}{" "}
                      cal ·{" "}
                      {Math.round(
                        batch.nutrition.protein / batch.totalPortions,
                      )}
                      g protein per portion
                    </small>
                  </span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          )}
          {planned.slice(0, 3).map(({ day, meal }) => {
            const estimate = mealEstimate(meal, lots);
            return (
              <button
                className="kitchen-row"
                key={`${day}:${meal.id}`}
                onClick={onPlan}
              >
                <span className="kitchen-item-icon">
                  <CalendarDays size={22} />
                </span>
                <span>
                  <small>
                    {displayCalendarDate(day)} ·{" "}
                    {plan?.status === "draft" ? "Draft plan" : "Planned"}
                  </small>
                  <strong>{meal.title}</strong>
                  <small>
                    {meal.ingredients.map((item) => item.name).join(" · ")}
                  </small>
                  <small className="kitchen-macros">
                    {estimate.complete
                      ? `~${estimate.totals.calories} cal · ${estimate.totals.protein}g protein per portion`
                      : "Check ingredients to complete the nutrition estimate"}
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            );
          })}
          {!prepared.length && !planned.length && (
            <button className="kitchen-recipe-start" onClick={onRecipes}>
              <ChefHat size={28} />
              <span>
                <strong>Make once. Enjoy it again.</strong>
                <small>
                  Save a recipe, track its ingredients, and keep count of
                  portions left.
                </small>
              </span>
              <ChevronRight size={18} />
            </button>
          )}
          <button
            className="kitchen-text-action"
            onClick={() =>
              onAsk(
                "Help me think of a meal using my available pantry ingredients and saved food preferences. Separate anything I need to buy, ask me to check freshness, and do not log a meal or change inventory.",
              )
            }
          >
            <PlateMark />
            Think of a meal with me <ArrowRight size={17} />
          </button>
        </section>

        {reminders.length > 0 && (
          <section className="kitchen-section" aria-label="Dates to check">
            <div className="kitchen-heading">
              <h2>A little attention here</h2>
            </div>
            <p className="kitchen-subtitle">
              From the package dates you saved.
            </p>
            {reminders.slice(0, 3).map((lot) => (
              <button
                className="kitchen-date-reminder"
                key={lot.id}
                onClick={onPantry}
              >
                <span>
                  <strong>{lot.item.name}</strong>
                  <small>{pantryDateReminder(lot)}</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
            <p className="kitchen-footnote">
              Check the food and its storage before using it. A saved date
              doesn’t establish freshness.
            </p>
          </section>
        )}

        <section className="kitchen-section" aria-label="What you need to buy">
          <div className="kitchen-heading">
            <h2>What you need to buy</h2>
            <button onClick={onPlan} aria-label="Review shopping list">
              View plan <ChevronRight size={16} />
            </button>
          </div>
          {needs.length ? (
            <>
              <p className="kitchen-subtitle">
                For the remaining meals in your latest{" "}
                {plan?.status === "draft" ? "draft" : "saved"} plan.
              </p>
              {needs.slice(0, 5).map((need, index) => (
                <button
                  className="kitchen-shopping-row"
                  key={`${need.name}:${index}`}
                  onClick={onPlan}
                >
                  <ShoppingBasket size={19} />
                  <span>
                    <strong>{need.name}</strong>
                    <small>
                      {need.servings === null
                        ? "Check your pantry quantity first"
                        : formatIngredientAmount(
                            need.servings,
                            need.servingLabel,
                          )}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
              {needs.length > 5 && (
                <button className="kitchen-text-action" onClick={onPlan}>
                  See all {needs.length} items <ArrowRight size={16} />
                </button>
              )}
            </>
          ) : (
            <p className="kitchen-shopping-empty">
              {planned.length
                ? "Your saved pantry amounts cover the ingredients in these planned meals."
                : "Build a meal plan and we’ll show the ingredients you still need, after checking your pantry."}
            </p>
          )}
        </section>

        <section className="kitchen-section" aria-label="Recent grocery trips">
          <div className="kitchen-heading">
            <h2>Recent grocery trips</h2>
          </div>
          {receipts.length ? (
            receipts.slice(0, 3).map((receipt) => (
              <button
                className="kitchen-row"
                key={receipt.id}
                onClick={() => onReceipt(receipt.id)}
              >
                <span className="kitchen-item-icon">
                  <ReceiptText size={22} />
                </span>
                <span>
                  <strong>{receipt.store || "Grocery receipt"}</strong>
                  <small>
                    {receipt.purchase?.purchaseDate?`Purchased ${displayCalendarDate(receipt.purchase.purchaseDate)}`:`Captured ${displayCalendarDate(receipt.date)}`} ·{" "}
                    {
                      receipt.items.filter((item) => item.match !== "nonfood")
                        .length
                    }{" "}
                    food items
                  </small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))
          ) : (
            <p className="kitchen-subtitle">
              Your receipts will live here, ready when you need them.
            </p>
          )}
        </section>
        <button
          className="kitchen-chat-return"
          onClick={onAddReceipt}
        >
          <PlateMark />
          <span>Just got groceries? Show me what you picked up.</span>
          <ArrowRight size={19} />
        </button>
      </div>
      <FuelTabs active="Kitchen" onNavigate={onNavigate} onScan={onScan} />
    </section>
  );
}
