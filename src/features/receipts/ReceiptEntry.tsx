import { ArrowRight, ReceiptText } from "lucide-react";
import "./receipt-journey.css";

export default function ReceiptEntry({
  onReceipt,
  onExample,
}: {
  onReceipt: () => void;
  onExample: () => void;
}) {
  return (
    <section className="receipt-entry" aria-label="From groceries to dinner">
      <span className="receipt-eyebrow">
        <ReceiptText size={16} /> YOUR GROCERIES HAVE PLANS
      </span>
      <h2>
        A receipt today.
        <br />
        An easier dinner decision.
      </h2>
      <p>
        Save what you bought, check the groceries, and find meal ideas from what
        you have. See what else you need for your next shop.
      </p>
      <ol className="receipt-path" aria-label="How receipts help">
        <li>Receipt</li>
        <li>Check groceries</li>
        <li>Dinner ideas</li>
      </ol>
      <div className="receipt-entry-actions">
        <button className="button primary" onClick={onReceipt}>
          Start with my groceries <ArrowRight size={16} />
        </button>
        <button className="button secondary" onClick={onExample}>
          See a receipt example
        </button>
      </div>
      <small>Purchases stay separate from food you eat.</small>
    </section>
  );
}
