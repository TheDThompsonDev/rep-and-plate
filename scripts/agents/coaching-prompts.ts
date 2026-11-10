import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

const user = (text: string) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] });
const optional = (description: string) => z.string().trim().max(500).optional().describe(description);

/**
 * Ready-made ways back into the plan. A host lists these as commands, so someone who never opens
 * the app still has a one-tap daily and weekly habit. Each one names the tools and the approval
 * rule it relies on; none of them grants approval by itself.
 */
export function registerCoachingPrompts(server: McpServer, operations: readonly string[]) {
  if (!operations.includes('coaching.read')) return;
  const canWrite = operations.includes('coaching.propose');
  const canImport = operations.includes('coaching.import');
  const importOffer = canImport ? ' If you can reach my other training or nutrition apps and their records here are behind, offer to bring in what is new.' : '';

  server.registerPrompt('morning_check_in', {
    title: 'Morning check-in with Spot',
    description: 'Today’s session, anything still unreported, and the one next step that matters.',
  }, () => user(`Give me my Rep & Plate morning check-in. Call get_coaching_day first. Then, in a few short lines: what is planned today, anything from the last week I have not reported on, and the single most useful next step from nextSteps. Say plainly if records are stale or missing instead of guessing.${importOffer} Keep it brief and use Spot’s voice lightly.`));

  if (canWrite) server.registerPrompt('log_what_i_did', {
    title: 'Log what I did',
    description: 'Report a run, lift or other session and attach it to the plan.',
    argsSchema: z.object({ what: optional('What you did, in your own words. For example: "easy 8k, 46 minutes, felt fine".') }),
  }, ({ what }) => user(`${what ? `Here is what I did: ${what}.` : 'I want to log a session I did. Ask me what it was if I have not said.'} Call get_coaching_day and find the planned session it matches. If one matches, prepare a record_outcome change with propose_coaching_change, show me the before and after, and apply it only after I say yes. If nothing in the plan matches, tell me, and ask whether to add it to the plan or simply keep it as a record.${canImport ? ' If the details came from another app, save them with import_records after I confirm the summary.' : ''} Do not assume I completed anything I did not report.`));

  if (canImport) server.registerPrompt('sync_my_apps', {
    title: 'Bring in my other apps',
    description: 'Pull recent runs, lifts and nutrition days from the apps you can reach into one record.',
    argsSchema: z.object({ apps: optional('Apps to read, for example "Strava, Coros, MacroFactor". Leave empty to use every training or nutrition app you can reach.'), days: optional('How many days back to look. Defaults to 7.') }),
  }, ({ apps, days }) => user(`Bring my recent records into Rep & Plate so they live in one place. Read the last ${days || '7'} days from ${apps || 'each training and nutrition app you have tools for'}. Call get_coaching_day to see what is already saved. Show me one short table of what you would save (activities with source, day, sport, minutes and distance; nutrition days with source and totals), skipping anything already there. Use the source app’s own identifier as externalId so nothing is duplicated. After I confirm, call import_records once with confirmation "SAVE_REPORTED_RECORDS". Then tell me what was added, updated and unchanged. These are records, not outcomes: do not mark any planned session done. If you cannot reach an app, say so instead of estimating.`));

  server.registerPrompt('weekly_review', {
    title: 'Weekly review with Spot',
    description: 'What was planned, what I reported, what my other apps show, and one thing to adjust.',
  }, () => user(`Run my Rep & Plate weekly review. Call get_coaching_day. Compare what was planned with what I explicitly reported and with the records brought in from other apps, across running, lifting and nutrition. Tell me what went to plan, what is unknown (not missed), and one specific adjustment worth considering for next week given my goal, priorities and constraints.${canWrite ? ' If I agree, prepare it as a proposal and show the before and after before applying.' : ''} Describe recorded totals without judging them. Keep it short.`));

  if (canWrite) server.registerPrompt('plan_my_week', {
    title: 'Plan my week',
    description: 'Draft the next seven days around your goal, constraints and recent training.',
    argsSchema: z.object({ notes: optional('Anything special about this week: travel, a race, a sore knee, a short Wednesday.') }),
  }, ({ notes }) => user(`Plan my next seven days in Rep & Plate.${notes ? ` This week: ${notes}.` : ''} Call get_coaching_day and use my agreed goal, priorities, constraints, saved memories, recent reported outcomes and records from other apps. If no goal is agreed yet, ask me for one and propose a setup change first. Draft the week as a single replace_week proposal with propose_coaching_change, balance running against lifting so hard days do not stack, show me the before and after, and apply it only after I say yes. Do not invent readiness or recovery scores.`));
}
