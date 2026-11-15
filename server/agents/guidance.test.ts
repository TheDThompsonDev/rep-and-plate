import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { followPresentation, presentationInstruction, resultVoice, serverVoice } from '../../src/features/spot/guidance.ts';
import { spotNote, type SpotNote } from '../../src/features/spot/assistant.ts';
import { presentationView } from './presentation.ts';

// The 2026-11-14 readiness review found the assistant's presentation rules written out in five
// places (tool descriptions, server instructions, spot.voice, presentation.ts and the prompts), and
// drifting: spot.voice told the model to work Spot's line into a text reply while the card rule said
// never repeat it, and hosts that pass structured content to the model saw both together.

const root = fileURLToPath(new URL('../..', import.meta.url));
const owner = 'src/features/spot/guidance.ts';

/** Shipped source only: tests may quote the rules they check. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec|d)\.tsx?$/.test(entry.name) ? [path] : [];
  });
}
const files = ['src', 'server', 'scripts'].flatMap(dir => sources(join(root, dir)))
  .map(path => ({ path: relative(root, path).replaceAll('\\', '/'), text: readFileSync(path, 'utf8') }));
const count = (text: string, phrase: string) => text.split(phrase).length - 1;

// One distinctive wording per rule. Each must be written exactly once, in guidance.ts. The in-app
// chat prompt (server/ai.ts) shares the app's food ethos in its own words and is not an MCP surface.
const rules = [
  'Follow presentation.instruction', // the pointer every surface shares
  'Always write a useful coaching reply below the card', // below the coaching card
  'one focused follow-up question',
  'Do not repeat Spot’s joke', // a card already shows it
  'introduce yourself as Spot',
  'character line only', // the basic Spot card
  'Spot’s line naturally', // text only
  'a little sassy', // tone
  'never about the person’s body', // Spot's limits
  'drop the jokes',
  'Missing records are unknown', // facts first
  'Never claim a write succeeded',
];

describe('assistant guidance has one owner', () => {
  it('writes every presentation and voice rule once, in guidance.ts', () => {
    for (const rule of rules) {
      const found = files.filter(file => file.text.includes(rule)).map(file => `${file.path} ×${count(file.text, rule)}`);
      expect(found, rule).toEqual([`${owner} ×1`]);
    }
  });
  it('leaves no second copy under an old name, and one spotVoice (the in-app one)', () => {
    for (const name of ['spotToolNote', 'spotCoachVoice', 'cardReplyInstruction']) {
      expect(files.filter(file => file.text.includes(name)).map(file => file.path), name).toEqual([]);
    }
    expect(files.filter(file => /export const spotVoice\b/.test(file.text)).map(file => file.path)).toEqual(['src/features/spot/personality.ts']);
  });
  it('keeps the pointer short, since it rides on every tool description', () => {
    expect(followPresentation.length).toBeLessThan(80);
    expect(resultVoice.startsWith(followPresentation)).toBe(true);
    expect(serverVoice).toContain(followPresentation);
  });
});

describe('card and text-only rules never meet', () => {
  const coachingCard = presentationInstruction('coaching', true);
  const spotCard = presentationInstruction('spot', true);
  const text = presentationInstruction('coaching', false);

  it('keeps every surface outside presentation.instruction the same in every mode', () => {
    for (const surface of [followPresentation, resultVoice, serverVoice]) {
      expect(surface).not.toMatch(/card|text-only|naturally|at most once|Do not repeat/i);
    }
  });
  it('tells a card host not to repeat the joke and a text-only host to use it at most once', () => {
    for (const rule of [coachingCard, spotCard]) {
      expect(rule).toContain('Do not repeat Spot’s joke');
      expect(rule).not.toContain('Spot’s line');
    }
    expect(text).toContain('Include Spot’s line naturally at most once');
    expect(text).not.toMatch(/Do not repeat|below the card/);
    expect(presentationInstruction('spot', false)).toBe(text);
  });
  it('puts each rule under its own condition when the host may or may not draw the card', () => {
    const auto = presentationInstruction('coaching', undefined);
    const order = ['If this host displays the interactive coaching card', 'Do not repeat Spot’s joke', 'If no card is displayed', 'Spot’s line naturally', 'Missing records are unknown'].map(phrase => auto.indexOf(phrase));
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(count(auto, 'Missing records are unknown')).toBe(1);
  });
  it('keeps a short summary, saved facts and one follow-up below the coaching card', () => {
    expect(coachingCard).toContain('Always write a useful coaching reply below the card');
    expect(coachingCard).toContain('saved facts and nextSteps for a short summary');
    expect(coachingCard).toContain('one focused follow-up question or practical next action');
    expect(coachingCard).toContain('Do not give only a pointer');
  });
  it('shows a host that hands structured content to the model no text-only rule beside a card', () => {
    // The structured result keeps spot for cached cards, so the voice beside spot.says must suit any mode.
    const { structuredView, modelView } = presentationView({ spot: spotNote('today', '2026-11-14') }, true);
    const spot = structuredView.spot as SpotNote;
    expect(spot.says).toBeTruthy();
    expect(spot.voice).toBe(resultVoice);
    expect(structuredView.presentation.instruction).toBe(coachingCard);
    expect(modelView.spot).toBeUndefined();
  });
});
