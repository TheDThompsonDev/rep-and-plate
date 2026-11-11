import { describe, expect, it } from 'vitest';
import { connectionLifetimes, defaultLifetimeDays, expiryNextStep, expiryNotice, firstMessage, MAX_LIFETIME_DAYS, mcpAddress, setupGuides } from './setup';
import { manageRequestSchema } from './contracts';

const token = 'rpagent.11111111-1111-4111-8111-111111111111.' + 'a'.repeat(43);
const now = Date.parse('2026-11-10T12:00:00Z');
const inDays = (days: number) => new Date(now + days * 86_400_000).toISOString();

describe('setting up an assistant', () => {
  it('gives each assistant steps a person can paste without a checkout of this project', () => {
    const guides = setupGuides('https://repandplate.example/', token);
    expect(guides.map(guide => guide.id)).toEqual(['claude-code', 'codex', 'claude', 'chatgpt', 'other']);
    const text = JSON.stringify(guides);
    expect(text).not.toMatch(/npm |REP_PLATE_URL|this project/);
    const claudeCode = guides[0].steps[0].copy;
    expect(claudeCode).toBe(`claude mcp add --transport http rep-and-plate --scope user https://repandplate.example/api/agents/mcp --header "Authorization: Bearer ${token}"`);
    const codex = guides[1].steps.map(step => step.copy);
    expect(codex).toContain('codex mcp add rep-and-plate --url https://repandplate.example/api/agents/mcp --bearer-token-env-var REP_PLATE_TOKEN');
    expect(codex).toContain(`export REP_PLATE_TOKEN="${token}"`);
    expect(codex).toContain(`setx REP_PLATE_TOKEN "${token}"`);
  });

  it('ends every working guide with something to say, and is honest about hosts that cannot connect', () => {
    const guides = setupGuides('https://repandplate.example', token);
    for (const guide of guides.filter(item => item.status === 'ready'))
      expect(guide.steps.some(step => step.copy === firstMessage)).toBe(true);
    const chatgpt = guides.find(guide => guide.id === 'chatgpt')!;
    expect(chatgpt.status).toBe('unavailable');
    expect(chatgpt.steps.every(step => !step.copy)).toBe(true);
    const claude = guides.find(guide => guide.id === 'claude')!;
    expect(claude.status).toBe('ready');
    expect(claude.steps.map(step => step.copy)).toEqual(['https://repandplate.example/api/agents/mcp', undefined, `Bearer ${token}`, firstMessage]);
    expect(claude.steps[1].text).toContain('No sign in');
    // Claude chat connects from Anthropic's servers, so a local address must not be offered as working.
    for (const local of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173']) {
      const here = setupGuides(local, token).find(guide => guide.id === 'claude')!;
      expect(here.status).toBe('unavailable');
      expect(here.steps.every(step => !step.copy)).toBe(true);
    }
    expect(mcpAddress('http://localhost:5173')).toBe('http://localhost:5173/api/agents/mcp');
  });
});

describe('how long a connection lasts', () => {
  it('offers lifetimes the server accepts and defaults to the middle one', () => {
    expect(connectionLifetimes.map(option => option.days)).toContain(defaultLifetimeDays);
    for (const option of connectionLifetimes)
      expect(manageRequestSchema.safeParse({ operation: 'create', name: 'Coach', scopes: ['coaching:read'], expiresInDays: option.days }).success).toBe(true);
    expect(manageRequestSchema.safeParse({ operation: 'create', name: 'Coach', scopes: ['coaching:read'], expiresInDays: MAX_LIFETIME_DAYS + 1 }).success).toBe(false);
    expect(manageRequestSchema.safeParse({ operation: 'renew', connectionId: '11111111-1111-4111-8111-111111111111', expiresInDays: 90 }).success).toBe(true);
  });

  it('says plainly how long is left and when to act', () => {
    expect(expiryNotice(inDays(60), now)).toMatchObject({ state: 'active', days: 60, label: 'Works for 60 more days', renewable: true });
    expect(expiryNotice(inDays(14), now)).toMatchObject({ state: 'soon', days: 14 });
    expect(expiryNotice(inDays(0.2), now)).toMatchObject({ state: 'soon', label: 'Works for 1 more day' });
    expect(expiryNotice(inDays(-0.5), now)).toMatchObject({ state: 'expired', label: 'Stopped working today', renewable: true });
    expect(expiryNotice(inDays(-3), now)).toMatchObject({ state: 'expired', label: 'Stopped working 3 days ago', renewable: true });
    expect(expiryNotice(inDays(-31), now).renewable).toBe(false);
  });

  it('only asks the assistant to mention renewal when the key is close to running out', () => {
    expect(expiryNextStep(inDays(60), now)).toBeNull();
    expect(expiryNextStep(inDays(-1), now)).toBeNull();
    expect(expiryNextStep(inDays(5), now)).toContain('stops working in 5 days');
    expect(expiryNextStep(inDays(5), now)).toContain('Keep connected');
  });
});
