import { useState } from "react";
import { Text, View, Image } from "react-native";
import { Button, Card, Choice, Field, Sheet, s } from "./ui";
import { useHealth } from "./store";
import { connect, loadConnection } from "./api";
import { useEffect } from "react";
import { id, type Meal, mealSchema, resolveReview } from "../../src/domain";
import {
  deleteMealWithPantry,
  detachMealFromPantry,
  getPantryLots,
  reconcileMeal,
} from "../../src/features/pantry/ledger";
import { isCalendarDate } from "../../src/features/pantry/date-contract";
import {
  defaultPreferences,
  preferencesSchema,
} from "../../src/features/preferences/contracts";
import { weeklyReview } from "../../src/features/reviews/weekly-review";

export function MealEditor({
  meal,
  onClose,
}: {
  meal: Meal;
  onClose: () => void;
}) {
  const h = useHealth(),
    [value, setValue] = useState(meal),
    [confirm, setConfirm] = useState(false),
    [links, setLinks] = useState<Record<string, string>>({});
  const linked =
    !!meal.components?.some((c) => c.lotId) || !!meal.recipeBatchId;
  return (
    <Sheet title="Your meal" onClose={onClose}>
      <Field
        label="Meal name"
        value={value.title}
        onChangeText={(title) => setValue({ ...value, title })}
      />
      <Field
        label="Day (YYYY-MM-DD)"
        value={value.day}
        onChangeText={(day) => setValue({ ...value, day })}
      />
      <Choice
        values={["Breakfast", "Lunch", "Dinner", "Snack"]}
        value={value.category}
        onChange={(c) =>
          setValue({ ...value, category: c as Meal["category"] })
        }
      />
      {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
        <Field
          key={k}
          label={`${k}${k === "calories" ? "" : " (g)"}`}
          keyboardType="decimal-pad"
          value={String(value[k])}
          onChangeText={(v) => setValue({ ...value, [k]: Number(v) })}
        />
      ))}
      <Field
        label="Notes"
        multiline
        value={value.note}
        onChangeText={(note) => setValue({ ...value, note })}
      />
      {linked && (
        <Text style={s.muted}>
          Ingredient-linked nutrition is tracked with your pantry or recipe.
          Remove and log a corrected portion to change its macros.
        </Text>
      )}
      <Button
        label="Save meal"
        onPress={() => {
          if (!isCalendarDate(value.day) || !value.title.trim()) {
            h.setNotice("Check the meal name and date.");
            return;
          }
          if (
            linked &&
            (["calories", "protein", "carbs", "fat"] as const).some(
              (k) => value[k] !== meal[k],
            )
          ) {
            h.setNotice(
              "Remove this portion and log the corrected amount to keep your pantry consistent.",
            );
            return;
          }
          if (
            h.change((st) => ({
              ...st,
              meals: st.meals.map((m) =>
                m.id === meal.id
                  ? mealSchema.parse({
                      ...value,
                      components: linked ? value.components : undefined,
                    })
                  : m,
              ),
            }))
          )
            onClose();
        }}
      />
      <Text style={s.h3}>Ingredients from your pantry</Text>
      {!linked &&
        getPantryLots(h.state!)
          .filter(
            (l) =>
              l.remaining !== null &&
              l.remaining > 0 &&
              l.item.nutrition &&
              !l.inconsistent,
          )
          .map((l) => (
            <Field
              key={l.id}
              label={`${l.item.name} - servings used`}
              keyboardType="decimal-pad"
              value={links[l.id] ?? ""}
              onChangeText={(v) => setLinks({ ...links, [l.id]: v })}
            />
          ))}
      {!linked && Object.values(links).some(Boolean) && (
        <Button
          label="Link pantry ingredients"
          secondary
          onPress={() => {
            if (
              h.change((s) =>
                reconcileMeal(
                  s,
                  meal.id,
                  Object.entries(links)
                    .filter(([, v]) => v.trim())
                    .map(([lotId, v]) => ({ lotId, servings: Number(v) })),
                  id(),
                ),
              )
            )
              onClose();
          }}
        />
      )}
      {linked && !meal.recipeBatchId && (
        <Button
          label="Undo pantry links"
          secondary
          onPress={() => {
            if (h.change((s) => detachMealFromPantry(s, meal.id))) onClose();
          }}
        />
      )}
      <Text style={s.tiny}>
        Linking adjusts pantry stock and keeps this meal’s original nutrition
        estimate.
      </Text>
      {confirm ? (
        <Card>
          <Text style={s.muted}>
            Remove this meal and restore any linked pantry or recipe portions?
          </Text>
          <Button
            label="Confirm remove meal"
            onPress={() => {
              if (h.change((st) => deleteMealWithPantry(st, meal.id)))
                onClose();
            }}
          />
          <Button
            label="Keep meal"
            secondary
            onPress={() => setConfirm(false)}
          />
        </Card>
      ) : (
        <Button
          label="Remove meal"
          secondary
          onPress={() => setConfirm(true)}
        />
      )}
    </Sheet>
  );
}
export function Profile() {
  const h = useHealth(),
    [value, setValue] = useState(h.state!.profile);
  return (
    <Sheet title="Your profile & daily targets" onClose={() => h.setTool(null)}>
      <Text style={s.muted}>
        These are your chosen targets. Change them whenever your needs change.
      </Text>
      <Field
        label="Name"
        value={value.name}
        onChangeText={(name) => setValue({ ...value, name })}
      />
      {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
        <Field
          key={k}
          label={`Daily ${k} target`}
          value={String(value[k])}
          keyboardType="decimal-pad"
          onChangeText={(v) => setValue({ ...value, [k]: Number(v) })}
        />
      ))}
      <Button
        label="Save targets"
        onPress={() => {
          if (
            Object.values(value).some(
              (v) => typeof v === "number" && (!Number.isFinite(v) || v <= 0),
            )
          ) {
            h.setNotice("Enter positive daily targets.");
            return;
          }
          if (h.change((s) => ({ ...s, profile: value }))) h.setTool(null);
        }}
      />
    </Sheet>
  );
}
export function Preferences() {
  const h = useHealth(),
    [p, setP] = useState(h.state!.preferences ?? defaultPreferences()),
    [lists, setLists] = useState(() =>
      Object.fromEntries(
        (
          [
            "restrictions",
            "dislikes",
            "favorites",
            "preferredStores",
            "equipment",
          ] as const
        ).map((k) => [k, (p[k] ?? []).join(", ")]),
      ),
    );
  return (
    <Sheet title="Food & household preferences" onClose={() => h.setTool(null)}>
      <Field
        label="People in your household"
        keyboardType="number-pad"
        value={String(p.householdSize)}
        onChangeText={(v) => setP({ ...p, householdSize: Number(v) })}
      />
      {(
        [
          "restrictions",
          "dislikes",
          "favorites",
          "preferredStores",
          "equipment",
        ] as const
      ).map((k) => (
        <Field
          key={k}
          label={`${k} (comma separated)`}
          value={lists[k]}
          onChangeText={(v) => setLists({ ...lists, [k]: v })}
        />
      ))}
      <Text style={s.h3}>What matters most when shopping?</Text>
      <Choice
        values={[
          "balanced",
          "budget",
          "protein",
          "calories",
          "less-sugar",
          "convenience",
        ]}
        value={p.shoppingPriority ?? "balanced"}
        onChange={(v) =>
          setP({ ...p, shoppingPriority: v as typeof p.shoppingPriority })
        }
      />
      <Field
        label="Weekly grocery budget (optional)"
        value={p.weeklyBudget?.toString() ?? ""}
        keyboardType="decimal-pad"
        onChangeText={(v) => setP({ ...p, weeklyBudget: v ? Number(v) : null })}
      />
      <Field
        label="Currency"
        value={p.shoppingCurrency ?? "USD"}
        autoCapitalize="characters"
        maxLength={3}
        onChangeText={(v) => setP({ ...p, shoppingCurrency: v.toUpperCase() })}
      />
      <Choice
        values={["unknown", "economy", "flexible"]}
        value={p.budget}
        onChange={(v) => setP({ ...p, budget: v as typeof p.budget })}
      />
      <Choice
        values={["open", "usual"]}
        value={p.brandFlexibility ?? "open"}
        onChange={(v) =>
          setP({ ...p, brandFlexibility: v as typeof p.brandFlexibility })
        }
      />
      <Text style={s.tiny}>
        Open to other brands, or prefer your usual brands.
      </Text>
      <Field
        label="Cooking time in minutes (optional)"
        value={p.cookingMinutes?.toString() ?? ""}
        keyboardType="number-pad"
        onChangeText={(v) =>
          setP({ ...p, cookingMinutes: v ? Number(v) : null })
        }
      />
      <Field
        label="Workout goals and preferences"
        multiline
        value={p.workoutPreferences}
        onChangeText={(v) => setP({ ...p, workoutPreferences: v })}
      />
      <Button
        label="Save preferences"
        onPress={() => {
          if (
            h.change((s) => ({
              ...s,
              preferences: preferencesSchema.parse({
                ...p,
                ...Object.fromEntries(
                  Object.entries(lists).map(([k, v]) => [
                    k,
                    v
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  ]),
                ),
                updatedAt: new Date().toISOString(),
              }),
            }))
          )
            h.setTool(null);
        }}
      />
    </Sheet>
  );
}
export function Connection() {
  const h = useHealth(),
    [url, setUrl] = useState("https://"),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    loadConnection()
      .then((c) => {
        if (c) {
          setUrl(c.url);
          setToken(c.token);
        }
      })
      .catch(() => {});
  }, []);
  return (
    <Sheet title="Connect your phone" onClose={() => h.setTool(null)}>
      <Text style={s.muted}>
        Enter your beta server address, then sign in with your email. For local
        development, enter your computer’s address and pairing code instead.
      </Text>
      <Field
        label="Server address"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="http://192.168.1.10:5174"
      />
      <Field
        label="Pairing code (local development only)"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      {!!error && <Text style={s.muted}>{error}</Text>}
      <Button
        label={busy ? "Connecting…" : "Connect"}
        disabled={busy}
        onPress={() =>
          void (async () => {
            setBusy(true);
            setError("");
            try {
              await connect({ url, token });
              h.setNotice(
                token
                  ? "Phone connected. You can now chat and look up food."
                  : "Server connected. Sign in to finish setting up your phone.",
              );
              h.setTool(token ? null : "cloud");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          })()
        }
      />
      <Text style={s.tiny}>
        Leave the pairing code empty for the hosted beta. Your API keys stay on
        the server.
      </Text>
    </Sheet>
  );
}
export function Review() {
  const h = useHealth(),
    review = weeklyReview(h.state!);
  return (
    <Sheet title="Your weekly review" onClose={() => h.setTool(null)}>
      <Text style={s.muted}>
        {review.start} – {review.end}
      </Text>
      {review.insights.map((i) => (
        <Card key={i.title}>
          <Text style={s.h3}>{i.title}</Text>
          <Text style={s.muted}>{i.description}</Text>
          <Text style={s.tiny}>{i.evidence}</Text>
        </Card>
      ))}
      {review.workouts.map((w) => (
        <Card key={w.startedAt}>
          <Text style={s.h3}>{w.title}</Text>
          <Text style={s.muted}>
            {w.day} · {w.sets} sets · {w.finished ? "Finished" : "In progress"}
          </Text>
        </Card>
      ))}
      <Text style={s.h2}>Captured moments to review</Text>
      {h
        .state!.reviews.filter((r) => !r.resolved)
        .map((r) => (
          <Card key={r.id}>
            <Text style={s.h3}>{r.title}</Text>
            {r.image && (
              <Image
                source={{ uri: r.image }}
                style={{ height: 200, width: "100%" }}
                resizeMode="contain"
              />
            )}
            <Text style={s.muted}>{r.question}</Text>
            {r.image && (
              <Button
                label="Read this image now"
                disabled={h.busy}
                onPress={() =>
                  void h.send(
                    `Please read this saved capture: ${r.title}. Keep groceries separate from food eaten.`,
                    r.image,
                  )
                }
              />
            )}
            <Button
              label="Keep as reviewed note"
              secondary
              onPress={() =>
                h.change((s) => resolveReview(s, r.id, "Keep as a note"))
              }
            />
          </Card>
        ))}
    </Sheet>
  );
}
