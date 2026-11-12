import { createHash } from 'node:crypto';
import { spotBannerMarkup, spotBannerScript, spotBannerStyle } from './spot-banner.ts';
import { uiResourceUri } from './ui-resource.ts';
import { appShell } from './app-shell.ts';

// A small card for the basic tools (records and meal drafts): Spot's pose and his line, nothing else.
// The full coaching card covers the coaching tools. Same MCP Apps protocol and limits as that card.

export const LEGACY_SPOT_APP_URI = 'ui://rep-and-plate/spot.html';
export const SPOT_APP_MIME = 'text/html;profile=mcp-app';

const style = String.raw`
:root{color-scheme:light dark;--surface:#fff;--ink:#173d31;--line:#d5e5da;--accent:#006249;font-family:var(--font-sans,system-ui,sans-serif);font-size:14px;color:var(--ink);background:transparent}*{box-sizing:border-box}body{margin:0;padding:8px 12px}
@media(prefers-color-scheme:dark){:root{--surface:#182f25;--ink:#e5f3e9;--line:#385343;--accent:#86d3ac}}
${spotBannerStyle}`;

const script = String.raw`
(() => {
  'use strict';
  ${spotBannerScript}
  const record = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  let parentOrigin = null, initialized = false, disposed = false, observer = null, initializeId = null;
  const send = message => window.parent.postMessage(message, parentOrigin && parentOrigin !== 'null' ? parentOrigin : '*');
  const notify = (method, params) => { if (initialized) send({ jsonrpc: '2.0', method, params }); };
  window.addEventListener('message', event => {
    if (event.source !== window.parent || (parentOrigin !== null && event.origin !== parentOrigin)) return;
    const message = record(event.data); if (message.jsonrpc !== '2.0') return;
    if (initializeId !== null && message.id === initializeId) {
      initializeId = null;
      const result = record(message.result);
      // Only text and a built-in image are shown, so any version the host speaks is enough.
      if (message.error || typeof result.protocolVersion !== 'string') return;
      parentOrigin = event.origin; initialized = true;
      notify('ui/notifications/initialized', {});
      applyHostTheme(record(result.hostContext));
      if (typeof ResizeObserver === 'function') { observer = new ResizeObserver(() => notify('ui/notifications/size-changed', { width: document.documentElement.clientWidth, height: Math.ceil(document.body.getBoundingClientRect().height) })); observer.observe(document.body); }
      return;
    }
    if (message.method === 'ui/resource-teardown') { disposed = true; initialized = false; if (observer) observer.disconnect(); if (message.id !== undefined) send({ jsonrpc: '2.0', id: message.id, result: {} }); return; }
    if (!initialized || disposed) return;
    if (message.method === 'ui/notifications/tool-result') { const reply = record(message.params); if (!reply.isError) renderSpot(record(record(reply._meta).repAndPlateView || reply.structuredContent).spot); }
    else if (message.method === 'ui/notifications/host-context-changed') { applyHostTheme(record(message.params)); }
    else if (message.method === 'ping' && message.id !== undefined) send({ jsonrpc: '2.0', id: message.id, result: {} });
  });
  if (window.parent === window || !globalThis.crypto || typeof crypto.randomUUID !== 'function') return;
  initializeId = crypto.randomUUID();
  send({ jsonrpc: '2.0', id: initializeId, method: 'ui/initialize', params: { appInfo: { name: 'rep-and-plate-spot', version: '1.0.0' }, appCapabilities: { availableDisplayModes: ['inline'] }, protocolVersion: '2026-01-26' } });
})();
`;

const hash = (value: string) => createHash('sha256').update(value).digest('base64');
const csp = `default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(style)}'; img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;

export const spotAppHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Spot · Rep & Plate</title><style>${style}</style></head><body>${spotBannerMarkup}<script>${script}</script></body></html>`;

export const spotAppResource = appShell('spot');
export const SPOT_APP_URI = spotAppResource.uri;
export const SPOT_APP_ALIASES = [LEGACY_SPOT_APP_URI, 'ui://rep-and-plate/spot-23b171e0d51b2450.html', uiResourceUri('spot', spotAppHtml)];
