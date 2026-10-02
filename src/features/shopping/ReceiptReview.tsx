import { useState } from "react";
import { Modal } from "../../components";
import type { GroceryReceipt } from "../../ai-contract";
import { receiptPurchaseSchema, receiptLinePriceSchema } from "./contracts";
import "./shopping.css";
import ReceiptSource from '../receipts/ReceiptSource';

export default function ReceiptReview({
  receipt,
  onSave,
  onClose,
  sourceImage,
}: {
  receipt: GroceryReceipt;
  onSave: (receipt: GroceryReceipt) => void;
  onClose: () => void;
  sourceImage?: string;
}) {
  const [error, setError] = useState("");
  const purchase = receipt.purchase;
  return (
    <Modal title="Review grocery trip" onClose={onClose}>
      <form
        className="edit-form shopping-form"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const form = new FormData(event.currentTarget);
          const number = (key: string) => {
            const value = String(form.get(key) ?? "").trim();
            return value ? Number(value) : null;
          };
          try {
            const data = receiptPurchaseSchema.parse({
              purchaseDate: String(form.get("date") || "") || null,
              currency: String(form.get("currency") || "") || null,
              subtotal: number("subtotal"),
              tax: number("tax"),
              discount: number("discount"),
              total: number("total"),
              confirmed: true,
            });
            const items = receipt.items.map((item) => ({
              ...item,
              price: receiptLinePriceSchema.parse({
                total: number(`price:${item.id}`),
                discount: number(`discount:${item.id}`),
              }),
            }));
            onSave({
              ...receipt,
              store: String(form.get("store")).trim() || "Store not identified",
              purchase: data,
              items,
            });
          } catch {
            setError(
              "Check the receipt date and amounts. Leave anything unknown blank.",
            );
          }
        }}
      >
        <ReceiptSource image={sourceImage}/>
        <p>
          Check the printed receipt. These are household purchases, separate
          from meals you ate. Leave unreadable amounts blank.
        </p>
        <p className="shopping-muted">Captured {receipt.date}. The purchase date below comes from your receipt and can be earlier.</p>
        <label>
          Grocery store
          <input name="store" maxLength={200} defaultValue={receipt.store} />
        </label>
        <div className="form-grid">
          <label>
            Purchase date
            <input
              name="date"
              type="date"
              defaultValue={purchase?.purchaseDate ?? ""}
            />
          </label>
          <label>
            Receipt currency
            <select name="currency" defaultValue={purchase?.currency ?? ""}>
              <option value="">Unknown</option>
              {[
                ...new Set([
                  "USD",
                  "CAD",
                  "GBP",
                  "EUR",
                  "AUD",
                  ...(purchase?.currency ? [purchase.currency] : []),
                ]),
              ].map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>What you paid</legend>
          <div className="form-grid">
            {(["subtotal", "tax", "discount", "total"] as const).map((key) => (
              <label key={key}>
                {key === "total"
                  ? "Receipt total"
                  : key === "discount"
                    ? "Receipt discounts"
                    : key === "tax"
                      ? "Tax"
                      : "Subtotal"}
                <input
                  name={key}
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  defaultValue={purchase?.[key] ?? ""}
                />
              </label>
            ))}
          </div>
        </fieldset>
        <p className="shopping-muted">
          Copy totals as printed. Discounts are recorded separately and are not
          subtracted a second time.
        </p>
        <details>
          <summary>Review item prices ({receipt.items.length} lines)</summary>
          {receipt.items.map((item) => (
            <fieldset key={item.id}>
              <legend>{item.receiptText || item.name}</legend>
              <div className="form-grid">
                <label>
                  Line total paid
                  <input
                    name={`price:${item.id}`}
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    defaultValue={item.price?.total ?? ""}
                  />
                </label>
                <label>
                  Line discount
                  <input
                    name={`discount:${item.id}`}
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.01"
                    defaultValue={item.price?.discount ?? ""}
                  />
                </label>
              </div>
              <small>
                Total for all units on this line, after its discount.
              </small>
            </fieldset>
          ))}
        </details>
        {error && <p role="alert">{error}</p>}
        <button className="button primary full-width">
          Save reviewed receipt
        </button>
        <p className="shopping-muted">
          This confirms receipt amounts only. Product matches and serving
          quantities still need their own check.
        </p>
      </form>
    </Modal>
  );
}
