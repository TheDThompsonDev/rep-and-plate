import { useState, type FormEvent } from 'react';
import { Camera, CookingPot, ListChecks, Utensils } from 'lucide-react';
import { Modal } from '../../components';
import type { AppState } from '../../domain';
import { dinnerDecisionPrompt, menuDecisionPrompt, uncertainMealPrompt, type CapturePurpose, type DinnerOptions } from './model';
import './decisions.css';

type Tool = 'dinner' | 'menu' | 'estimate';
export default function DecisionsDialog({ state, onClose, onAsk, onCapture }: {
  state: AppState;
  onClose: () => void;
  onAsk: (text: string, purpose: CapturePurpose) => void;
  onCapture: (text: string, purpose: CapturePurpose) => void;
}) {
  const [tool, setTool] = useState<Tool>('dinner');
  const [minutes, setMinutes] = useState(state.preferences?.cookingMinutes ?? 20);
  const [appetite, setAppetite] = useState<DinnerOptions['appetite']>('regular');
  const [budget, setBudget] = useState<DinnerOptions['budget']>(state.preferences?.budget === 'economy' ? 'economy' : 'use-stock');
  const [note, setNote] = useState('');
  const [menu, setMenu] = useState('');
  const [meal, setMeal] = useState('');
  const [error, setError] = useState('');
  const ask = (build: () => string, purpose: CapturePurpose) => {
    try { const text = build(); setError(''); onClose(); onAsk(text, purpose); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Shorten the details and try again.'); }
  };
  const capture = (build: () => string, purpose: CapturePurpose) => {
    try { const text = build(); setError(''); onClose(); onCapture(text, purpose); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Shorten the details and try again.'); }
  };
  function submitDinner(event: FormEvent) {
    event.preventDefault();
    ask(() => dinnerDecisionPrompt(state, { minutes, appetite, budget, note }), 'decide');
  }
  return <Modal title="What would help right now?" onClose={onClose}>
    <div className="decision-tools">
      <div className="decision-tool-picker" role="group" aria-label="Choose food help">
        <button type="button" aria-pressed={tool === 'dinner'} onClick={() => setTool('dinner')}><CookingPot size={19}/><span>Find a meal</span></button>
        <button type="button" aria-pressed={tool === 'menu'} onClick={() => setTool('menu')}><Utensils size={19}/><span>Choose an order</span></button>
        <button type="button" aria-pressed={tool === 'estimate'} onClick={() => setTool('estimate')}><ListChecks size={19}/><span>Estimate a meal</span></button>
      </div>
      {error && <p className="decision-error" role="alert">{error}</p>}
      {tool === 'dinner' && <form className="decision-form" onSubmit={submitDinner}>
        <div><h3>Let’s make the next meal easier.</h3><p>Spot can use your recorded kitchen, leftovers and preferences. You can choose before logging anything.</p></div>
        <div className="decision-field-row">
          <label>Time available<input type="number" required min={5} max={240} step={1} value={minutes} onChange={event => setMinutes(Number(event.target.value))}/><small>Minutes, including preparation.</small></label>
          <label>What sounds right?<select value={appetite} onChange={event => setAppetite(event.target.value as DinnerOptions['appetite'])}><option value="light">Something light</option><option value="regular">A regular meal</option><option value="hungry">Something substantial</option></select></label>
        </div>
        <label>For this meal<select value={budget} onChange={event => setBudget(event.target.value as DinnerOptions['budget'])}><option value="use-stock">Use what I have</option><option value="economy">Keep the cost low</option><option value="flexible">I’m flexible</option></select></label>
        <label>Anything else? <span className="decision-optional">Optional · up to 600 characters</span><textarea rows={2} maxLength={600} value={note} onChange={event => setNote(event.target.value)} placeholder="No energy to cook, feeding two, craving something warm…"/></label>
        {state.preferences?.restrictions.length ? <p className="decision-context">Using your saved food exclusions: {state.preferences.restrictions.join(', ')}.</p> : null}
        <button type="submit" className="button primary">Find a few good options</button>
      </form>}
      {tool === 'menu' && <form className="decision-form" onSubmit={event => { event.preventDefault(); if (menu.trim()) ask(() => menuDecisionPrompt(state, menu, note), 'menu'); }}>
        <div><h3>Choose something you’ll enjoy.</h3><p>Share a menu or ordering screen. Spot can compare a few choices around what matters to you.</p></div>
        <label>What matters for this order? <span className="decision-optional">Optional · up to 600 characters</span><textarea rows={2} maxLength={600} value={note} onChange={event => setNote(event.target.value)} placeholder="Quick lunch, more protein, under $20, something filling…"/></label>
        <button type="button" className="button primary" onClick={() => capture(() => menuDecisionPrompt(state, '', note), 'menu')}><Camera size={17}/> Add a menu or order photo</button>
        <div className="decision-divider"><span>or describe the choices</span></div>
        <label>Menu or order details <span className="decision-optional">Up to 2,000 characters</span><textarea rows={3} maxLength={2000} value={menu} onChange={event => setMenu(event.target.value)} placeholder="The menu has chicken tacos, a rice bowl, and a burger…"/></label>
        <button type="submit" className="button secondary" disabled={!menu.trim()}>Help me choose</button>
        <p className="decision-context">Choosing food leaves your food log unchanged. Log what you actually eat afterward.</p>
      </form>}
      {tool === 'estimate' && <div className="decision-form">
        <div><h3>You don’t need every detail.</h3><p>Describe what you actually ate, then choose how much help you want with the estimate.</p></div>
        <label htmlFor="decision-eaten-meal">What did you eat?<textarea id="decision-eaten-meal" rows={3} maxLength={2400} value={meal} onChange={event => setMeal(event.target.value)} placeholder="Two plates at a cookout. Some chicken, rice and a little potato salad. I’m unsure about amounts."/></label>
        <div className="decision-estimate-choices">
          <button type="button" disabled={!meal.trim()} onClick={() => ask(() => uncertainMealPrompt(meal, 'rough'), 'rough-meal')}><strong>Use a rough estimate</strong><span>See the assumptions and review an approximation.</span></button>
          <button type="button" disabled={!meal.trim()} onClick={() => ask(() => uncertainMealPrompt(meal, 'clarify'), 'clarify-meal')}><strong>Help me narrow it down</strong><span>Start with the question that matters most.</span></button>
        </div>
        <button type="button" className="button secondary" onClick={() => capture(() => uncertainMealPrompt(meal.trim() || 'The food shown in the photo I am attaching.', 'rough'), 'rough-meal')}><Camera size={17}/> Add a photo of what I ate</button>
        <p className="decision-context">Estimates stay editable. You review the details before anything is logged.</p>
      </div>}
    </div>
  </Modal>;
}
