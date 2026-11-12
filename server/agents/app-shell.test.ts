import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { appShell, UI_ORIGIN } from './app-shell.ts';

describe('stable public-view bridge', () => {
  it('limits nested frames to the public view origin and hashes its own executable code', () => {
    const resource = appShell('coaching');
    expect(resource.uri).toBe('ui://rep-and-plate/coaching-shell-v1.html');
    expect(resource._meta.ui.csp.frameDomains).toEqual([UI_ORIGIN]);
    for (const tag of ['script', 'style']) {
      const content = resource.text.match(new RegExp(`<${tag}>([\\s\\S]+?)</${tag}>`))![1];
      expect(resource.text).toContain(`'sha256-${createHash('sha256').update(content).digest('base64')}'`);
    }
    expect(resource.text).toContain("connect-src 'none'");
    expect(resource.text).toContain('event.source === frame.contentWindow && event.origin === viewOrigin');
    expect(resource.text).toContain("url.searchParams.set('load',crypto.randomUUID())");
    expect(resource.text).not.toContain('token=');
  });
});
