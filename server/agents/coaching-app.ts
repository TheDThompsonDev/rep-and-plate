import { createHash } from 'node:crypto';

export const COACHING_APP_URI = 'ui://rep-and-plate/coaching.html';
export const COACHING_APP_MIME = 'text/html;profile=mcp-app';

const style = String.raw`
:root{color-scheme:light dark;--bg:#f5faf6;--surface:#fff;--ink:#173d31;--muted:#526e61;--line:#d5e5da;--accent:#006249;font-family:var(--font-sans,system-ui,sans-serif);font-size:14px;background:var(--bg);color:var(--ink)}*{box-sizing:border-box}body{margin:0;padding:18px}header,.row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}h1{font-size:21px;letter-spacing:-.5px;margin:2px 0}h2{font-size:16px;margin:0 0 10px}h3{font-size:14px;margin:0 0 7px}p{line-height:1.5;margin:7px 0}.eyebrow{font-size:10px;letter-spacing:1.5px;font-weight:800;color:var(--accent);margin:0}.muted,small{color:var(--muted)}.pill{font-size:11px;padding:5px 9px;border:1px solid var(--line);border-radius:99px}.card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:15px;margin-top:13px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.grid>.card{margin-top:0}ul{padding-left:18px;margin:8px 0}li{line-height:1.5;margin:6px 0}button{border:1px solid var(--line);border-radius:10px;padding:10px 13px;min-height:42px;font:inherit;font-weight:600;background:var(--surface);color:var(--ink);cursor:pointer}button.primary{background:var(--accent);color:#fff;border-color:var(--accent)}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:3px solid #72b895;outline-offset:3px}label{display:grid;gap:5px;margin:10px 0;font-size:12px;font-weight:600}input,select,textarea{font:inherit;font-size:16px;padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);width:100%}textarea{min-height:74px;resize:vertical}pre{font:11px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:280px;overflow:auto}details{margin-top:10px}summary{cursor:pointer;min-height:32px;line-height:32px}#notice{padding:10px 0;min-height:34px;font-size:12px}.pending{border-left:4px solid #c39a2f}.approved{border-left:4px solid var(--accent)}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.check{display:flex;gap:8px;align-items:flex-start;font-weight:400;line-height:1.5}.check input{width:auto;margin-top:4px}.beforeafter{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.beforeafter section{padding:10px;border:1px solid var(--line);border-radius:10px}#feedback[hidden]{display:none}.session{display:flex;gap:10px;align-items:flex-start;justify-content:space-between;border-top:1px solid var(--line);padding-top:9px;margin-top:9px}.session:first-child{border-top:0;padding-top:0;margin-top:0}.session span{display:block}.session .muted{font-size:12px}.feedback-actions{margin-top:10px}.status{font-size:11px;text-transform:capitalize}@media(max-width:520px){body{padding:12px}.grid,.beforeafter{grid-template-columns:1fr}.card{padding:12px}}@media(prefers-color-scheme:dark){:root{--bg:#10231c;--surface:#182f25;--ink:#e5f3e9;--muted:#b1c9ba;--line:#385343;--accent:#86d3ac}button.primary{color:#10231c}}
`;

/** Static executable content only. Tool data enters exclusively through textContent. */
const script = String.raw`
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
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
    for (const [key, field] of Object.entries(profile)) if (field !== null && field !== '' && !Array.isArray(field) && typeof field !== 'object') list.append(element('li', key.replace(/([A-Z])/g, ' $1') + ': ' + field));
    for (const session of array(snapshot.sessions)) list.append(element('li', title(session) + ' · ' + sessionDay(session) + (minutes(session) !== undefined ? ' · ' + minutes(session) + ' min' : '') + (session.status ? ' · ' + session.status : '')));
    for (const outcome of array(snapshot.outcomes)) list.append(element('li', 'Outcome: ' + outcome.status + ' · ' + outcome.day + (outcome.note ? ' · ' + outcome.note : '')));
    for (const memory of array(snapshot.memories)) list.append(element('li', 'Remember: ' + memory.text));
    if (!list.childNodes.length) list.append(element('li', 'No values on this side of the change.'));
    target.append(list);
    const details = element('details'); details.append(element('summary','Exact changed values')); details.append(element('pre',JSON.stringify(value,null,2))); target.append(details);
  }
  function renderSessions(target, values, empty) {
    target.replaceChildren();
    if (!values.length) { target.append(element('p',empty,'muted')); return; }
    for (const item of values.slice(0,14)) {
      const row = element('div',undefined,'session'); const info = element('div'); info.append(element('strong',title(item)));
      info.append(element('span',sessionDay(item) + (minutes(item) !== undefined ? ' · ' + minutes(item) + ' min' : ''),'muted'));
      const outcome = array(state().outcomes).find(value => value.sessionId === item.id);
      if (outcome) info.append(element('span',outcome.status,'status'));
      row.append(info);
      if (allowed('coaching.propose') && item.id) row.append(action('Feedback',() => openFeedback(item),false));
      target.append(row);
    }
  }
  function render() {
    if (disposed) return;
    const saved = state(), brief = record(data.brief), currentDay = day();
    $('day').textContent = currentDay || 'Saved coaching plan';
    const fresh = record(data.freshness);
    const stale = data.stale === true || fresh.stale === true;
    const at = data.publishedAt || fresh.publishedAt || data.dataUpdatedAt || fresh.dataUpdatedAt;
    $('freshness').textContent = stale ? 'Snapshot may be out of date. Refresh before changing the plan.' : at ? 'Snapshot saved ' + at + '. Device activity may not be included yet.' : 'Canonical saved plan. Device activity may not be included yet.';
    $('revision').textContent = revision() === null ? 'Awaiting saved state' : 'Revision ' + revision();
    $('refresh').disabled = !allowed('coaching.read');
    const all = sessions();
    const today = array(brief.today).length ? array(brief.today) : all.filter(item => sessionDay(item) === currentDay);
    const upcoming = array(brief.upcoming).length ? array(brief.upcoming) : all.filter(item => sessionDay(item) > currentDay);
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
      card.append(element('h3',proposal.status === 'pending' ? 'Proposed change · awaiting your approval' : 'Change ' + proposal.status));
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
    $('saved-state').textContent = JSON.stringify(saved,null,2);
    $('history').replaceChildren();
    const history = array(saved.journal || saved.history || saved.entries || brief.recentChanges || data.history);
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
    else if (message.method === 'ui/notifications/host-context-changed') { if (record(message.params).theme) document.documentElement.style.colorScheme = message.params.theme; }
    else if (message.method === 'ping' && message.id !== undefined) send({jsonrpc:'2.0',id:message.id,result:{}});
  });
  render();
  if (window.parent === window || !globalThis.crypto || typeof crypto.randomUUID !== 'function') {
    notice('Open this view in a compatible MCP Apps host. Coaching details are also available in the tool’s complete text result.'); return;
  }
  request('ui/initialize',{appInfo:{name:'rep-and-plate-coaching',version:'1.0.0'},appCapabilities:{availableDisplayModes:['inline']},protocolVersion:'2026-01-26'},5000).then(result => {
    const initialization = record(result);
    if (initialization.protocolVersion !== '2026-01-26') throw new Error('This host uses an unsupported MCP Apps version. Use the complete text tools.');
    initialized = true; hostTools = !!record(initialization.hostCapabilities).serverTools;
    notify('ui/notifications/initialized',{});
    if (record(initialization.hostContext).theme) document.documentElement.style.colorScheme = initialization.hostContext.theme;
    notice(hostTools ? 'Ready. Pending changes require your explicit approval.' : 'This host displays coaching details but has not enabled interactive tool calls. Use the text tools for changes.');
    render();
    if (typeof ResizeObserver === 'function') { resizeObserver = new ResizeObserver(() => notify('ui/notifications/size-changed',{width:document.documentElement.clientWidth,height:document.documentElement.scrollHeight})); resizeObserver.observe(document.body); }
  }).catch(error => { initialized = false; hostTools = false; notice(error.message + ' The complete coaching details remain available in the tool’s text result.'); render(); });
})();
`;

const hash = (value: string) => createHash('sha256').update(value).digest('base64');
const csp = `default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(style)}'; img-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;

export const coachingAppHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Your coaching day · Rep & Plate</title><style>${style}</style></head><body>
<header><div><p class="eyebrow">REP &amp; PLATE</p><h1>Your coaching day</h1><span id="day" class="muted"></span></div><button id="refresh" type="button" disabled>Refresh plan</button></header>
<p id="freshness" class="muted"></p><span id="revision" class="pill"></span><p id="notice" role="status" aria-live="polite">Connecting to this host…</p>
<div class="grid"><section class="card"><h2>Today</h2><div id="today"></div></section><section class="card"><h2>Upcoming</h2><div id="upcoming"></div></section></div>
<section class="card"><h2>This week</h2><div id="brief"></div></section>
<form id="feedback" class="card" hidden><h2>How did it go?</h2><p id="feedback-title"></p><input id="feedback-session" type="hidden"><label>Date<input id="feedback-day" type="date" required></label><label>Result<select id="feedback-status"><option value="completed">Completed</option><option value="skipped">Skipped</option></select></label><div class="grid"><label>Minutes, if known<input id="feedback-minutes" type="number" min="0" max="1440" step="1"></label><label>Effort, if known (1–10)<input id="feedback-effort" type="number" min="1" max="10" step="1"></label></div><label>Anything to remember?<textarea id="feedback-note" maxlength="2000"></textarea></label><p class="muted">Submitting prepares a change for your review. It will be applied after you approve it.</p><div class="actions"><button id="feedback-submit" class="primary" type="submit" disabled>Propose feedback</button><button id="feedback-close" type="button">Cancel</button></div></form>
<section><h2>Changes for your review</h2><div id="proposals"></div></section>
<section class="card"><h2>Recent changes</h2><div id="history"></div><div id="undo" class="actions"></div></section>
<details class="card"><summary>Current coaching view</summary><pre id="saved-state"></pre></details>
<script>${script}</script></body></html>`;

export const coachingAppResource = {
  uri: COACHING_APP_URI,
  mimeType: COACHING_APP_MIME,
  text: coachingAppHtml,
  _meta: { ui: { csp: { connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] }, permissions: {}, prefersBorder: true } },
};
