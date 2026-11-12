import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { coachingAppResource } from './coaching-app.ts';
import { spotAppResource } from './spot-app.ts';

describe('self-contained MCP resources', () => {
  it('needs no nested frames or external scripts and retains exact script/style hashes', () => {
    for (const resource of [coachingAppResource, spotAppResource]) {
      expect(resource._meta.ui.csp).toEqual({ connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] });
      expect(resource.text).not.toMatch(/<iframe|<script\s+src=/i);
      expect(resource.text).toContain("frame-src 'none'");
      for (const tag of ['script','style']) {
        const content = resource.text.match(new RegExp(`<${tag}>([\\s\\S]+?)</${tag}>`))![1];
        expect(resource.text).toContain(`'sha256-${createHash('sha256').update(content).digest('base64')}'`);
      }
    }
  });
});
