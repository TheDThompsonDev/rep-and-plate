import { createHash } from 'node:crypto';
import { spotBannerMarkup, spotBannerScript } from './spot-banner.ts';
import { coachingAppStyle as style } from './coaching-style.ts';
import { uiResourceUri } from './ui-resource.ts';

export const LEGACY_COACHING_APP_URI = 'ui://rep-and-plate/coaching.html';
export const COACHING_APP_MIME = 'text/html;profile=mcp-app';

/** Static executable content only. Tool data enters exclusively through textContent. */
const script = String.raw`
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  ${spotBannerScript}
  const pending = new Map(), undoRequests = new Map();
  let parentOrigin = null, initialized = false, hostTools = false, busy = false, disposed = false, resizeObserver = null;
  let data = {}, granted = new Set(), feedbackRequest = null;
  const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = String(text); if (className) node.className = className; return node; };
  const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const array = value => Array.isArray(value) ? value : [];
  const notice = message => { const target = $('notice'); if (!disposed && target) target.textContent = message; };
  const send = message => window.parent.postMessage(message, parentOrigin && parentOrigin !== 'null' ? parentOrigin : '*');
  const notify = (method, params) => { if (initialized) send({ jsonrpc: '2.0', method, params }); };
  const request = (method, params, timeout = 20000) => new Promise((resolve, reject) => {
    if (disposed) { reject(new Error('The coaching view was closed.')); return; }
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('The host did not answer. Check the saved state before retrying.')); }, timeout);
    pending.set(id, { resolve, reject, timer, method, initialize: method === 'ui/initialize' });
    send({ jsonrpc: '2.0', id, method, params });
  });
  const allowed = operation => initialized && hostTools && granted.has(operation) && !busy;
  const state = () => record(data.state || (Number.isInteger(data.revision) ? data : null));
  const day = () => String(data.day || record(data.brief).day || '');
  const revision = () => Number.isInteger(state().revision) && state().revision >= 0 ? state().revision : null;
  const sessions = () => array(state().sessions);
  const proposals = () => array(data.proposals || state().proposals).concat(data.proposal ? [data.proposal] : []).filter((value,index,list) => value && list.findIndex(other => other.id === value.id) === index);
  const title = item => String(item.title || item.name || item.label || 'Training session');
  const sessionDay = item => String(item.day || item.scheduledDay || item.date || '');
  const minutes = item => item.minutes ?? item.durationMinutes ?? item.plannedMinutes;
  const formatDay = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value + 'T12:00:00');
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(date) : value;
  };
  const canReview = () => allowed('coaching.resolve');
  function ingest(result) {
    const reply = record(result);
    if (reply.isError) { const error = record(record(reply.structuredContent).error); throw new Error(String(error.message || 'That action could not finish. Refresh the saved plan before retrying.')); }
    const operations = record(reply._meta).coachingOperations;
    if (Array.isArray(operations)) granted = new Set(operations);
    const incoming = record(reply.structuredContent);
    if (incoming.error) throw new Error(String(record(incoming.error).message || 'The action could not finish.'));
    const next = record(incoming.coaching || incoming);
    data = { ...data, ...next };
    if (next.state && Array.isArray(next.state.proposals)) data.proposals = next.state.proposals;
    if (next.state && !next.proposal) delete data.proposal;
    if (next.proposal) {
      const previous = array(data.proposals).filter(item => item.id !== next.proposal.id);
      data.proposals = [...previous, next.proposal];
    }
    render();
  }
  async function call(name, args, operation) {
    if (!allowed(operation)) throw new Error('This connection or host has not enabled that action. Use the text tools or Rep & Plate.');
    busy = true; render();
    try { const result = await request('tools/call', { name, arguments: args }); ingest(result); return result; }
    finally { busy = false; render(); }
  }
  async function refresh() {
    if (!allowed('coaching.read')) return;
    await call('get_coaching_day', day() ? { day: day() } : {}, 'coaching.read');
  }
  const action = (label, handler, disabled, primary = false) => {
    const button = element('button', label, primary ? 'primary' : ''); button.type = 'button'; button.disabled = disabled;
    button.addEventListener('click', () => Promise.resolve().then(handler).catch(error => notice(error.message || 'That action could not finish.'))); return button;
  };
  function describe(value, target) {
    const list = element('ul');
    const snapshot = record(value);
    const profile = record(snapshot.profile);
    for (const [key, field] of Object.entries(profile)) if (field !== null && field !== '' && (Array.isArray(field) ? field.length > 0 : typeof field !== 'object')) list.append(element('li', key.replace(/([A-Z])/g, ' $1') + ': ' + (Array.isArray(field) ? field.join(', ') : field)));
    for (const session of array(snapshot.sessions)) list.append(element('li', title(session) + ' · ' + sessionDay(session) + (minutes(session) !== undefined ? ' · ' + minutes(session) + ' min' : '') + (session.status ? ' · ' + session.status : '')));
    for (const outcome of array(snapshot.outcomes)) {
      const session = sessions().find(item => item.id === outcome.sessionId);
      list.append(element('li', (session ? title(session) + ': ' : 'Result: ') + outcome.status + ' · ' + formatDay(outcome.day || '') + (outcome.actualMinutes !== undefined ? ' · ' + outcome.actualMinutes + ' min' : '') + (outcome.effort !== undefined ? ' · effort ' + outcome.effort + '/10' : '') + (outcome.note ? ' · ' + outcome.note : '')));
    }
    for (const memory of array(snapshot.memories)) list.append(element('li', 'Remember: ' + memory.text));
    if (!list.childNodes.length) list.append(element('li', 'No values on this side of the change.'));
    target.append(list);
    const details = element('details'); details.append(element('summary','Exact changed values')); details.append(element('pre',JSON.stringify(value,null,2))); target.append(details);
  }
  function renderSessions(target, values, empty, limit = 14) {
    target.replaceChildren();
    if (!values.length) { target.append(element('p',empty,'muted')); return; }
    for (const item of values.slice(0,limit)) {
      const row = element('div',undefined,'session'); const info = element('div'); info.append(element('strong',title(item)));
      info.append(element('span',formatDay(sessionDay(item)) + (minutes(item) !== undefined ? ' · ' + minutes(item) + ' min' : ''),'muted'));
      if (item.details) info.append(element('span',item.details,'muted'));
      const outcome = array(state().outcomes).find(value => value.sessionId === item.id);
      if (outcome) info.append(element('span','Reported ' + outcome.status,'status'));
      row.append(info);
      if (allowed('coaching.propose') && item.id) row.append(action(outcome ? 'Update result' : 'Report result',() => openFeedback(item),false));
      target.append(row);
    }
    if (values.length > limit) target.append(element('p',(values.length - limit) + ' more in your plan below.','muted'));
  }
  function renderSummary(today, upcoming, brief, saved) {
    const goal = record(saved.profile).primaryGoal;
    const awaiting = array(brief.awaitingFeedback);
    const noPlan = !goal && !today.length && !upcoming.length && !awaiting.length;
    $('summary').hidden = proposals().length > 0;
    $('summary-title').textContent = revision() === null ? 'Getting your coaching plan…'
      : noPlan ? 'What are we training for?'
      : today.length ? 'Today’s plan'
      : awaiting.length ? 'How did it go?'
      : upcoming.length ? 'Up next' : 'Let’s plan your week';
    $('summary-goal').textContent = goal || '';
    $('summary-goal').hidden = !goal;
    const primary = today.length ? today : awaiting.length ? awaiting : upcoming.slice(0,1);
    renderSessions($('summary-sessions'),primary,'',2);
    const prompt = $('next-step'); prompt.replaceChildren();
    if (revision() === null) return;
    if (!goal) { prompt.textContent = 'Tell me your goal in chat. We’ll build a week around it.'; return; }
    const earlier = awaiting[0];
    if (earlier) {
      const match = array(record(data.evidence).activities).find(item => item.day === sessionDay(earlier) && item.sport === earlier.sport);
      if (match) {
        const source = String(match.source || 'Another app').replace(/(^|[ _.-])([a-z])/g,(_text,gap,letter) => (gap ? ' ' : '') + letter.toUpperCase());
        prompt.append(element('span',source + ': ' + title(match) + (minutes(match) !== undefined ? ' · ' + minutes(match) + ' min' : '') + '. '));
        prompt.append(element('span','Was that your “' + title(earlier) + '” on ' + formatDay(sessionDay(earlier)) + '? Tell me in chat.'));
      } else prompt.textContent = 'How did “' + title(earlier) + '” on ' + formatDay(sessionDay(earlier)) + ' go? Tell me in chat, or report the result.';
    } else if (!today.length && !upcoming.length) prompt.textContent = 'Want me to draft your next seven days? Tell me what fits this week.';
    else if (today.length) {
      const reported = today.every(item => array(saved.outcomes).some(outcome => outcome.sessionId === item.id));
      prompt.textContent = reported ? 'Your reported results are saved. Want to look at what’s next?' : 'When you’re ready, tell me how it went or report the result here.';
    } else prompt.textContent = 'Want to adjust what’s coming up? Tell me what needs to change.';
  }
  function render() {
    if (disposed) return;
    renderSpot(data.spot);
    const saved = state(), brief = record(data.brief), currentDay = day();
    $('day').textContent = formatDay(currentDay) || '';
    const fresh = record(data.freshness);
    const at = data.publishedAt || fresh.publishedAt || data.dataUpdatedAt || fresh.dataUpdatedAt;
    const updated = at ? new Date(at) : null;
    $('freshness').textContent = updated && Number.isFinite(updated.getTime())
      ? 'App-recorded food and workouts last updated ' + new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(updated) + '. Newer app entries may not be included.'
      : 'App-recorded food and workouts are unavailable on this connection. Your saved coaching plan is separate.';
    $('revision').textContent = revision() === null ? 'Awaiting saved state' : 'Revision ' + revision();
    $('refresh').disabled = !allowed('coaching.read');
    const all = sessions();
    const today = array(brief.today).length ? array(brief.today) : all.filter(item => sessionDay(item) === currentDay);
    const upcoming = array(brief.upcoming).length ? array(brief.upcoming) : all.filter(item => sessionDay(item) > currentDay);
    renderSummary(today,upcoming,brief,saved);
    $('review').hidden = proposals().length === 0;
    $('more-plan').hidden = revision() === null || (!record(saved.profile).primaryGoal && !all.length && !array(brief.awaitingFeedback).length && !array(saved.journal).length);
    $('today-card').hidden = today.length === 0;
    $('upcoming-card').hidden = upcoming.length === 0;
    renderSessions($('today'),today,'No session is scheduled for this day.');
    renderSessions($('upcoming'),upcoming,'No upcoming sessions are saved.');
    $('brief').replaceChildren();
    const profile = record(saved.profile), weekly = record(data.weekly);
    if (profile.primaryGoal) $('brief').append(element('p',profile.primaryGoal));
    if (typeof brief.summary === 'string') $('brief').append(element('p',brief.summary));
    else if (typeof data.brief === 'string') $('brief').append(element('p',data.brief));
    if (Number.isInteger(weekly.plannedSessions) || Array.isArray(weekly.planned)) $('brief').append(element('p',(weekly.completedSessions ?? array(weekly.completed).length) + ' completed · ' + (weekly.skippedSessions ?? array(weekly.skipped).length) + ' skipped · ' + (weekly.unreportedSessions ?? array(weekly.unreported).length) + ' awaiting feedback'));
    if (Number.isFinite(weekly.completedActualMinutes)) $('brief').append(element('p',weekly.completedActualMinutes + ' reported minutes' + (weekly.completedWithoutMinutes ? ' · ' + weekly.completedWithoutMinutes + ' completed sessions without reported minutes' : '')));
    for (const observation of array(weekly.observations)) $('brief').append(element('p',observation));
    for (const missing of array(brief.missingData)) $('brief').append(element('p',missing,'muted'));
    if (!$('brief').childNodes.length) $('brief').append(element('p','Your weekly picture will build from the plan and feedback you save.','muted'));
    const list = $('proposals'); list.replaceChildren();
    for (const proposal of proposals()) {
      const card = element('article',undefined,'card ' + (proposal.status === 'pending' ? 'pending' : proposal.status === 'accepted' ? 'approved' : ''));
      card.append(element('h2',proposal.status === 'pending' ? 'Proposed change · awaiting your approval' : 'Change ' + proposal.status));
      const command = record(proposal.command);
      card.append(element('p',command.reason || command.type || 'Review these saved values.'));
      if (proposal.before || proposal.after) {
        const comparison = element('div',undefined,'beforeafter'); const before = element('section'), after = element('section');
        before.append(element('h3','Changed values before')); after.append(element('h3','Changed values after approval')); describe(proposal.before,before); describe(proposal.after,after); comparison.append(before,after); card.append(comparison);
      }
      if (proposal.status === 'pending') {
        if (proposal.needsReview) card.append(element('p','The saved plan changed after this proposal. Refresh and propose a new change for review.'));
        const confirm = element('label',undefined,'check'), checkbox = element('input'); checkbox.type = 'checkbox';
        confirm.append(checkbox,element('span','I reviewed the before and after details and approve this change.')); card.append(confirm);
        const buttons = element('div',undefined,'actions');
        const apply = action('Apply reviewed change',async () => {
          if (!checkbox.checked || proposal.needsReview) return;
          await call('resolve_coaching_change',{ proposalId: proposal.id, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' },'coaching.resolve');
          notice('Reviewed change applied.'); await refresh();
        },true,true);
        checkbox.addEventListener('change',() => { apply.disabled = !checkbox.checked || !canReview() || proposal.needsReview === true; });
        checkbox.disabled = !canReview() || proposal.needsReview === true;
        buttons.append(apply,action('Dismiss',async () => {
          await call('resolve_coaching_change',{ proposalId: proposal.id, status: 'dismissed' },'coaching.resolve'); notice('Proposal dismissed.'); await refresh();
        },!canReview())); card.append(buttons);
      }
      list.append(card);
    }
    if (!proposals().length) list.append(element('p','No change is awaiting approval.','muted'));
    if (record(data.omitted).pendingProposals) list.append(element('p',data.omitted.pendingProposals + ' additional pending proposals are available in Rep & Plate.','muted'));
    $('history').replaceChildren();
    const history = array(saved.journal || saved.history || saved.entries || brief.recentChanges || data.history);
    $('history-card').hidden = history.length === 0;
    for (const entry of history.slice(-8).reverse()) {
      const item = element('div',undefined,'session'); item.append(element('span',entry.reason || record(entry.command).reason || entry.type || 'Saved coaching change'));
      if (entry.id && entry.kind === 'apply' && entry.revision === revision()) item.append(action('Review undo',() => {
        const panel = $('undo'); panel.replaceChildren(); panel.append(element('p','Undo this recorded change only if you want its saved values restored. Newer conflicting changes will prevent undo.'));
        panel.append(action('Undo this change',async () => {
          const baseRevision = revision(); if (baseRevision === null) throw new Error('Refresh the saved plan first.');
          const key = entry.id + ':' + baseRevision;
          if (!undoRequests.has(key)) undoRequests.set(key,crypto.randomUUID());
          await call('undo_coaching_change',{ requestId: undoRequests.get(key),entryId: entry.id,baseRevision },'coaching.undo'); notice('Undo completed.'); panel.replaceChildren(); await refresh();
        },!allowed('coaching.undo'),true));
      },!allowed('coaching.undo'))); $('history').append(item);
    }
    $('feedback-submit').disabled = !allowed('coaching.propose') || revision() === null;
  }
  function openFeedback(session) {
    feedbackRequest = null; const form = $('feedback'); form.hidden = false;
    $('feedback-session').value = String(session.id); $('feedback-title').textContent = title(session);
    $('feedback-day').value = day() || sessionDay(session); $('feedback-note').value = ''; $('feedback-status').value = 'completed'; $('feedback-minutes').value = ''; $('feedback-effort').value = '';
    $('feedback-note').focus();
  }
  $('feedback').addEventListener('submit',event => {
    event.preventDefault();
    void (async () => {
      const baseRevision = revision(); if (baseRevision === null) throw new Error('Refresh the saved plan before proposing feedback.');
      const outcome = { id: feedbackRequest ? feedbackRequest.outcomeId : crypto.randomUUID(),sessionId: $('feedback-session').value,day: $('feedback-day').value,status: $('feedback-status').value,note: $('feedback-note').value.trim() };
      if ($('feedback-minutes').value !== '') outcome.actualMinutes = Number($('feedback-minutes').value);
      if ($('feedback-effort').value !== '') outcome.effort = Number($('feedback-effort').value);
      const command = { type: 'record_outcome',outcome,reason: 'Feedback entered by the user in the coaching review.' };
      const key = JSON.stringify({baseRevision,command});
      if (!feedbackRequest || feedbackRequest.key !== key) feedbackRequest = {key,id: crypto.randomUUID(),outcomeId: outcome.id};
      await call('propose_coaching_change',{requestId: feedbackRequest.id,baseRevision,command},'coaching.propose');
      $('feedback').hidden = true; notice('Feedback proposed. Review the change below before applying it.');
    })().catch(error => notice(error.message || 'Feedback could not be proposed.'));
  });
  $('feedback-close').addEventListener('click',() => { $('feedback').hidden = true; });
  $('refresh').addEventListener('click',() => { void refresh().catch(error => notice(error.message)); });
  window.addEventListener('message',event => {
    if (event.source !== window.parent || (parentOrigin !== null && event.origin !== parentOrigin)) return;
    const message = record(event.data); if (message.jsonrpc !== '2.0') return;
    if (pending.has(message.id)) {
      const waiter = pending.get(message.id); pending.delete(message.id); clearTimeout(waiter.timer);
      if (waiter.initialize && !message.error) parentOrigin = event.origin;
      if (message.error) waiter.reject(new Error(String(record(message.error).message || 'The host rejected this request.'))); else waiter.resolve(message.result);
      return;
    }
    if (message.method === 'ui/resource-teardown') {
      disposed = true; initialized = false; hostTools = false; busy = false;
      if (resizeObserver) resizeObserver.disconnect();
      for (const waiter of pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('The coaching view was closed.')); } pending.clear();
      if (message.id !== undefined) send({jsonrpc:'2.0',id:message.id,result:{}});
      return;
    }
    if (!initialized || disposed) return;
    if (message.method === 'ui/notifications/tool-result') { try { ingest(message.params); } catch(error) { notice(error.message); } }
    else if (message.method === 'ui/notifications/tool-cancelled') {
      for (const [id, waiter] of pending) if (waiter.method === 'tools/call') { pending.delete(id); clearTimeout(waiter.timer); waiter.reject(new Error('The tool call was cancelled. Refresh the saved plan before retrying.')); }
      busy = false; notice('The tool call was cancelled. Refresh the saved plan before retrying.'); render();
    }
    else if (message.method === 'ui/notifications/host-context-changed') { applyHostTheme(record(message.params)); }
    else if (message.method === 'ping' && message.id !== undefined) send({jsonrpc:'2.0',id:message.id,result:{}});
  });
  render();
  if (window.parent === window || !globalThis.crypto || typeof crypto.randomUUID !== 'function') {
    notice('Open this view in a compatible MCP Apps host. Coaching details are also available in the tool’s complete text result.'); return;
  }
  request('ui/initialize',{appInfo:{name:'rep-and-plate-coaching',version:'1.0.0'},appCapabilities:{availableDisplayModes:['inline']},protocolVersion:'2026-01-26'},5000).then(result => {
    const initialization = record(result);
    if (typeof initialization.protocolVersion !== 'string') throw new Error('This host did not complete the MCP Apps handshake. Use the complete text tools.');
    initialized = true; hostTools = !!record(initialization.hostCapabilities).serverTools;
    notify('ui/notifications/initialized',{});
    applyHostTheme(record(initialization.hostContext));
    notice(hostTools ? '' : 'You can review details here. Ask in chat to make changes; this host has not enabled card actions.');
    render();
    if (typeof ResizeObserver === 'function') { resizeObserver = new ResizeObserver(() => notify('ui/notifications/size-changed',{width:document.documentElement.clientWidth,height:Math.ceil(document.body.getBoundingClientRect().height)})); resizeObserver.observe(document.body); }
  }).catch(error => { initialized = false; hostTools = false; notice(error.message + ' The complete coaching details remain available in the tool’s text result.'); render(); });
})();
`;

const hash = (value: string) => createHash('sha256').update(value).digest('base64');
const csp = `default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(style)}'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;

export const coachingAppHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Your coaching day · Rep & Plate</title><style>${style}</style></head><body>
<header><div><p class="eyebrow">REP &amp; PLATE</p><span id="day" class="muted"></span></div><button id="refresh" type="button" disabled>Refresh plan</button></header>
${spotBannerMarkup}
<p id="notice" role="status" aria-live="polite"></p>
<section id="summary" aria-labelledby="summary-title"><h1 id="summary-title">Getting your coaching plan…</h1><p id="summary-goal" class="muted" hidden></p><div id="summary-sessions"></div><p id="next-step" class="next-step"></p></section>
<section id="review" aria-label="Changes for your review" hidden><div id="proposals"></div></section>
<form id="feedback" class="card" hidden><h2>How did it go?</h2><p id="feedback-title"></p><input id="feedback-session" type="hidden"><label>Date<input id="feedback-day" type="date" required></label><label>Result<select id="feedback-status"><option value="completed">Completed</option><option value="skipped">Skipped</option></select></label><div class="grid"><label>Minutes, if known<input id="feedback-minutes" type="number" min="0" max="1440" step="1"></label><label>Effort, if known (1–10)<input id="feedback-effort" type="number" min="1" max="10" step="1"></label></div><label>Anything to remember?<textarea id="feedback-note" maxlength="2000"></textarea></label><p class="muted">Submitting prepares a change for your review. It will be applied after you approve it.</p><div class="actions"><button id="feedback-submit" class="primary" type="submit" disabled>Propose feedback</button><button id="feedback-close" type="button">Cancel</button></div></form>
<details id="more-plan"><summary>More of your plan</summary>
<div class="grid"><section id="today-card" class="card"><h2>Today</h2><div id="today"></div></section><section id="upcoming-card" class="card"><h2>Upcoming</h2><div id="upcoming"></div></section></div>
<section class="card"><h2>This week</h2><div id="brief"></div></section>
<section id="history-card" class="card"><h2>Recent changes</h2><div id="history"></div><div id="undo" class="actions"></div></section>
<p id="freshness" class="muted"></p><p id="revision" class="muted"></p>
</details>
<script>${script}</script></body></html>`;

export const COACHING_APP_URI = uiResourceUri('coaching', coachingAppHtml);

export const coachingAppResource = {
  uri: COACHING_APP_URI,
  mimeType: COACHING_APP_MIME,
  text: coachingAppHtml,
  _meta: { ui: { csp: { connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] }, permissions: {}, prefersBorder: true } },
};
