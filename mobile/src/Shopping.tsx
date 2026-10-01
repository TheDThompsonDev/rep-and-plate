import { useState } from "react";
import { Text, View } from "react-native";
import { useHealth } from "./store";
import { Button, Card, Choice, Field, Row, Sheet, Sources, s } from "./ui";
import { jsonApi } from "./api";
import { id, today } from "../../src/domain";
import { getPantryLots } from "../../src/features/pantry/ledger";
import {
  addShoppingItem,
  compareProducts,
  comparePrices,
  receiptPrice,
  receiptSpending,
  remainingPlanNeeds,
  formatMoney,
  purchaseReceipts,
} from "../../src/features/shopping/shopping";
import {
  priceObservationSchema,
  type PriceObservation,
} from "../../src/features/shopping/contracts";
import { type FoodProduct } from "../../src/features/products/contracts";
import { productSearchResultSchema } from "../../src/features/products/search-contract";
import { excludedIngredient } from "../../src/features/planning/meal-plans";
import { defaultPreferences } from "../../src/features/preferences/contracts";
import { ReceiptEditor } from "./KitchenTools";
import type { GroceryReceipt } from "../../src/ai-contract";
export function Shopping() {
  const h = useHealth(),
    state = h.state!,
    shopping = state.shopping ?? { list: [], dismissed: [], prices: {} },
    preferences = state.preferences ?? defaultPreferences();
  const [tab, setTab] = useState("List"),
    [name, setName] = useState(""),
    [quantity, setQuantity] = useState(""),
    [original, setOriginal] = useState<FoodProduct | null>(null),
    [query, setQuery] = useState(""),
    [results, setResults] = useState<FoodProduct[]>([]),
    [alternative, setAlternative] = useState<FoodProduct | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [price, setPrice] = useState<FoodProduct | null>(null),
    [leads, setLeads] = useState<Record<string, PriceObservation>>({}),
    [receipt, setReceipt] = useState<GroceryReceipt | null>(null),
    [suitable, setSuitable] = useState(false);
  const stock = getPantryLots(state).filter(
      (l) => l.remaining !== 0 && l.item.availability !== "used",
    ),
    products = [
      ...new Map(
        stock
          .flatMap((l) =>
            l.item.productSnapshot ? [l.item.productSnapshot] : [],
          )
          .map((p) => [p.gtin, p]),
      ).values(),
    ];
  const add = (
    itemName: string,
    itemQuantity: string,
    itemId: string = id(),
    productId?: string,
  ) =>
    h.change((st) => ({
      ...st,
      shopping: {
        ...(st.shopping ?? shopping),
        list: addShoppingItem(st.shopping?.list ?? [], {
          id: itemId,
          name: itemName,
          quantity: itemQuantity,
          checked: false,
          createdAt: new Date().toISOString(),
          productId,
        }),
      },
    }));
  const comparison =
    original && alternative ? compareProducts(original, alternative) : null;
  const first = original
      ? (shopping.prices[original.id] ??
        receiptPrice(state.groceries ?? [], original))
      : undefined,
    second = alternative
      ? (shopping.prices[alternative.id] ??
        receiptPrice(state.groceries ?? [], alternative))
      : undefined,
    prices = first && second ? comparePrices(first, second, h.day) : null;
  const spending = receiptSpending(state.groceries ?? []);
  return (
    <Sheet
      title="Make your next shop work for you"
      onClose={() => h.setTool(null)}
    >
      <Choice
        values={["List", "Swaps", "Spending"]}
        value={tab}
        onChange={setTab}
      />
      {!!error && <Text style={s.muted}>{error}</Text>}
      {tab === "List" ? (
        <>
          <Field
            label="Add to shopping list"
            value={name}
            onChangeText={setName}
          />
          <Field
            label="Quantity or note"
            value={quantity}
            onChangeText={setQuantity}
          />
          <Button
            label="Add item"
            disabled={!name.trim()}
            onPress={() => {
              if (add(name, quantity)) {
                setName("");
                setQuantity("");
              }
            }}
          />
          {shopping.list.map((item) => (
            <Card key={item.id}>
              <Button
                label={`${item.checked ? "✓ " : "○ "}${item.name}`}
                secondary
                onPress={() =>
                  h.change((st) => ({
                    ...st,
                    shopping: {
                      ...(st.shopping ?? shopping),
                      list: (st.shopping?.list ?? []).map((x) =>
                        x.id === item.id ? { ...x, checked: !x.checked } : x,
                      ),
                    },
                  }))
                }
              />
              <Text style={s.muted}>{item.quantity}</Text>
              <Button
                label={`Remove ${item.name}`}
                secondary
                onPress={() =>
                  h.change((st) => ({
                    ...st,
                    shopping: {
                      ...(st.shopping ?? shopping),
                      list: (st.shopping?.list ?? []).filter(
                        (x) => x.id !== item.id,
                      ),
                    },
                  }))
                }
              />
            </Card>
          ))}
          <Text style={s.h2}>From your meal plan</Text>
          {remainingPlanNeeds(state, h.day).map((need, i) => (
            <Card key={i}>
              <Text style={s.h3}>{need.name}</Text>
              <Text style={s.muted}>
                {need.reason === "check-quantity"
                  ? "Check your pantry quantity first"
                  : `${need.servings} × ${need.servingLabel} needed`}
              </Text>
              {need.servings !== null && (
                <Button
                  label={`Add ${need.name}`}
                  secondary
                  onPress={() =>
                    add(
                      need.name,
                      `${need.servings} × ${need.servingLabel}`,
                      `plan-need:${need.name}:${need.servingLabel}`,
                    )
                  }
                />
              )}
            </Card>
          ))}
        </>
      ) : tab === "Spending" ? (
        <>
          <Text style={s.muted}>
            Only reviewed receipt totals count. Different currencies stay
            separate.
          </Text>
          {Object.entries(spending.totals).map(([currency, value]) => (
            <Card mint key={currency}>
              <Text style={s.title}>{formatMoney(value, currency)}</Text>
              <Text style={s.muted}>
                {spending.covered} reviewed grocery trips
              </Text>
            </Card>
          ))}
          <Text style={s.muted}>
            {spending.unpriced} receipts still need totals checked
          </Text>
          {Object.entries(spending.stores).map(([store, totals]) => (
            <Card key={store}>
              <Text style={s.h3}>{store}</Text>
              {Object.entries(totals).map(([c, v]) => (
                <Text key={c} style={s.text}>
                  {formatMoney(v, c)}
                </Text>
              ))}
            </Card>
          ))}
          {purchaseReceipts(state.groceries ?? []).map((r) => (
            <Row
              key={r.id}
              title={r.store || "Grocery receipt"}
              detail={`${r.date} · Review amounts`}
              onPress={() => setReceipt(r)}
            />
          ))}
        </>
      ) : (
        <>
          <Text style={s.muted}>
            Choose a product you bought, then compare an alternative. Prices and
            nutrition need equivalent quantities.
          </Text>
          <Button
            label="Shopping preferences"
            secondary
            onPress={() => h.setTool("preferences")}
          />
          {!products.length && (
            <Text style={s.muted}>
              Match pantry items to packages or scan a barcode to compare real
              products.
            </Text>
          )}
          {products.map((p) => (
            <Row
              key={p.id}
              title={p.name}
              detail={original?.id === p.id ? "Selected" : p.brand}
              onPress={() => {
                setOriginal(p);
                setQuery(p.name);
                setAlternative(null);
                setResults([]);
                setSuitable(false);
              }}
            />
          ))}
          {original && (
            <>
              <Field
                label="Find an alternative"
                value={query}
                onChangeText={setQuery}
              />
              <Button
                label={busy ? "Searching…" : "Search USDA alternatives"}
                disabled={busy}
                onPress={() =>
                  void (async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const result = productSearchResultSchema.parse(
                        await jsonApi("/api/products/search", { query }),
                      );
                      setResults(
                        result.products.filter(
                          (p) =>
                            p.gtin !== original.gtin &&
                            !excludedIngredient(
                              `${p.name} ${p.ingredients}`,
                              preferences,
                            ) &&
                            !shopping.dismissed.includes(
                              `${original.gtin}:${p.gtin}`,
                            ),
                        ),
                      );
                      setError(result.message);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  })()
                }
              />
              {results.map((p) => (
                <Row
                  key={p.id}
                  title={p.name}
                  detail={`${p.brand} · ${p.serving.label}`}
                  onPress={() => {
                    setAlternative(p);
                    setSuitable(false);
                  }}
                />
              ))}
              {alternative && (
                <Card mint>
                  <Text style={s.h2}>
                    {original.name} → {alternative.name}
                  </Text>
                  <Text style={s.muted}>{alternative.ingredients}</Text>
                  {comparison ? (
                    <>
                      <Text style={s.muted}>
                        Compared per 100 {comparison.unit}
                      </Text>
                      <Text style={s.text}>
                        Calories:{" "}
                        {comparison.calories === null
                          ? "Unknown"
                          : `${Math.abs(comparison.calories)} ${comparison.calories >= 0 ? "fewer" : "more"}`}
                      </Text>
                      <Text style={s.text}>
                        Total sugar:{" "}
                        {comparison.sugar === null
                          ? "Unknown"
                          : `${Math.abs(comparison.sugar)}g ${comparison.sugar >= 0 ? "less" : "more"}`}
                      </Text>
                      <Text style={s.text}>
                        Protein:{" "}
                        {comparison.protein === null
                          ? "Unknown"
                          : `${Math.abs(comparison.protein)}g ${comparison.protein >= 0 ? "more" : "less"}`}
                      </Text>
                    </>
                  ) : (
                    <Text style={s.muted}>
                      Serving quantities are not comparable yet.
                    </Text>
                  )}
                  {alternative.source.url && (
                    <Sources
                      sources={[
                        {
                          title: "Alternative product source",
                          url: alternative.source.url,
                        },
                      ]}
                    />
                  )}
                  <Text style={s.text}>
                    {prices
                      ? `${Math.abs(prices.percent)}% ${prices.percent >= 0 ? "less" : "more"} per equivalent quantity`
                      : "Price savings unknown until comparable recent prices are checked."}
                  </Text>
                  <Button
                    label="Look up store prices"
                    secondary
                    disabled={busy}
                    onPress={() =>
                      void (async () => {
                        setBusy(true);
                        try {
                          const result = await jsonApi("/api/shopping/prices", {
                            original,
                            alternative,
                            stores: (preferences.preferredStores ?? []).slice(
                              0,
                              5,
                            ),
                            currency: preferences.shoppingCurrency ?? "USD",
                          });
                          const checked: Record<string, PriceObservation> = {};
                          for (const p of [original, alternative]) {
                            const parsed = priceObservationSchema.safeParse(
                              result.quotes?.[p.id],
                            );
                            if (parsed.success)
                              checked[p.id] = {
                                ...parsed.data,
                                confirmed: false,
                              };
                          }
                          setLeads(checked);
                          setError(
                            "Review each price and linked source before using the comparison.",
                          );
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      })()
                    }
                  />
                  {[original, alternative].map((p) => (
                    <Button
                      key={p.id}
                      label={`Check price: ${p.name}`}
                      secondary
                      onPress={() => setPrice(p)}
                    />
                  ))}
                  <Button
                    label={
                      suitable
                        ? "✓ Suitable for my household"
                        : "I checked the ingredients and suitability"
                    }
                    secondary
                    onPress={() => setSuitable(!suitable)}
                  />
                  <Button
                    label="Add alternative to my list"
                    disabled={!suitable}
                    onPress={() =>
                      add(
                        alternative.name,
                        "Check package size",
                        `swap:${original.gtin}:${alternative.gtin}`,
                        alternative.id,
                      )
                    }
                  />
                  <Button
                    label="Keep my usual product"
                    secondary
                    onPress={() => setAlternative(null)}
                  />
                  <Button
                    label="Dismiss this swap"
                    secondary
                    onPress={() => {
                      h.change((st) => ({
                        ...st,
                        shopping: {
                          ...(st.shopping ?? shopping),
                          dismissed: [
                            ...(st.shopping?.dismissed ?? []),
                            `${original.gtin}:${alternative.gtin}`,
                          ],
                        },
                      }));
                      setAlternative(null);
                    }}
                  />
                </Card>
              )}
            </>
          )}
        </>
      )}
      {price && (
        <PriceEditor
          product={price}
          value={
            leads[price.id] ??
            shopping.prices[price.id] ??
            receiptPrice(state.groceries ?? [], price)
          }
          onClose={() => setPrice(null)}
        />
      )}
      {receipt && (
        <ReceiptEditor receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </Sheet>
  );
}
function PriceEditor({
  product,
  value,
  onClose,
}: {
  product: FoodProduct;
  value?: PriceObservation;
  onClose: () => void;
}) {
  const h = useHealth(),
    [price, setPrice] = useState(value?.price.toString() ?? ""),
    [amount, setAmount] = useState(value?.amount.toString() ?? ""),
    [unit, setUnit] = useState<PriceObservation["unit"]>(value?.unit ?? "g"),
    [currency, setCurrency] = useState(value?.currency ?? "USD"),
    [store, setStore] = useState(value?.store ?? ""),
    [date, setDate] = useState(value?.date ?? today()),
    [conditions, setConditions] = useState(value?.conditions ?? ""),
    [checked, setChecked] = useState(false);
  return (
    <Sheet title={`Check price: ${product.name}`} onClose={onClose}>
      {value?.sourceUrl && (
        <Sources
          sources={[
            { title: "Review online price source", url: value.sourceUrl },
          ]}
        />
      )}
      <Field
        label="Price paid"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />
      <Field
        label="Whole package amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <Choice
        values={["g", "ml", "each"]}
        value={unit}
        onChange={(v) => setUnit(v as typeof unit)}
      />
      <Field label="Currency" value={currency} onChangeText={setCurrency} />
      <Field label="Store" value={store} onChangeText={setStore} />
      <Field
        label="Date checked (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
      />
      <Field
        label="Discount or membership conditions"
        value={conditions}
        onChangeText={setConditions}
      />
      <Button
        label={
          checked
            ? "✓ Price reviewed"
            : "I checked this exact product and price"
        }
        secondary
        onPress={() => setChecked(!checked)}
      />
      <Button
        label="Save reviewed price"
        disabled={!checked}
        onPress={() => {
          if (
            h.change((st) => ({
              ...st,
              shopping: {
                ...(st.shopping ?? { list: [], dismissed: [], prices: {} }),
                prices: {
                  ...st.shopping?.prices,
                  [product.id]: priceObservationSchema.parse({
                    price: Number(price),
                    amount: Number(amount),
                    unit,
                    currency,
                    store,
                    date,
                    conditions,
                    confirmed: true,
                    sourceUrl: value?.sourceUrl,
                  }),
                },
              },
            }))
          )
            onClose();
        }}
      />
    </Sheet>
  );
}
