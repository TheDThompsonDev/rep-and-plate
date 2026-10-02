import { useState } from "react";
import { ArrowRight, ReceiptText, Utensils } from "lucide-react";
import { Modal } from "../../components";
import "./receipt-journey.css";

export default function ReceiptExample({ onClose }: { onClose: () => void }) {
  const [dinner, setDinner] = useState(false);
  return (
    <Modal title="A receipt to dinner example" onClose={onClose}>
      <div className="receipt-example">
        <span className="receipt-eyebrow">Example only · nothing is saved</span>
        <h3>One grocery trip. A starting point for dinner.</h3>
        <div
          className="receipt-example-paper"
          aria-label="Example grocery receipt"
        >
          <ReceiptText size={24} />
          <strong>A LITTLE GROCERY SHOP</strong>
          <span>
            Chicken breast <b>$8.40</b>
          </span>
          <span>
            Rice <b>$4.00</b>
          </span>
          <span>
            Broccoli <b>$3.00</b>
          </span>
          <small>Illustrative items and prices, not a real purchase.</small>
        </div>
        {!dinner ? (
          <>
            <p>
              Spot reads the grocery names. You check the products and amounts.
              Then those groceries can help answer “what’s for dinner?”
            </p>
            <button
              className="button primary full-width"
              onClick={() => setDinner(true)}
            >
              See dinner ideas <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <section
            className="receipt-example-dinner"
            aria-label="Example dinner idea"
          >
            <Utensils size={24} />
            <h3>Chicken, rice & broccoli</h3>
            <p>
              A dinner idea from the checked groceries. Your own ideas will
              depend on what’s available and your preferences.
            </p>
            <p>
              <strong>What else might you need?</strong>
              <br />
              Oil and seasoning: check your pantry before adding them to a
              shopping list.
            </p>
            <small>
              A meal idea is not logged as eaten. Nutrition and portions still
              need review.
            </small>
          </section>
        )}
        <p className="section-note">
          Reading your own receipt needs connected AI. Unclear products and
          quantities may need a check; uploading a receipt does not create a
          complete meal plan.
        </p>
      </div>
    </Modal>
  );
}
