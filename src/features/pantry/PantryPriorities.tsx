import { relevantPantryReviews } from '../household/domain';
import './pantry-priorities.css';

type ReviewLot = { id: string; receiptId: string; item: { id: string; name: string } };

/** Ingredient focus changes presentation only; every pending product remains available. */
export default function PantryPriorities<T extends ReviewLot>({ lots, onReview, focus, onFocusChange, showOther, onShowOtherChange }: {
  lots: T[];
  onReview: (lot: T) => void;
  focus: string;
  onFocusChange: (value: string) => void;
  showOther: boolean;
  onShowOtherChange: (value: boolean) => void;
}) {
  const ingredientNames = focus.split(',').map(value => value.trim()).filter(Boolean);
  const relevantIds = new Set(relevantPantryReviews(lots.map(lot => ({ id: lot.id, name: lot.item.name, uncertain: true })), ingredientNames).map(item => item.id));
  const relevant = lots.filter(lot => relevantIds.has(lot.id));
  const other = lots.filter(lot => !relevantIds.has(lot.id));
  if (!lots.length) return null;
  const renderLot = (lot: T) => <li key={lot.id}>
    <span>{lot.item.name}</span>
    <button type="button" onClick={() => onReview(lot)} aria-label={`Review ${lot.item.name}`}>Review product</button>
  </li>;
  return <section className="pantry-priorities" aria-label="Prioritize pantry checks">
    <div className="pantry-priorities-heading">
      <h3>Check what you need next</h3>
      <span>{lots.length} {lots.length === 1 ? 'item needs' : 'items need'} review</span>
    </div>
    <label>Ingredients I need now
      <input value={focus} maxLength={300} onChange={event => { onFocusChange(event.target.value); onShowOtherChange(false); }} placeholder="Optional: rice, chicken, tomatoes" />
    </label>
    <p>Choose a few ingredients to bring possible matches forward. Product names alone do not confirm a match.</p>
    {ingredientNames.length > 0 && <>
      <strong className="pantry-priorities-label">Possible matches · {relevant.length}</strong>
      {relevant.length ? <ul>{relevant.map(renderLot)}</ul> : <p>No pending product names matched those ingredients. Other checks remain below.</p>}
    </>}
    {other.length > 0 && <>
      <button className="pantry-priorities-defer" type="button" onClick={() => onShowOtherChange(!showOther)} aria-expanded={showOther}>
        {showOther ? 'Hide' : 'Show'} {other.length} {ingredientNames.length ? 'other' : 'pending'} {other.length === 1 ? 'check' : 'checks'}
      </button>
      {showOther && <ul>{other.map(renderLot)}</ul>}
    </>}
    <small>Unresolved items stay in your review queue. Checking groceries does not count as food eaten.</small>
  </section>;
}
