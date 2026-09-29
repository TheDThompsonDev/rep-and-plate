import { SpotMoment, SpotWeeklyReview } from './Spot';
import { useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { Plus, Dumbbell } from "lucide-react-native";
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
  colors,
  s,
} from "./ui";
import { type Meal, personalMeals, sumNutrition } from "../../src/domain";
import { nutritionInsights } from "../../src/features/insights/insights";
import { weeklyReview } from "../../src/features/reviews/weekly-review";
import { getPantryLots } from "../../src/features/pantry/ledger";
import { remainingRecipePortions } from "../../src/features/recipes/portions";
import {
  recordSet,
  replyToWorkout,
  startPlan,
  workoutPlans,
} from "../../src/workouts";
import { shiftPlanDate } from "../../src/features/planning/recurring-plans";
import {
  receiptSpending,
  formatMoney,
} from "../../src/features/shopping/shopping";
import { MealEditor } from "./tools";
export function NutritionScreen() {
  const dayStrip = useRef<ScrollView>(null);
  const h = useHealth(),
    state = h.state!;
  const [date, setDate] = useState<string | null>(null),
    [week, setWeek] = useState(false),
    [edit, setEdit] = useState<Meal | null>(null);
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
      <Card mint>
        <Text style={s.h2}>
          {selected === h.day ? "Today’s nutrition" : selected}
        </Text>
        <Text style={s.muted}>
          {Math.abs(remaining).toLocaleString()} calories{" "}
          {remaining >= 0 ? "left" : "above target"}
        </Text>
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
                strokeDasharray={`${Math.min(totals.calories / state.profile.calories, 1) * 346} 346`}
                transform="rotate(-90 63 66)"
              />
            </Svg>
            <Text style={[s.h2, { fontSize: 26 }]}>
              {Math.round(totals.calories).toLocaleString()}
            </Text>
            <Text style={s.tiny}>of {state.profile.calories} cal</Text>
          </View>
          <View style={[s.grow, { gap: 13 }]}>
            {(["protein", "carbs", "fat"] as const).map((k) => (
              <View key={k} style={{ gap: 5 }}>
                <Text style={s.muted}>
                  {k === "fat" ? "Fats" : k[0].toUpperCase() + k.slice(1)} ·{" "}
                  {Math.round(totals[k])}/{state.profile[k]}g
                </Text>
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
              </View>
            ))}
          </View>
        </View>
        <Pressable onPress={() => h.setTool("profile")}>
          <Text style={[s.tiny, { color: colors.green }]}>
            Your daily targets →
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
        <IconButton label="Log a meal" onPress={() => h.setTab("Chat")}>
          <Plus color={colors.green} />
        </IconButton>
      </View>
      {!meals.length && (
        <Card><SpotMoment moment="emptyFood"/><Text style={s.h2}>Nothing here yet.</Text><Text style={s.muted}>Tell Spot what you ate.</Text><Button label="Tell Spot" onPress={()=>h.setTab('Chat')}/></Card>
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
      {edit && <MealEditor meal={edit} onClose={() => setEdit(null)} />}
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
      <Pressable onPress={() => h.setTool("planner")}>
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
      {state.groceries
        ?.slice()
        .reverse()
        .slice(0, 5)
        .map((r) => (
          <Row
            key={r.id}
            title={r.store || "Grocery receipt"}
            detail={`${r.date} · ${r.items.length} items`}
            onPress={() => h.setTool("pantry")}
          />
        ))}
      {!state.groceries?.length && (
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
export function WorkoutsScreen() {
  const h = useHealth(),
    w = h.state!.workout;
  const [reply, setReply] = useState("");
  return (
    <Screen>
      <Text style={s.eyebrow}>YOUR MOVEMENT</Text>
      <Text style={s.title}>
        {w.status === "active"
          ? "Tell me how it’s going."
          : "What should you do today?"}
      </Text>
      {w.status !== "active" ? (
        <>
          <Card mint>
            <Image
              source={require("../assets/gym.jpg")}
              style={{ height: 150, borderRadius: 18, width: "100%" }}
            />
            <Text style={s.h2}>A workout that meets you here.</Text>
            <Text style={s.muted}>
              Choose a starter session or build one around your goals and
              equipment.
            </Text>
            <Button
              label="Build my workout"
              onPress={() => h.setTool("workout")}
            />
          </Card>
          {workoutPlans.map((p) => (
            <Card key={p.id}>
              <Text style={s.h2}>{p.title}</Text>
              <Text style={s.muted}>
                {p.exercises.length} exercises · starter template
              </Text>
              <Button
                label={`Start ${p.title}`}
                onPress={() =>
                  h.change((s) => ({
                    ...s,
                    workout: startPlan(s.workout, p.id),
                  }))
                }
              />
            </Card>
          ))}
        </>
      ) : (
        <>
          <Card mint>
            <Dumbbell color={colors.green} />
            <Text style={s.h2}>{w.title} in progress</Text>
            <Text style={s.muted}>
              {
                w.exercises.filter((e) => e.sets.every((r) => r !== null))
                  .length
              }{" "}
              of {w.exercises.length} exercises complete
            </Text>
          </Card>
          {w.exercises.map((e, i) => (
            <Card key={`${i}-${e.name}`}>
              <Text style={s.h2}>{e.name}</Text>
              <Text style={s.muted}>
                {e.weight ? `${e.weight} lb · ` : ""}
                {e.sets.length} × {e.target}
              </Text>
              <WeightEntry
                name={e.name}
                value={e.weight}
                onSave={(weight) =>
                  h.change((s) => ({
                    ...s,
                    workout: {
                      ...s.workout,
                      exercises: s.workout.exercises.map((x, j) =>
                        j === i ? { ...x, weight } : x,
                      ),
                    },
                  }))
                }
              />
              {e.sets.map((r, j) => (
                <View key={j} style={s.between}>
                  <Text style={s.muted}>
                    Set {j + 1}
                    {r !== null ? ` · ✓ ${r} reps` : ""}
                  </Text>
                  <View style={{ width: 135 }}>
                    <SetEntry
                      name={e.name}
                      index={j}
                      value={r}
                      target={e.target}
                      onSave={(reps) =>
                        h.change((s) => ({
                          ...s,
                          workout: recordSet(s.workout, i, j, reps),
                        }))
                      }
                    />
                  </View>
                </View>
              ))}
            </Card>
          ))}
          {w.conversation?.slice(-6).map((m) => (
            <View key={m.id} style={[s.bubble, m.role === "user" && s.user]}>
              <Text style={s.text}>{m.text}</Text>
            </View>
          ))}
          <Field
            label="Tell me your reps"
            value={reply}
            onChangeText={setReply}
            placeholder="Got 7"
          />
          <Button
            label="Log my set"
            onPress={() => {
              h.change((s) => ({
                ...s,
                workout: replyToWorkout(s.workout, reply),
              }));
              setReply("");
            }}
          />
          <Button
            secondary
            label="Use voice"
            onPress={() => h.setTool("voice")}
          />
          <Button
            label="Finish workout"
            onPress={() =>
              h.change((s) => ({
                ...s,
                workout: {
                  ...s.workout,
                  status: "finished",
                  finishedAt: new Date().toISOString(),
                },
              }))
            }
          />
        </>
      )}
      <Text style={s.h2}>Your recent sessions</Text>
      {w.status === 'finished' && <View style={{gap:8}}><Text style={s.h3}>Logged. Solid work.</Text><SpotMoment moment="workoutSaved"/></View>}
      {!(w.history ?? []).some(session=>session.finishedAt) && w.status !== 'finished' && <Card><SpotMoment moment="emptyWorkout"/><Text style={s.h2}>No reps yet.</Text><Text style={s.muted}>Tell Spot what you did.</Text><Button label="Tell Spot" onPress={()=>h.setTab('Chat')}/></Card>}
      {[
        ...(w.history ?? []),
        ...(w.status === "finished" && w.finishedAt ? [w] : []),
      ]
        .filter((x) => x.finishedAt)
        .slice()
        .reverse()
        .slice(0, 8)
        .map((x, i) => (
          <Card key={i}>
            <Text style={s.h3}>{x.title}</Text>
            <Text style={s.muted}>
              {x.finishedAt?.slice(0, 10)} ·{" "}
              {x.exercises.reduce(
                (n, e) => n + e.sets.filter((r) => r !== null).length,
                0,
              )}{" "}
              sets
            </Text>
          </Card>
        ))}
    </Screen>
  );
}
export function YouScreen() {
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
      <SpotWeeklyReview/>
      <Row title="Meet Spot" detail="Small plate. Massive overreaction. Replay the introduction." onPress={h.replaySpotIntro}/>
      <Row title={state.spot?.visuals===false?"Show Spot illustrations":"Hide Spot illustrations"} detail="The same tools work either way." onPress={()=>h.change(s=>({...s,spot:{...s.spot,visuals:s.spot?.visuals===false}}))}/>
      <Card mint>
        <Text style={s.eyebrow}>THE WEEK YOU’RE BUILDING</Text>
        <Text style={s.h2}>
          {review.meals.length} meals. {review.loggedDays} days of showing up.
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
        detail="Keep your goals in your hands"
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
    </Screen>
  );
}

function SetEntry({
  name,
  index,
  value,
  target,
  onSave,
}: {
  name: string;
  index: number;
  value: number | null;
  target: number;
  onSave: (v: number) => void;
}) {
  const [text, setText] = useState(value?.toString() ?? "");
  return (
    <View style={{ gap: 5 }}>
      <TextInput
        accessibilityLabel={`${name} set ${index + 1} reps`}
        keyboardType="number-pad"
        value={text}
        onChangeText={setText}
        placeholder={String(target)}
        style={s.field}
      />
      <Button
        label={`Save ${name} set ${index + 1}`}
        secondary
        disabled={
          !text.trim() ||
          !Number.isInteger(Number(text)) ||
          Number(text) < 0 ||
          Number(text) > 100
        }
        onPress={() => onSave(Number(text))}
      />
    </View>
  );
}

function WeightEntry({
  name,
  value,
  onSave,
}: {
  name: string;
  value: number;
  onSave: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  return (
    <View style={{ gap: 8 }}>
      <Field
        label={`${name} weight (lb)`}
        value={text}
        onChangeText={setText}
        keyboardType="decimal-pad"
      />
      <Button
        secondary
        label={`Save ${name} weight`}
        disabled={
          !text.trim() ||
          !Number.isFinite(Number(text)) ||
          Number(text) < 0 ||
          Number(text) > 20000
        }
        onPress={() => onSave(Number(text))}
      />
    </View>
  );
}
