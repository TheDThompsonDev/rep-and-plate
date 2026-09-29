import { apiFetch } from "../../api-fetch";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { today } from "../../domain";
import type { FoodProduct } from "../products/contracts";
import { priceObservationSchema, type PriceObservation } from "./contracts";

const resultSchema = z.object({
  quotes: z.record(z.string(), priceObservationSchema),
  note: z.string().max(1500),
});
export default function PriceResearch({
  original,
  alternative,
  stores,
  currency,
  onFound,
}: {
  original: FoodProduct;
  alternative: FoodProduct;
  stores: string[];
  currency?: string;
  onFound: (values: Record<string, PriceObservation>) => void;
}) {
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function lookup() {
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setNotice("Looking for the exact packages at your stores…");
    const timeout = setTimeout(() => abort.abort(), 110000);
    try {
      const response = await apiFetch("/api/shopping/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original,
          alternative,
          stores: stores.slice(0, 5),
          currency,
        }),
        signal: abort.signal,
      });
      if (!response.ok) throw new Error("Price research unavailable");
      const result = resultSchema.parse(await response.json());
      if (abort.signal.aborted) return;
      const quotes = Object.fromEntries(
        Object.entries(result.quotes)
          .filter(([id]) => [original.id, alternative.id].includes(id))
          .map(([id, value]) => [
            id,
            { ...value, date: today(), confirmed: false },
          ]),
      );
      onFound(quotes);
      setNotice(
        Object.keys(quotes).length
          ? `${result.note} Found online prices. Open “Check price” for both products, review the linked pages and save only what you can confirm.`
          : result.note ||
              "No supported price found. You can enter a shelf or receipt price instead.",
      );
    } catch {
      if (!abort.signal.aborted)
        setNotice(
          "Could not finish price research. Try again or enter prices you checked in store.",
        );
      else setNotice("Price lookup took too long. Please retry.");
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }
  return (
    <div className="shopping-price-research">
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => void lookup()}
      >
        {busy ? "Looking up prices…" : "Look up store prices"}
      </button>
      {notice && (
        <p role="status" className="shopping-muted">
          {notice}
        </p>
      )}
    </div>
  );
}
