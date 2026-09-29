import { useState } from "react";
import { Text, View, Image } from "react-native";
import { Button, Card, Choice, Field, Row, Sheet, Sources, s } from "./ui";
import { useHealth } from "./store";
import { jsonApi } from "./api";
import { Scanner, pickPhoto } from "./Capture";
import { id, today, clockTime, type Meal } from "../../src/domain";
import {
  groceryItemSchema,
  type GroceryItem,
  type GroceryReceipt,
} from "../../src/ai-contract";
import {
  getPantryLots,
  updatePantryItem,
  adjustPantry,
  undoPantryAdjustment,
  mealFromPantry,
  type PantryLot,
} from "../../src/features/pantry/ledger";
import {
  pantryDateReminder,
  updatePantryDates,
} from "../../src/features/pantry/dates";
import {
  prepareRecipeBatch,
  logRecipePortion,
  undoRecipePreparation,
  remainingRecipePortions,
} from "../../src/features/recipes/batches";
import {
  nutritionForServing,
  normalizeGTIN,
  productSchema,
  type FoodProduct,
} from "../../src/features/products/contracts";
import { savePrivateProduct } from "../../src/features/products/actions";
import { productSearchResultSchema } from "../../src/features/products/search-contract";
import { receiptPurchaseSchema } from "../../src/features/shopping/contracts";
import { defaultPreferences } from "../../src/features/preferences/contracts";
import {
  validateDraftPlan,
  mealEstimate,
  mealPortionSelections,
} from "../../src/features/planning/meal-plans";
import {
  type MealPlan,
  type MealCategory,
  mealPlanSchema,
} from "../../src/features/planning/contracts";
import {
  repeatApprovedWeek,
  shiftPlanDate,
  createPlanRevision,
  editPlannedMeal,
  movePlannedMeal,
  copyMealToDay,
} from "../../src/features/planning/recurring-plans";
import {
  workoutProposalSchema,
  type WorkoutProposal,
} from "../../src/features/workout-planning/contracts";
import { completedWorkoutContext } from "../../src/features/workout-planning/history";
import { PlanIngredientLink } from './PlanIngredientLink';
import { linkPlannedIngredient, unloggedPlan } from '../../src/features/planning/pantry-links';
import { basketSummary, estimatePlanBasket } from '../../src/features/planning/basket';

export function Pantry() {
  const h = useHealth(),
    [edit, setEdit] = useState<PantryLot | null>(null),
    [receipt, setReceipt] = useState<GroceryReceipt | null>(null),
    [amount, setAmount] = useState<Record<string, string>>({}),
    [title, setTitle] = useState("Meal from my pantry"),
    [category, setCategory] = useState<Meal["category"]>("Dinner");
  const lots = getPantryLots(h.state!);
  return (
    <Sheet title="Your pantry" onClose={() => h.setTool(null)}>
      <Text style={s.muted}>
        Groceries are what you bought. Only portions you log as eaten count
        toward daily nutrition.
      </Text>
      {!lots.length && (
        <Button label="Add a receipt" onPress={() => h.setTool("receipt")} />
      )}
      <Text style={s.h2}>Your grocery trips</Text>
      {h.state!.groceries?.map((r) => (
        <Row
          key={r.id}
          title={r.store || "Grocery receipt"}
          detail={`${r.date} · Check purchase details`}
          onPress={() => setReceipt(r)}
        />
      ))}
      {lots.map((l) => (
        <Card key={l.id}>
          <Text style={s.h3}>{l.item.name}</Text>
          <Text style={s.muted}>
            {l.store} ·{" "}
            {l.remaining === null
              ? "Quantity unknown"
              : `${l.remaining} servings left`}
          </Text>
          <Text style={s.muted}>
            {l.item.serving} ·{" "}
            {l.item.nutrition
              ? `${l.item.nutrition.calories} cal, ${l.item.nutrition.protein}g protein per serving`
              : "Nutrition needs a check"}
          </Text>
          {!!pantryDateReminder(l, h.day) && (
            <Text style={s.tiny}>{pantryDateReminder(l, h.day)}</Text>
          )}
          {l.item.needsReview && (
            <Text style={s.tiny}>Review this product match and quantity.</Text>
          )}
          <Button
            label={`Review ${l.item.name}`}
            secondary
            onPress={() => setEdit(l)}
          />
          {l.remaining !== null &&
            l.remaining > 0 &&
            !l.inconsistent &&
            l.item.nutrition && (
              <Field
                label={`Servings of ${l.item.name} eaten`}
                keyboardType="decimal-pad"
                value={amount[l.id] ?? ""}
                placeholder="Leave blank if not eaten"
                onChangeText={(v) => setAmount({ ...amount, [l.id]: v })}
              />
            )}
        </Card>
      ))}
      {Object.values(amount).some(Boolean) && (
        <Card>
          <Field label="Meal name" value={title} onChangeText={setTitle} />
          <Choice
            values={["Breakfast", "Lunch", "Dinner", "Snack"]}
            value={category}
            onChange={(v) => setCategory(v as Meal["category"])}
          />
          <Button
            label="Log selected portions"
            onPress={() => {
              if (
                h.change((s) =>
                  mealFromPantry(
                    s,
                    Object.entries(amount)
                      .filter(([, v]) => v.trim())
                      .map(([lotId, v]) => ({ lotId, servings: Number(v) })),
                    id(),
                    category,
                    title,
                  ),
                )
              )
                setAmount({});
            }}
          />
        </Card>
      )}
      <Text style={s.h2}>Recent adjustments</Text>
      {h
        .state!.pantryEvents?.filter(
          (e) =>
            ["adjusted", "discarded"].includes(e.kind) &&
            !h.state!.pantryEvents!.some((x) => x.reversesId === e.id),
        )
        .slice(-5)
        .map((e) => (
          <Row
            key={e.id}
            title={e.note}
            detail={`${e.servings} servings · Undo`}
            onPress={() => h.change((s) => undoPantryAdjustment(s, e.id))}
          />
        ))}
      {edit && <PantryEditor lot={edit} onClose={() => setEdit(null)} />}
      {receipt && (
        <ReceiptEditor receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </Sheet>
  );
}
function PantryEditor({
  lot,
  onClose,
}: {
  lot: PantryLot;
  onClose: () => void;
}) {
  const h = useHealth(),
    [item, setItem] = useState(lot.item),
    [nutritionValues, setNutritionValues] = useState<Record<string, string>>(
      () =>
        Object.fromEntries(
          ["calories", "protein", "carbs", "fat"].map((k) => [
            k,
            lot.item.nutrition?.[k as "calories"]?.toString() ?? "",
          ]),
        ),
    ),
    [quantity, setQuantity] = useState(
      lot.item.servingsPurchased?.toString() ?? "",
    ),
    [remaining, setRemaining] = useState(lot.remaining?.toString() ?? ""),
    [query, setQuery] = useState(lot.item.name),
    [products, setProducts] = useState<FoodProduct[]>(
      lot.item.productCandidates ?? [],
    ),
    [scan, setScan] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [checked, setChecked] = useState(false),
    [dates, setDates] = useState(
      lot.item.pantryDates ?? {
        labelKind: "best-before" as const,
        labelDate: null,
        openedDate: null,
      },
    );
  const match = (p: FoodProduct) => {
    setScan(false);
    setQuantity("");
    setChecked(false);
    const converted = nutritionForServing(p);
    setNutritionValues(
      Object.fromEntries(
        ["calories", "protein", "carbs", "fat"].map((k) => [
          k,
          converted?.[k as "calories"]?.toString() ?? "",
        ]),
      ),
    );
    setItem({
      ...item,
      name: p.name.slice(0, 200),
      serving: p.serving.label.slice(0, 150),
      nutrition: nutritionForServing(p),
      productSnapshot: p,
      match: "user",
      needsReview: !nutritionForServing(p),
      sources: p.source.url
        ? [{ title: "Product nutrition source", url: p.source.url }]
        : [],
    });
  };
  return (
    <Sheet title="Check this grocery item" onClose={onClose}>
      <Field
        label="Product name"
        value={item.name}
        onChangeText={(v) => {
          setItem({
            ...item,
            name: v,
            productSnapshot: undefined,
            sources: [],
          });
          setChecked(false);
        }}
      />
      <Field
        label="Search USDA for this item"
        value={query}
        onChangeText={setQuery}
      />
      <Button
        label="Search products"
        disabled={busy}
        onPress={() =>
          void (async () => {
            setBusy(true);
            try {
              const r = productSearchResultSchema.parse(
                await jsonApi("/api/products/search", { query }),
              );
              setProducts(r.products);
              setError(r.message);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          })()
        }
      />
      <Button
        secondary
        label="Scan this package barcode"
        onPress={() => setScan(true)}
      />
      {!!error && <Text style={s.muted}>{error}</Text>}
      {products.map((p) => (
        <Row
          key={p.id}
          title={p.name}
          detail={`${p.brand} · ${p.serving.label}`}
          onPress={() => match(p)}
        />
      ))}
      <Field
        label="Serving description"
        value={item.serving}
        onChangeText={(v) =>
          setItem({
            ...item,
            serving: v,
            productSnapshot: undefined,
            sources: [],
          })
        }
      />
      <Field
        label="Total labeled servings purchased"
        value={quantity}
        onChangeText={(v) => {
          setQuantity(v);
          setChecked(false);
        }}
        keyboardType="decimal-pad"
      />
      <Text style={s.tiny}>
        Count servings across the whole purchase. Leave blank if unknown.
      </Text>
      {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
        <Field
          key={k}
          label={`${k} per serving`}
          value={nutritionValues[k]}
          keyboardType="decimal-pad"
          onChangeText={(v) => {
            setNutritionValues({ ...nutritionValues, [k]: v });
            setItem({ ...item, productSnapshot: undefined, sources: [] });
            setChecked(false);
          }}
        />
      ))}
      <Sources sources={item.sources} />
      <Text style={s.h3}>Dates on your package</Text>
      <Choice
        values={["best-before", "use-by"]}
        value={dates.labelKind}
        onChange={(v) =>
          setDates({ ...dates, labelKind: v as typeof dates.labelKind })
        }
      />
      <Field
        label="Package date (YYYY-MM-DD, optional)"
        value={dates.labelDate ?? ""}
        onChangeText={(v) => setDates({ ...dates, labelDate: v || null })}
      />
      <Field
        label="Opened date (YYYY-MM-DD, optional)"
        value={dates.openedDate ?? ""}
        onChangeText={(v) => setDates({ ...dates, openedDate: v || null })}
      />
      <Button
        secondary
        label="Save package dates"
        onPress={() =>
          h.change((s) =>
            updatePantryDates(s, lot.receiptId, lot.item.id, dates),
          )
        }
      />
      <Text style={s.tiny}>
        Dates are reminders, not a food safety assessment.
      </Text>
      <Choice
        values={["available", "used"]}
        value={item.availability}
        onChange={(v) =>
          setItem({ ...item, availability: v as GroceryItem["availability"] })
        }
      />
      <Button
        label={
          checked
            ? "✓ Package details checked"
            : "I checked the product, serving and quantity"
        }
        secondary
        onPress={() => setChecked(!checked)}
      />
      <Button
        label="Save grocery details"
        disabled={!checked}
        onPress={() => {
          if (
            h.change((s) =>
              updatePantryItem(
                s,
                lot.receiptId,
                groceryItemSchema.parse({
                  ...item,
                  nutrition: Object.values(nutritionValues).every((v) =>
                    v.trim(),
                  )
                    ? Object.fromEntries(
                        Object.entries(nutritionValues).map(([k, v]) => [
                          k,
                          Number(v),
                        ]),
                      )
                    : null,
                  servingsPurchased: quantity.trim() ? Number(quantity) : null,
                  needsReview:
                    !Object.values(nutritionValues).every((v) => v.trim()) ||
                    !quantity.trim(),
                  match: "user",
                }),
              ),
            )
          )
            onClose();
        }}
      />
      {lot.remaining !== null && (
        <Card>
          <Field
            label="Counted servings remaining"
            value={remaining}
            onChangeText={setRemaining}
            keyboardType="decimal-pad"
          />
          <Button
            secondary
            label="Update remaining amount"
            onPress={() => {
              if (
                h.change((s) =>
                  adjustPantry(s, lot.id, Number(remaining), id()),
                )
              )
                onClose();
            }}
          />
          <Button
            secondary
            label="Record discarded amount"
            onPress={() => {
              if (
                h.change((s) =>
                  adjustPantry(s, lot.id, Number(remaining), id(), "discarded"),
                )
              )
                onClose();
            }}
          />
        </Card>
      )}
      {scan && <Scanner onClose={() => setScan(false)} onSelect={match} />}
    </Sheet>
  );
}
export function ReceiptEditor({
  receipt,
  onClose,
}: {
  receipt: GroceryReceipt;
  onClose: () => void;
}) {
  const h = useHealth(),
    [store, setStore] = useState(receipt.store),
    [date, setDate] = useState(receipt.purchase?.purchaseDate ?? ""),
    [currency, setCurrency] = useState(receipt.purchase?.currency ?? "USD"),
    [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        ["subtotal", "tax", "discount", "total"].map((k) => [
          k,
          receipt.purchase?.[k as "total"]?.toString() ?? "",
        ]),
      ),
    ),
    [prices, setPrices] = useState<Record<string, string>>(() =>
      Object.fromEntries(
        receipt.items.map((i) => [i.id, i.price?.total?.toString() ?? ""]),
      ),
    ),
    [checked, setChecked] = useState(false);
  return (
    <Sheet title="Check purchase details" onClose={onClose}>
      <Text style={s.muted}>
        Review amounts against your receipt. Blank values remain unknown.
      </Text>
      <Field label="Store" value={store} onChangeText={setStore} />
      <Field
        label="Purchase date (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
      />
      <Field
        label="Currency"
        value={currency}
        onChangeText={(v) => setCurrency(v.toUpperCase())}
        maxLength={3}
      />
      {Object.keys(values).map((k) => (
        <Field
          key={k}
          label={k}
          value={values[k]}
          onChangeText={(v) => {
            setValues({ ...values, [k]: v });
            setChecked(false);
          }}
          keyboardType="decimal-pad"
        />
      ))}
      {receipt.items.map((i) => (
        <Field
          key={i.id}
          label={`${i.name} — total paid`}
          value={prices[i.id]}
          onChangeText={(v) => {
            setPrices({ ...prices, [i.id]: v });
            setChecked(false);
          }}
          keyboardType="decimal-pad"
        />
      ))}
      <Button
        secondary
        label={
          checked ? "✓ Receipt checked" : "I checked these receipt details"
        }
        onPress={() => setChecked(!checked)}
      />
      <Button
        label="Save receipt details"
        disabled={!checked}
        onPress={() => {
          if (
            h.change((s) => ({
              ...s,
              groceries: s.groceries?.map((r) =>
                r.id === receipt.id
                  ? {
                      ...r,
                      store,
                      purchase: receiptPurchaseSchema.parse({
                        ...Object.fromEntries(
                          Object.entries(values).map(([k, v]) => [
                            k,
                            v.trim() ? Number(v) : null,
                          ]),
                        ),
                        purchaseDate: date || null,
                        currency: currency || null,
                        confirmed: true,
                      }),
                      items: r.items.map((i) => ({
                        ...i,
                        price: {
                          total: prices[i.id]?.trim()
                            ? Number(prices[i.id])
                            : null,
                          discount: i.price?.discount ?? null,
                        },
                      })),
                    }
                  : r,
              ),
            }))
          )
            onClose();
        }}
      />
    </Sheet>
  );
}
export function Recipes() {
  const h = useHealth(),
    [name, setName] = useState(""),
    [portions, setPortions] = useState("4"),
    [amounts, setAmounts] = useState<Record<string, string>>({}),
    [eat, setEat] = useState<Record<string, string>>({}),
    [category, setCategory] = useState<Meal["category"]>("Dinner");
  const lots = getPantryLots(h.state!).filter(
    (l) =>
      l.remaining !== null &&
      l.remaining > 0 &&
      l.item.nutrition &&
      !l.inconsistent,
  );
  return (
    <Sheet title="Recipes & leftovers" onClose={() => h.setTool(null)}>
      <Text style={s.muted}>
        Preparing a batch moves ingredients out of your pantry. Log only the
        portions you eat.
      </Text>
      {h
        .state!.recipeBatches?.filter((b) => !b.undoneAt)
        .map((b) => (
          <Card key={b.id}>
            <Text style={s.h2}>{b.name}</Text>
            <Text style={s.muted}>
              {remainingRecipePortions(b)} portions remain ·{" "}
              {Math.round(b.nutrition.calories / b.totalPortions)} cal per
              portion
            </Text>
            <Field
              label={`Portions of ${b.name} eaten`}
              value={eat[b.id] ?? "1"}
              onChangeText={(v) => setEat({ ...eat, [b.id]: v })}
              keyboardType="decimal-pad"
            />
            <Choice
              values={["Breakfast", "Lunch", "Dinner", "Snack"]}
              value={category}
              onChange={(v) => setCategory(v as Meal["category"])}
            />
            <Button
              label={`Log ${b.name} portion`}
              onPress={() =>
                h.change((s) =>
                  logRecipePortion(
                    s,
                    b.id,
                    Number(eat[b.id] ?? "1"),
                    category,
                    id(),
                  ),
                )
              }
            />
            <Button
              secondary
              label="Undo preparation"
              onPress={() => h.change((s) => undoRecipePreparation(s, b.id))}
            />
          </Card>
        ))}
      <Text style={s.h2}>Prepare a batch</Text>
      <Field label="Recipe name" value={name} onChangeText={setName} />
      <Field
        label="Total portions this makes"
        value={portions}
        onChangeText={setPortions}
        keyboardType="decimal-pad"
      />
      {lots.map((l) => (
        <Field
          key={l.id}
          label={`${l.item.name} (${l.remaining} × ${l.item.serving} available)`}
          value={amounts[l.id] ?? ""}
          onChangeText={(v) => setAmounts({ ...amounts, [l.id]: v })}
          keyboardType="decimal-pad"
          placeholder="Servings used in whole batch"
        />
      ))}
      {!lots.length && (
        <Text style={s.muted}>
          Confirm pantry nutrition and quantities to prepare a batch.
        </Text>
      )}
      <Button
        label="Prepare recipe batch"
        disabled={!name.trim() || !lots.length}
        onPress={() => {
          if (
            h.change((s) =>
              prepareRecipeBatch(s, {
                id: id(),
                name,
                totalPortions: Number(portions),
                ingredients: Object.entries(amounts)
                  .filter(([, v]) => v.trim())
                  .map(([lotId, v]) => ({ lotId, servings: Number(v) })),
              }),
            )
          ) {
            setName("");
            setAmounts({});
          }
        }}
      />
    </Sheet>
  );
}
export function Planner() {
  const h = useHealth(),
    [plan, setPlan] = useState<MealPlan | undefined>(
      h.state!.mealPlans?.at(-1),
    ),
    [start, setStart] = useState(today()),
    [categories, setCategories] = useState<MealCategory[]>(["Dinner"]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lots = getPantryLots(h.state!),
    preferences = h.state!.preferences ?? defaultPreferences(),
    context = {
      lots,
      preferences,
      goals: h.state!.profile,
      startDate: start,
      mealCategories: categories,
    };
  const basket=plan?basketSummary(estimatePlanBasket(unloggedPlan(plan,h.state!.meals.map(meal=>meal.id)),lots,h.state!.groceries??[],today()),preferences.weeklyBudget,preferences.shoppingCurrency):undefined;
  const editMeal = (
    mealId: string,
    patch: Parameters<typeof editPlannedMeal>[2],
  ) => {
    if (!plan) return;
    try {
      const revision = createPlanRevision(plan);
      setPlan(editPlannedMeal(revision.plan, revision.mealIds[mealId], patch));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const save = (status: MealPlan["status"]) => {
    if (!plan) return;
    try {
      const checked = validateDraftPlan(plan, {
        ...context,
        startDate: plan.days[0].date,
      }, {enforceHousehold:false,enforceCategories:false});
      if (
        h.change((s) => ({
          ...s,
          mealPlans: [
            ...(s.mealPlans ?? []).filter((p) => p.id !== plan.id),
            { ...checked, status },
          ],
        }))
      )
        setPlan({ ...checked, status });
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Sheet title="Your week of meals" onClose={() => h.setTool(null)}>
      <Field
        label="Week starts (YYYY-MM-DD)"
        value={start}
        onChangeText={setStart}
      />
      <Text style={s.muted}>
        Plan for {preferences.householdSize} people using your preferences and
        pantry.
      </Text>
      <View style={{ gap: 8 }}>
        {(["Breakfast", "Lunch", "Dinner", "Snack"] as const).map((c) => (
          <Button
            key={c}
            secondary
            label={`${categories.includes(c) ? "✓ " : ""}${c}`}
            onPress={() =>
              setCategories((v) =>
                v.includes(c)
                  ? v.length > 1
                    ? v.filter((x) => x !== c)
                    : v
                  : [...v, c],
              )
            }
          />
        ))}
      </View>
      <Button
        label={busy ? "Planning your week…" : "Generate meal plan"}
        disabled={busy}
        onPress={() =>
          void (async () => {
            setBusy(true);
            setError("");
            try {
              setPlan(
                validateDraftPlan(
                  await jsonApi("/api/plans/meals", context),
                  context,
                ),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          })()
        }
      />
      {!!error && <Text style={s.muted}>{error}</Text>}
      {h.state!.mealPlans?.map((p) => (
        <Row
          key={p.id}
          title={`${p.days[0].date} · ${p.status}`}
          onPress={() => setPlan(p)}
        />
      ))}
      {plan && (
        <>
          <Text style={s.h3}>
            {plan.status === "draft" ? "Review your draft" : "Your saved plan"}
          </Text>
          {plan.days.map((d) => (
            <View key={d.date} style={{ gap: 12 }}>
              <Text style={s.h2}>{d.date}</Text>
              {d.meals.map((m) => {
                const estimate = mealEstimate(m, lots),
                  selections = mealPortionSelections(m, lots),
                  logged = h.state!.meals.some(
                    (x) => x.id === `pantry-meal:plan:${plan.id}:${m.id}`,
                  );
                return (
                  <Card key={m.id}>
                    <Field
                      label="Planned meal title"
                      value={m.title}
                      onChangeText={(title) => editMeal(m.id, { title })}
                    />
                    <Choice
                      values={["Breakfast", "Lunch", "Dinner", "Snack"]}
                      value={m.category ?? "Dinner"}
                      onChange={(category) =>
                        editMeal(m.id, { category: category as MealCategory })
                      }
                    />
                    <Field
                      label={`Portions for ${m.title}`}
                      value={String(m.portions)}
                      keyboardType="number-pad"
                      onChangeText={(v) => {
                        if (Number(v) > 0)
                          editMeal(m.id, { portions: Number(v) });
                      }}
                    />
                    <Text style={s.muted}>
                      {m.category ?? "Dinner"} · {m.portions} portions ·{" "}
                      {m.minutes ?? "?"} min
                    </Text>
                    {m.ingredients.map((x, i) => (
                      <View key={i} style={{gap:8}}><Text style={s.muted}>
                        {x.name} · {x.servings} × {x.servingLabel}
                      </Text>{!logged&&<PlanIngredientLink ingredient={x} lots={lots} preferences={preferences} onLink={(lotId,amount)=>{try{setPlan(linkPlannedIngredient(plan,m.id,i,lotId,amount,{lots,preferences,loggedMealIds:h.state!.meals.map(meal=>meal.id),confirmed:true}));setError('');}catch(cause){setError((cause as Error).message);}}}/>}</View>
                    ))}
                    <Text style={s.muted}>
                      {estimate.known
                        ? `${estimate.complete ? "~" : "At least "}${Math.round(estimate.totals.calories)} cal per portion`
                        : "Nutrition needs ingredient matches"}
                    </Text>
                    <Field
                      label={`Notes for ${m.title}`}
                      value={m.notes}
                      onChangeText={(notes) => editMeal(m.id, { notes })}
                    />
                    <PlanMove
                      plan={plan}
                      mealId={m.id}
                      currentDay={d.date}
                      onChange={setPlan}
                      onError={setError}
                    />
                    <Button
                      secondary
                      label={logged ? "Portion logged" : "Log one portion"}
                      disabled={
                        plan.status !== "approved" || !selections || logged
                      }
                      onPress={() =>
                        h.change((s) =>
                          mealFromPantry(
                            s,
                            mealPortionSelections(m, getPantryLots(s)) ?? [],
                            `plan:${plan.id}:${m.id}`,
                            m.category ?? "Dinner",
                            m.title,
                          ),
                        )
                      }
                    />
                  </Card>
                );
              })}
            </View>
          ))}
          <Button label="Save draft" secondary onPress={() => save("draft")} />
          {basket&&<Card><Text style={s.h3}>Basket cost coverage</Text><Text style={s.muted}>{basket.amount}</Text><Text style={s.muted}>{basket.coverage}{basket.budgetText}</Text><Text style={s.tiny}>{basket.note}</Text></Card>}
          <Button label="Approve plan" onPress={() => save("approved")} />
          <Button
            label="Repeat next week as draft"
            secondary
            disabled={plan.status !== "approved"}
            onPress={() => {
              try {
                setPlan(
                  repeatApprovedWeek(plan, shiftPlanDate(plan.days[0].date, 7)),
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <Button
            label="Review shopping list"
            secondary
            onPress={() => h.setTool("shopping")}
          />
        </>
      )}
    </Sheet>
  );
}
export function WorkoutBuilder() {
  const h = useHealth(),
    [goal, setGoal] = useState(h.state!.preferences?.workoutPreferences ?? ""),
    [equipment, setEquipment] = useState(
      h.state!.preferences?.equipment.join(", ") ?? "Bodyweight",
    ),
    [minutes, setMinutes] = useState("30"),
    [plan, setPlan] = useState<WorkoutProposal | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Sheet title="A workout for you" onClose={() => h.setTool(null)}>
      <Field
        label="What would you like to work on?"
        value={goal}
        onChangeText={setGoal}
        multiline
      />
      <Field
        label="Available equipment"
        value={equipment}
        onChangeText={setEquipment}
      />
      <Field
        label="Minutes available"
        value={minutes}
        onChangeText={setMinutes}
        keyboardType="number-pad"
      />
      <Button
        label={busy ? "Building your session…" : "Create workout"}
        disabled={busy}
        onPress={() =>
          void (async () => {
            setBusy(true);
            try {
              setPlan(
                workoutProposalSchema.parse(
                  await jsonApi("/api/plans/workout", {
                    goal,
                    equipment,
                    minutes: Number(minutes),
                    history: completedWorkoutContext(h.state!.workout),
                  }),
                ),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          })()
        }
      />
      {!!error && <Text style={s.muted}>{error}</Text>}
      {plan && (
        <>
          <Text style={s.h2}>{plan.title}</Text>
          <Text style={s.muted}>{plan.reason}</Text>
          {plan.exercises.map((e, i) => (
            <Card key={i}>
              <Field
                label="Exercise"
                value={e.name}
                onChangeText={(name) =>
                  setPlan({
                    ...plan,
                    exercises: plan.exercises.map((x, j) =>
                      i === j ? { ...x, name } : x,
                    ),
                  })
                }
              />
              <Text style={s.muted}>
                {e.sets} × {e.reps} · {e.note}
              </Text>
            </Card>
          ))}
          <Button
            label="Start this workout"
            disabled={h.state!.workout.status === "active"}
            onPress={() => {
              if (
                h.change((s) => {
                  const checked = workoutProposalSchema.parse(plan);
                  if (s.workout.status === "active")
                    throw new Error("Finish your active workout first.");
                  return {
                    ...s,
                    workout: {
                      status: "active",
                      planId: "personalized",
                      title: checked.title,
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
                      exercises: checked.exercises.map((e) => ({
                        name: e.name,
                        weight: 0,
                        target: e.reps,
                        previous: [],
                        sets: Array(e.sets).fill(null),
                      })),
                      conversation: [
                        {
                          id: id(),
                          role: "assistant",
                          time: clockTime(),
                          text:
                            checked.reason +
                            " Choose comfortable weights before your first set.",
                        },
                      ],
                    },
                  };
                })
              ) {
                h.setTool(null);
                h.setTab("Workouts");
              }
            }}
          />
        </>
      )}
    </Sheet>
  );
}
export function Label() {
  const h = useHealth(),
    [barcode, setBarcode] = useState(h.labelBarcode),
    [name, setName] = useState(""),
    [brand, setBrand] = useState(""),
    [serving, setServing] = useState(""),
    [amount, setAmount] = useState(""),
    [unit, setUnit] = useState("g"),
    [basis, setBasis] = useState<FoodProduct["basis"]>("serving"),
    [ingredients, setIngredients] = useState(""),
    [values, setValues] = useState<Record<string, string>>({
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
    }),
    [image, setImage] = useState(""),
    [checked, setChecked] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function photo(camera: boolean) {
    setBusy(true);
    try {
      const gtin = normalizeGTIN(barcode);
      if (!gtin) throw new Error("Enter the package barcode first.");
      const data = await pickPhoto(camera);
      if (!data) return;
      setImage(data);
      const p = productSchema.parse(
        await jsonApi("/api/products/label", { barcode: gtin, image: data }),
      );
      setName(p.name);
      setBrand(p.brand);
      setServing(p.serving.label);
      setAmount(p.serving.amount?.toString() ?? "");
      setUnit(p.serving.unit);
      setBasis(p.basis);
      setIngredients(p.ingredients);
      setValues(
        Object.fromEntries(
          Object.entries(p.nutrition).map(([k, v]) => [k, v?.toString() ?? ""]),
        ),
      );
      setChecked(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title="Check your nutrition label" onClose={() => h.setTool(null)}>
      <Field
        label="Package barcode"
        value={barcode}
        onChangeText={setBarcode}
        keyboardType="number-pad"
      />
      <Button
        label="Photograph label"
        disabled={busy}
        onPress={() => void photo(true)}
      />
      <Button
        label="Choose label photo"
        disabled={busy}
        secondary
        onPress={() => void photo(false)}
      />
      {!!image && (
        <Image
          source={{ uri: image }}
          style={{ height: 230, width: "100%" }}
          resizeMode="contain"
        />
      )}
      {!!error && <Text style={s.muted}>{error}</Text>}
      <Field label="Product name" value={name} onChangeText={setName} />
      <Field label="Brand" value={brand} onChangeText={setBrand} />
      <Field
        label="Serving on label"
        value={serving}
        onChangeText={setServing}
      />
      <Field
        label="Serving amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <Choice
        values={["g", "ml", "piece", "oz"]}
        value={unit}
        onChange={setUnit}
      />
      <Choice
        values={["serving", "100g", "100ml"]}
        value={basis}
        onChange={(v) => setBasis(v as FoodProduct["basis"])}
      />
      {Object.keys(values).map((k) => (
        <Field
          key={k}
          label={`${k} (${basis})`}
          value={values[k]}
          onChangeText={(v) => {
            setValues({ ...values, [k]: v });
            setChecked(false);
          }}
          keyboardType="decimal-pad"
        />
      ))}
      <Text style={s.tiny}>
        Leave unreadable values blank. Zero means the label says zero.
      </Text>
      <Field
        label="Ingredients"
        multiline
        value={ingredients}
        onChangeText={setIngredients}
      />
      <Button
        secondary
        label={
          checked
            ? "✓ Label checked"
            : "I checked these details against my package"
        }
        onPress={() => setChecked(!checked)}
      />
      <Button
        label="Save my label"
        disabled={!checked || busy}
        onPress={() => {
          const gtin = normalizeGTIN(barcode);
          if (!gtin) {
            setError("Check the barcode.");
            return;
          }
          if (
            h.change((s) =>
              savePrivateProduct(
                s,
                productSchema.parse({
                  id: `label-${gtin}`,
                  gtin,
                  name,
                  brand,
                  ingredients,
                  serving: {
                    label: serving,
                    amount: amount ? Number(amount) : null,
                    unit,
                  },
                  basis,
                  nutrition: Object.fromEntries(
                    Object.entries(values).map(([k, v]) => [
                      k,
                      v.trim() ? Number(v) : null,
                    ]),
                  ),
                  source: {
                    provider: "label",
                    id: gtin,
                    url: null,
                    fetchedAt: new Date().toISOString(),
                    updatedAt: null,
                    release: null,
                  },
                  verification: "user-confirmed",
                  version: new Date().toISOString(),
                }),
              ),
            )
          )
            h.setTool("scan");
        }}
      />
    </Sheet>
  );
}

function PlanMove({
  plan,
  mealId,
  currentDay,
  onChange,
  onError,
}: {
  plan: MealPlan;
  mealId: string;
  currentDay: string;
  onChange: (p: MealPlan) => void;
  onError: (s: string) => void;
}) {
  const [date, setDate] = useState(currentDay);
  return (
    <View style={{ gap: 8 }}>
      <Field label="Move or copy to day" value={date} onChangeText={setDate} />
      <Button
        secondary
        label="Move meal"
        onPress={() => {
          try {
            const r = createPlanRevision(plan);
            onChange(movePlannedMeal(r.plan, r.mealIds[mealId], date));
          } catch (e) {
            onError((e as Error).message);
          }
        }}
      />
      <Button
        secondary
        label="Copy meal"
        onPress={() => {
          try {
            onChange(copyMealToDay(plan, mealId, date).plan);
          } catch (e) {
            onError((e as Error).message);
          }
        }}
      />
    </View>
  );
}
