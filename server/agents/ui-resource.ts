import { createHash } from 'node:crypto';

/** Only static HTML enters the identity; account data and tool results never do. */
export function uiResourceUri(name: 'coaching' | 'spot', html: string) {
  const revision = createHash('sha256').update(html).digest('hex').slice(0, 16);
  return `ui://rep-and-plate/${name}-${revision}.html`;
}
