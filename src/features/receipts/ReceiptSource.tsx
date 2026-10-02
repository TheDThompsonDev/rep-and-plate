import { useState } from "react";
import "./receipt-journey.css";

export default function ReceiptSource({ image }: { image?: string }) {
  const [zoomed, setZoomed] = useState(false);
  if (!image)
    return (
      <p className="section-note">
        Use your printed receipt or the original photo to check these details.
      </p>
    );
  return (
    <details className="receipt-source">
      <summary>Compare with original receipt</summary>
      <button
        type="button"
        className="button secondary"
        aria-pressed={zoomed}
        onClick={() => setZoomed(!zoomed)}
      >
        {zoomed ? "Fit receipt to screen" : "Enlarge receipt"}
      </button>
      <div
        className={`receipt-source-scroll ${zoomed ? "zoomed" : ""}`}
        tabIndex={0}
        aria-label="Original receipt image, scroll to compare"
      >
        <img src={image} alt="Original grocery receipt" />
      </div>
    </details>
  );
}
