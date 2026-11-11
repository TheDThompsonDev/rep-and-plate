import { useState } from 'react';
import { View, Text } from 'react-native';
import { Button, Field, Choice, Sheet } from './ui';
import { useLoadedHealth } from './store';
import {
  dinnerDecisionPrompt,
  menuDecisionPrompt,
  uncertainMealPrompt,
  type CapturePurpose,
  type DinnerOptions,
} from '../../src/features/decisions/model';

const tools = ['Find a meal', 'Choose an order', 'Estimate a meal'];
const appetites = ['Something light', 'A regular meal', 'Something substantial'];
const budgets = ['Use what I have', 'Keep the cost low', 'I’m flexible'];

export function FoodDecisions({ onClose, onCapture }: {
  onClose: () => void;
  onCapture: (prompt: string, purpose: CapturePurpose) => void;
}) {
  const h = useLoadedHealth();
  const [tool, setTool] = useState(tools[0]);
  const [minutes, setMinutes] = useState(String(h.state.preferences?.cookingMinutes ?? 20));
  const [appetite, setAppetite] = useState(appetites[1]);
  const [budget, setBudget] = useState(h.state.preferences?.budget === 'economy' ? budgets[1] : budgets[0]);
  const [note, setNote] = useState('');
  const [menu, setMenu] = useState('');
  const [meal, setMeal] = useState('');
  const [error, setError] = useState('');
  const time = Number(minutes);
  const validTime = Number.isInteger(time) && time >= 5 && time <= 240;
  function ask(build: () => string, purpose: CapturePurpose) {
    if (h.busy) return;
    try {
      const prompt = build();
      setError('');
      onClose();
      void h.send(prompt, undefined, undefined, purpose).catch(() => {
        h.setNotice('Spot could not finish this request. Your food log has not changed. Try again when you are connected.');
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Shorten the details and try again.'); }
  }
  function capture(build: () => string, purpose: CapturePurpose) {
    if (h.busy) return;
    try { const prompt = build(); setError(''); onClose(); onCapture(prompt, purpose); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Shorten the details and try again.'); }
  }
  const textStyle = { color: '#53665b', fontSize: 14, lineHeight: 21 };
  const headingStyle = { color: '#234c35', fontSize: 19, fontWeight: '700' as const };
  return <Sheet title="What would help right now?" onClose={onClose}>
    <View style={{ gap: 18 }}>
      <Choice values={tools} value={tool} onChange={setTool} />
      {error ? <Text style={{ color: '#823b20', fontSize: 14, lineHeight: 21 }}>{error}</Text> : null}
      {tool === tools[0] && <View style={{ gap: 15 }}>
        <Text style={headingStyle}>Let’s make the next meal easier.</Text>
        <Text style={textStyle}>Spot can use your recorded kitchen, leftovers and preferences. Choose before logging anything.</Text>
        <Field label="Time available in minutes" value={minutes} onChangeText={value => setMinutes(value.slice(0, 3))} keyboardType="number-pad" />
        {!validTime && <Text style={textStyle}>Choose between 5 and 240 minutes.</Text>}
        <Text style={textStyle}>What sounds right?</Text>
        <Choice values={appetites} value={appetite} onChange={setAppetite} />
        <Text style={textStyle}>For this meal</Text>
        <Choice values={budgets} value={budget} onChange={setBudget} />
        <Field label="Anything else? Optional, up to 600 characters" value={note} onChangeText={setNote} multiline />
        {h.state.preferences?.restrictions.length ? <Text style={textStyle}>Using your saved food exclusions: {h.state.preferences.restrictions.join(', ')}.</Text> : null}
        <Button label="Find a few good options" disabled={h.busy || !validTime} onPress={() => {
          const appetiteValue: DinnerOptions['appetite'] = appetite === appetites[0] ? 'light' : appetite === appetites[2] ? 'hungry' : 'regular';
          const budgetValue: DinnerOptions['budget'] = budget === budgets[0] ? 'use-stock' : budget === budgets[1] ? 'economy' : 'flexible';
          ask(() => dinnerDecisionPrompt(h.state, { minutes: time, appetite: appetiteValue, budget: budgetValue, note }), 'decide');
        }} />
      </View>}
      {tool === tools[1] && <View style={{ gap: 15 }}>
        <Text style={headingStyle}>Choose something you’ll enjoy.</Text>
        <Text style={textStyle}>Share a menu or ordering screen. Spot can compare a few choices around what matters to you.</Text>
        <Field label="What matters for this order? Optional, up to 600 characters" value={note} onChangeText={setNote} multiline />
        <Button label="Add a menu or order photo" disabled={h.busy} onPress={() => capture(() => menuDecisionPrompt(h.state, '', note), 'menu')} />
        <Text style={textStyle}>Or describe the available choices.</Text>
        <Field label="Menu or order details, up to 2,000 characters" value={menu} onChangeText={setMenu} multiline />
        <Button label="Help me choose" secondary disabled={h.busy || !menu.trim()} onPress={() => ask(() => menuDecisionPrompt(h.state, menu, note), 'menu')} />
        <Text style={textStyle}>Choosing food leaves your food log unchanged. Log what you actually eat afterward.</Text>
      </View>}
      {tool === tools[2] && <View style={{ gap: 15 }}>
        <Text style={headingStyle}>You don’t need every detail.</Text>
        <Text style={textStyle}>Describe what you actually ate, then choose how much help you want with the estimate.</Text>
        <Field label="What did you eat? Up to 2,400 characters" value={meal} onChangeText={setMeal} multiline />
        <Button label="Use a rough estimate" disabled={h.busy || !meal.trim()} onPress={() => ask(() => uncertainMealPrompt(meal, 'rough'), 'rough-meal')} />
        <Text style={textStyle}>See the assumptions and review an approximation.</Text>
        <Button label="Help me narrow it down" secondary disabled={h.busy || !meal.trim()} onPress={() => ask(() => uncertainMealPrompt(meal, 'clarify'), 'clarify-meal')} />
        <Text style={textStyle}>Start with the question that matters most.</Text>
        <Button label="Add a photo of what I ate" secondary disabled={h.busy} onPress={() => capture(() => uncertainMealPrompt(meal.trim() || 'The food shown in the photo I am attaching.', 'rough'), 'rough-meal')} />
        <Text style={textStyle}>Estimates stay editable. You review the details before anything is logged.</Text>
      </View>}
    </View>
  </Sheet>;
}

export default FoodDecisions;
