import { useWelcome } from "./Onboarding";
import { FirstWeek } from "./FirstWeek";
import { BodyWeightHistory } from "./BodyWeightHistory";
import { FitnessSetup } from './FitnessSetup';
import { NutritionSetup } from './NutritionSetup';
import { applyNutritionSetup } from '../../src/features/progress/nutrition-setup';
import { QuickAccount } from './QuickAccount';
import { applyFitnessSetup } from '../../src/features/progress/fitness-goal';
import { SupportAndPrivacy } from "./SupportAndPrivacy";
import { getSupportUrl } from "./api";
import { SpotMoment, SpotWeeklyReview } from "./Spot";
import { useState, useRef } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Plus } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { useHealth } from "./store";
import {
  Button,
  Card,
  IconButton,
  Row,
  Screen,
  Choice,
  Field,
  Sheet,
  colors,
  s,
} from "./ui";
import { isCalendarDate } from "../../src/features/pantry/date-contract";
import { type Meal, personalMeals, sumNutrition, id, today } from "../../src/domain";
import { nutritionInsights } from "../../src/features/insights/insights";
import { weeklyReview } from "../../src/features/reviews/weekly-review";
import { getPantryLots } from "../../src/features/pantry/ledger";
import { remainingRecipePortions } from "../../src/features/recipes/portions";
import { shiftPlanDate } from "../../src/features/planning/recurring-plans";
import {
  receiptSpending,
  formatMoney,
  purchaseReceipts,
} from "../../src/features/shopping/shopping";
import { MealEditor } from "./tools";
import { ManualMeal } from "./ManualMeal";
export function NutritionScreen() {
  const dayStrip = useRef<ScrollView>(null);
  const h = useHealth(),
    state = h.state!;
  const [date, setDate] = useState<string | null>(null),
    [browseDate, setBrowseDate] = useState(h.day),
    [browsing, setBrowsing] = useState(false),
    [week, setWeek] = useState(false),
    [edit, setEdit] = useState<Meal | null>(null),
    [manual, setManual] = useState<Meal | true | null>(null);
  const selected = date ?? h.day,
    totals = sumNutrition(state.meals, selected),
    meals = personalMeals(state.meals, selected),
    remaining = state.profile.calories - totals.calories;
  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <Text style={s.eyebrow}>YOUR NUTRITION</Text>
        <Text style={s.title}>A little more in tune with your day.</Text>
        <Text style={s.muted}>Your meals, your rhythm. One day at a time.</Text>
      </View>
      <Choice
        values={["Day", "Week"]}
        value={week ? "Week" : "Day"}
        onChange={(v) => setWeek(v === "Week")}
      />
      <ScrollView
        ref={dayStrip}
        horizontal
        onContentSizeChange={() => {
          if (selected === h.day)
            dayStrip.current?.scrollToEnd({ animated: false });
        }}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 9 }}
      >
        {Array.from({ length: 7 }, (_, i) => shiftPlanDate(h.day, i - 6)).map(
          (d) => (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={d === h.day ? "Today" : d}
              accessibilityState={{ selected: d === selected }}
              onPress={() => setDate(d === h.day ? null : d)}
              style={[
                s.pill,
                { backgroundColor: d === selected ? colors.mint : colors.wash },
              ]}
            >
              <Text style={s.muted}>
                {d === h.day
                  ? "Today"
                  : new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                    })}
              </Text>
            </Pressable>
          ),
        )}
      </ScrollView>
      <Button
        label="Choose another date"
        secondary
        onPress={() => setBrowsing(!browsing)}
      />
      {browsing && (
        <>
          <Field
            label="Browse meal date (YYYY-MM-DD)"
            value={browseDate}
            onChangeText={setBrowseDate}
          />
          <Button
            label="Show this day"
            secondary
            disabled={!isCalendarDate(browseDate) || browseDate > h.day}
            onPress={() => {
              setDate(browseDate);
              setBrowsing(false);
            }}
          />
        </>
      )}
      <Card mint>
        <Text style={s.h2}>
          {selected === h.day ? "Today’s nutrition" : selected}
        </Text>
        {state.profile.targetsConfigured ? (
          <Text style={s.muted}>
            {Math.abs(remaining).toLocaleString()} calories{" "}
            {remaining >= 0 ? "left" : "above target"}
          </Text>
        ) : (
          <Text style={s.muted}>
            Recorded nutrition · daily targets are optional
          </Text>
        )}
        <View style={s.row}>
          <View
            style={{
              width: 126,
              height: 132,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Svg width={126} height={132} style={{ position: "absolute" }}>
              <Circle
                cx={63}
                cy={66}
                r={55}
                stroke="#c9e7db"
                strokeWidth={11}
                fill="none"
              />
              <Circle
                cx={63}
                cy={66}
                r={55}
                stroke={colors.green}
                strokeWidth={11}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${state.profile.targetsConfigured ? Math.min(totals.calories / state.profile.calories, 1) * 346 : 0} 346`}
                transform="rotate(-90 63 66)"
              />
            </Svg>
            <Text style={[s.h2, { fontSize: 26 }]}>
              {Math.round(totals.calories).toLocaleString()}
            </Text>
            <Text style={s.tiny}>
              {state.profile.targetsConfigured
                ? `of ${state.profile.calories} cal`
                : "cal recorded"}
            </Text>
          </View>
          <View style={[s.grow, { gap: 13 }]}>
            {(["protein", "carbs", "fat"] as const).map((k) => (
              <View key={k} style={{ gap: 5 }}>
                <Text style={s.muted}>
                  {k === "fat" ? "Fats" : k[0].toUpperCase() + k.slice(1)} ·{" "}
                  {Math.round(totals[k])}
                  {state.profile.targetsConfigured
                    ? `/${state.profile[k]}`
                    : ""}
                  g
                </Text>
                {state.profile.targetsConfigured && (
                  <View
                    style={{
                      height: 6,
                      backgroundColor: "#dce7e2",
                      borderRadius: 8,
                    }}
                  >
                    <View
                      style={{
                        height: 6,
                        width: `${Math.min(totals[k] / state.profile[k], 1) * 100}%`,
                        backgroundColor: "#61ac91",
                        borderRadius: 8,
                      }}
                    />
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Your daily targets"
          onPress={() => h.setTool("profile")}
        >
          <Text style={[s.tiny, { color: colors.green }]}>
            {state.profile.targetsConfigured
              ? "Your chosen daily targets →"
              : "Sample targets — choose your own →"}
          </Text>
        </Pressable>
      </Card>
      {week && (
        <Card>
          <Text style={s.h3}>This week, as logged</Text>
          {Array.from({ length: 7 }, (_, i) => shiftPlanDate(h.day, i - 6)).map(
            (d) => (
              <View key={d} style={s.between}>
                <Text style={s.muted}>{d}</Text>
                <Text style={s.text}>
                  {personalMeals(state.meals, d).length
                    ? `${Math.round(sumNutrition(state.meals, d).calories)} cal`
                    : "Not logged"}
                </Text>
              </View>
            ),
          )}
        </Card>
      )}
      <View style={s.between}>
        <Text style={s.h2}>
          {selected === h.day ? "Today’s meals" : "Your meals"}
        </Text>
        <IconButton
          label="Log a meal"
          onPress={() => {
            h.setCaptureDay(selected);
            h.setTab("Chat");
          }}
        >
          <Plus color={colors.green} />
        </IconButton>
      </View>
      <Button
        label="Enter meal manually"
        secondary
        onPress={() => setManual(true)}
      />
      {!meals.length && (
        <Card>
          <SpotMoment moment="emptyFood" />
          <Text style={s.h2}>Nothing here yet.</Text>
          <Text style={s.muted}>Tell Spot what you ate.</Text>
          <Button
            label="Tell Spot"
            onPress={() => {
              h.setCaptureDay(selected);
              h.setTab("Chat");
            }}
          />
        </Card>
      )}
      {(["Breakfast", "Lunch", "Dinner", "Snack"] as const)
        .filter((c) => meals.some((m) => m.category === c))
        .map((c) => (
          <View key={c} style={{ gap: 10 }}>
            <Text style={[s.h3, { color: colors.green }]}>{c}</Text>
            {meals
              .filter((m) => m.category === c)
              .map((m) => (
                <Pressable
                  key={m.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${m.title}`}
                  onPress={() => setEdit(m)}
                >
                  <Card>
                    <Text style={s.h3}>{m.title}</Text>
                    <Text style={s.muted}>
                      {m.time} · {m.confidence}
                    </Text>
                    <Text style={[s.text, { color: colors.green }]}>
                      {Math.round(m.calories)} cal · {m.protein}g protein
                    </Text>
                  </Card>
                </Pressable>
              ))}
          </View>
        ))}
      <Text style={s.h2}>What we’re learning</Text>
      {nutritionInsights(state, h.day).map((insight) => (
        <Card key={insight.title}>
          <Text style={s.h3}>{insight.title}</Text>
          <Text style={s.muted}>{insight.description}</Text>
          <Text style={s.tiny}>{insight.evidence}</Text>
        </Card>
      ))}
      <Button
        label="Plan meals from your pantry"
        secondary
        onPress={() => h.setTool("planner")}
      />
      {edit && (
        <MealEditor
          meal={edit}
          onClose={() => setEdit(null)}
          onSaved={(day) => {
            setDate(day);
            setBrowseDate(day);
          }}
          onRepeat={() => {
            setManual(edit);
            setEdit(null);
          }}
        />
      )}
      {manual && (
        <ManualMeal
          day={selected}
          source={manual === true ? undefined : manual}
          onClose={() => setManual(null)}
          onSaved={(day) => {
            setDate(day);
            setBrowseDate(day);
          }}
        />
      )}
    </Screen>
  );
}
export function KitchenScreen() {
  const h = useHealth(),
    state = h.state!,
    lots = getPantryLots(state).filter(
      (l) =>
        l.item.availability !== "used" &&
        (l.remaining === null || l.remaining > 0),
    ),
    batches =
      state.recipeBatches?.filter((b) => remainingRecipePortions(b) > 0) ?? [],
    spending = receiptSpending(state.groceries ?? []);
  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <Text style={s.eyebrow}>YOUR KITCHEN</Text>
        <Text style={s.title}>What sounds good tonight?</Text>
        <Text style={s.muted}>
          What you have. What you can make. A little less to figure out.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Explore your meal plan"
        onPress={() => h.setTool("planner")}
      >
        <Card mint>
          <Text style={s.eyebrow}>MAKE SOMETHING GOOD</Text>
          <Text style={s.h2}>A little inspiration for your next meal.</Text>
          <Text style={[s.text, { color: colors.green }]}>
            Explore your meal plan →
          </Text>
        </Card>
      </Pressable>
      <View style={s.row}>
        <View style={s.grow}>
          <Button
            label="Scan a food"
            secondary
            onPress={() => h.setTool("scan")}
          />
        </View>
        <View style={s.grow}>
          <Button
            label="Add a receipt"
            secondary
            onPress={() => h.setTool("receipt")}
          />
        </View>
      </View>
      <Text style={s.h2}>What you have</Text>
      <FirstWeek />
      <Card>
        <Text style={[s.title, { color: colors.green }]}>
          {lots.length} items on hand
        </Text>
        <Text style={s.muted}>
          From your grocery receipts and pantry updates
        </Text>
        {lots.slice(0, 3).map((l) => (
          <Row
            key={l.id}
            title={l.item.name}
            detail={
              l.remaining === null
                ? "Quantity needs a check"
                : `${l.remaining} servings · ${l.item.serving}`
            }
            onPress={() => h.setTool("pantry")}
          />
        ))}
        <Button
          label="Open pantry"
          secondary
          onPress={() => h.setTool("pantry")}
        />
      </Card>
      <Text style={s.h2}>What you can make</Text>
      {batches.slice(0, 3).map((b) => (
        <Card key={b.id}>
          <Text style={s.h3}>{b.name}</Text>
          <Text style={s.muted}>
            {remainingRecipePortions(b)} prepared portions left
          </Text>
        </Card>
      ))}
      <Row
        title="Recipes & leftovers"
        detail="Make once. Enjoy it again."
        onPress={() => h.setTool("recipes")}
      />
      <Row
        title="Your week of meals"
        detail="Suggestions based on your groceries and household"
        onPress={() => h.setTool("planner")}
      />
      <Card mint>
        <Text style={s.eyebrow}>GOOD FOOD. YOUR KIND OF BUDGET.</Text>
        <Text style={s.h2}>Make your next shop work for you.</Text>
        <Text style={s.muted}>
          Find swaps, keep a list, and see what you spend.
        </Text>
        <Button
          label="Swaps, list & spending"
          onPress={() => h.setTool("shopping")}
        />
        <Button
          label="Shopping preferences"
          secondary
          onPress={() => h.setTool("preferences")}
        />
      </Card>
      <Text style={s.h2}>Recent grocery trips</Text>
      {purchaseReceipts(state.groceries ?? [])
        .slice()
        .reverse()
        .slice(0, 5)
        .map((r) => (
          <Row
            key={r.id}
            title={r.store || "Grocery receipt"}
            detail={`${r.purchase?.purchaseDate ? `Purchased ${r.purchase.purchaseDate}` : `Captured ${r.date}`} · ${r.items.length} items${r.purchase?.purchaseDate && r.purchase.purchaseDate !== r.date ? ` · Captured ${r.date}` : ""}`}
            onPress={() => h.setTool("pantry")}
          />
        ))}
      {!purchaseReceipts(state.groceries ?? []).length && (
        <Text style={s.muted}>
          Your receipts will live here, ready when you need them.
        </Text>
      )}
      {Object.entries(spending.totals).map(([currency, total]) => (
        <Text key={currency} style={s.muted}>
          Reviewed receipts · {formatMoney(total, currency)}
        </Text>
      ))}
      <Button
        label="Show me what you picked up"
        secondary
        onPress={() => h.setTool("receipt")}
      />
    </Screen>
  );
}
export { NativeWorkout as WorkoutsScreen } from "./NativeWorkout";
export function YouScreen() {
  const welcome = useWelcome();
  const [editingGoal, setEditingGoal] = useState(false);
  const [editingNutrition, setEditingNutrition] = useState(false);
  const weightEntry = useRef(id());
  const h = useHealth(),
    state = h.state!,
    review = weeklyReview(state);
  return (
    <Screen>
      <Text style={s.eyebrow}>A LITTLE MORE YOU</Text>
      <Text style={s.title}>
        {state.profile.name
          ? `${state.profile.name}, this is your space.`
          : "This is your space."}
      </Text>
      <Text style={s.muted}>
        Your progress, preferences, and the little things that make this work
        for you.
      </Text>
      <QuickAccount />
      <Button label="Calorie starting point" secondary onPress={() => setEditingNutrition(true)} />
      {editingNutrition && <Sheet title="Your calorie starting point" onClose={() => setEditingNutrition(false)}><NutritionSetup baseline={state.profile.nutritionBaseline} kind={state.profile.fitnessGoal?.kind} weight={state.bodyWeights?.filter(entry => entry.day <= today()).slice().sort((a,b) => a.day.localeCompare(b.day)).at(-1)} existingTargets={state.profile.targetsConfigured ? state.profile : undefined} onSave={result => {
        applyNutritionSetup(state, result);
        if (!h.change(current => applyNutritionSetup(current, result))) throw Error('Your starting point could not be saved. Check your account and try again.');
        setEditingNutrition(false);
      }} /></Sheet>}
      <BodyWeightHistory key={state.profile.fitnessGoal?.unit ?? 'default'} onEditGoal={() => { weightEntry.current = id(); setEditingGoal(true); }} />
      {editingGoal && <Sheet title="Your goals & starting point" onClose={() => setEditingGoal(false)}><FitnessSetup goal={state.profile.fitnessGoal} weight={state.bodyWeights?.slice().sort((a, b) => a.day.localeCompare(b.day)).at(-1)} onSave={draft => {
        applyFitnessSetup(state, draft, today(), weightEntry.current);
        if (!h.change(current => applyFitnessSetup(current, draft, today(), weightEntry.current))) throw Error('Your goal could not be saved. Check your account and try again.');
        setEditingGoal(false);
      }} /></Sheet>}
      <SpotWeeklyReview />
      <Row
        title="Meet Spot"
        detail="Replay the welcome tour. Your records stay here."
        onPress={welcome.replay}
      />
      <Row
        title={
          state.spot?.visuals === false
            ? "Show Spot illustrations"
            : "Hide Spot illustrations"
        }
        detail="The same tools work either way."
        onPress={() =>
          h.change((s) => ({
            ...s,
            spot: { ...s.spot, visuals: s.spot?.visuals === false },
          }))
        }
      />
      <Card mint>
        <Text style={s.eyebrow}>THE WEEK YOU’RE BUILDING</Text>
        <Text style={s.h2}>
          {review.meals.length} meals. {review.loggedDays} days with food
          logged.
        </Text>
        <Text style={s.muted}>
          Based on what you logged. Missing days stay unknown.
        </Text>
        <Button
          label="Your weekly review"
          secondary
          onPress={() => h.setTool("review")}
        />
      </Card>
      <Row
        title="Your profile & daily targets"
        detail="Review generic starting targets and choose your own"
        onPress={() => h.setTool("profile")}
      />
      <Row
        title="Food & household preferences"
        detail="Favorites, restrictions, budget, and equipment"
        onPress={() => h.setTool("preferences")}
      />
      <Row
        title="Reviews & captured moments"
        detail={`${state.reviews.filter((r) => !r.resolved).length} items to check`}
        onPress={() => h.setTool("review")}
      />
      <Row
        title="Cloud & your records"
        detail="Bring your web records to your phone"
        onPress={() => h.setTool("cloud")}
      />
      <Row
        title="Connection"
        detail="Beta server or local development"
        onPress={() => h.setTool("connection")}
      />
      <Row
        title="Agent connections"
        detail="Choose agent access and review proposed meals"
        onPress={() => h.setTool("agents")}
      />
      <SupportAndPrivacy
        supportUrl={getSupportUrl()}
        requestIds={state.messages
          .filter((m) => m.aiStatus === "error")
          .map((m) => m.id)}
      />
    </Screen>
  );
}
