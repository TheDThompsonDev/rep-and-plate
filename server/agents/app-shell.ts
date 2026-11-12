import { createHash } from 'node:crypto';

export const UI_ORIGIN = 'https://repandplate.com';
export const publicUiPath = (name: 'coaching' | 'spot') => `/mcp/${name}.html`;

/** Stable, cached bridge. Presentation is fetched afresh without changing MCP tool metadata. */
export function appShell(name: 'coaching' | 'spot') {
  const script = String.raw`(() => {
    'use strict';
    const frame = document.getElementById('view'), notice = document.getElementById('notice');
    const viewOrigin = ${JSON.stringify(UI_ORIGIN)};
    let hostOrigin = null, initializeId = null, teardownId = null, disposed = false;
    const sendHost = message => parent.postMessage(message,hostOrigin && hostOrigin !== 'null' ? hostOrigin : '*');
    const timer = setTimeout(() => { frame.style.display = 'none'; notice.hidden = false; notice.textContent = 'The card could not load. You can continue in chat.'; },15000);
    const receive = event => {
      if (disposed || !event.data || typeof event.data !== 'object' || event.data.jsonrpc !== '2.0') return;
      const message = event.data;
      if (event.source === frame.contentWindow && event.origin === viewOrigin) {
        if (message.method === 'ui/initialize') initializeId = message.id;
        else if (hostOrigin === null) return;
        if (message.method === 'ui/notifications/initialized') { clearTimeout(timer); frame.style.display = 'block'; notice.hidden = true; }
        if (message.method === 'ui/notifications/size-changed') {
          const height = Number(message.params && message.params.height);
          if (!Number.isFinite(height) || height < 0 || height > 100000) return;
          frame.style.height = Math.ceil(height) + 'px';
          sendHost({jsonrpc:'2.0',method:message.method,params:{width:document.documentElement.clientWidth,height:Math.ceil(document.body.getBoundingClientRect().height)}}); return;
        }
        sendHost(message);
        if (teardownId !== null && message.id === teardownId) { disposed = true; clearTimeout(timer); removeEventListener('message',receive); }
      } else if (event.source === parent) {
        if (hostOrigin === null) { if (initializeId === null || message.id !== initializeId) return; hostOrigin = event.origin; }
        if (event.origin !== hostOrigin) return;
        if (message.method === 'ui/resource-teardown') teardownId = message.id;
        frame.contentWindow.postMessage(message,viewOrigin);
      }
    };
    addEventListener('message',receive);
    const url = new URL(${JSON.stringify(publicUiPath(name))},viewOrigin);
    // No records, credentials, or account identifiers enter this public URL.
    url.searchParams.set('load',crypto.randomUUID()); frame.src = url.href;
  })();`;
  const style = 'html,body{margin:0;padding:0;background:transparent}iframe{display:block;width:100%;border:0;height:150px}p{font:14px/1.5 system-ui;padding:12px}p[hidden]{display:none}';
  const hash = (text: string) => createHash('sha256').update(text).digest('base64');
  const csp = `default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(style)}'; frame-src ${UI_ORIGIN}; connect-src 'none'; img-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  const text = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Rep &amp; Plate</title><style>${style}</style></head><body><iframe id="view" title="Rep &amp; Plate" sandbox="allow-scripts allow-same-origin allow-forms"></iframe><p id="notice" role="status" hidden></p><script>${script}</script></body></html>`;
  return { uri: `ui://rep-and-plate/${name}-shell-v1.html`, mimeType: 'text/html;profile=mcp-app', text,
    _meta: { ui: { csp: { connectDomains: [], resourceDomains: [], frameDomains: [UI_ORIGIN], baseUriDomains: [] }, permissions: {}, prefersBorder: name === 'coaching' } } };
}
