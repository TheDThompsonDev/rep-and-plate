// What a person sees after creating a connection: one set of steps per assistant, shared by web and native.
// Commands here were checked against each tool's own help or documentation; hosts that cannot send a
// fixed access key are listed honestly as not available yet.

export const connectionLifetimes = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '1 year' },
] as const;
export const defaultLifetimeDays = 90;
export const MAX_LIFETIME_DAYS = 365;
/** Shown to the person and to the assistant from this many days before a key stops working. */
export const EXPIRY_WARNING_DAYS = 14;
/** An expired, never-disconnected connection stays renewable in the list for this long. */
export const RENEWABLE_AFTER_EXPIRY_DAYS = 30;
const DAY = 86_400_000;

export const firstMessage = 'Check in with Rep & Plate: what is on for me today?';
export const mcpAddress = (appUrl: string) => `${appUrl.replace(/\/+$/, '')}/api/agents/mcp`;

export type SetupStep = { text: string; copy?: string; copyLabel?: string };
export type SetupGuide = {
  id: 'claude-code' | 'codex' | 'claude' | 'chatgpt' | 'other';
  name: string;
  status: 'ready' | 'limited' | 'unavailable';
  summary: string;
  steps: SetupStep[];
};

export function setupGuides(appUrl: string, token: string): SetupGuide[] {
  const address = mcpAddress(appUrl);
  const header = `Authorization: Bearer ${token}`;
  // In a real Codex trial the assistant used Rep & Plate every time it was named and only sometimes when it was not.
  const say: SetupStep = { text: 'Start a conversation and say this. Naming Rep & Plate is what makes your assistant use it:', copy: firstMessage, copyLabel: 'Copy first message' };
  return [
    {
      id: 'claude-code', name: 'Claude Code', status: 'ready',
      summary: 'One command in a terminal. Works in every project afterwards.',
      steps: [
        { text: 'Run this once in a terminal:', copy: `claude mcp add --transport http rep-and-plate --scope user ${address} --header "${header}"`, copyLabel: 'Copy command' },
        say,
        { text: 'If Rep & Plate does not answer, type /mcp in Claude Code to see the connection status.' },
      ],
    },
    {
      id: 'codex', name: 'Codex', status: 'ready',
      summary: 'Save the key once, then add the connection.',
      steps: [
        { text: 'Save the key where Codex can read it. On macOS or Linux, add this line to your shell profile:', copy: `export REP_PLATE_TOKEN="${token}"`, copyLabel: 'Copy for macOS or Linux' },
        { text: 'On Windows, run this instead, then open a new terminal:', copy: `setx REP_PLATE_TOKEN "${token}"`, copyLabel: 'Copy for Windows' },
        { text: 'Add the connection:', copy: `codex mcp add rep-and-plate --url ${address} --bearer-token-env-var REP_PLATE_TOKEN`, copyLabel: 'Copy command' },
        say,
      ],
    },
    {
      id: 'claude', name: 'Claude app', status: 'limited',
      summary: 'Works only if your account shows a request-headers field for custom connectors.',
      steps: [
        { text: 'In Claude, open Settings, then Connectors, then Add custom connector. Use this address:', copy: address, copyLabel: 'Copy address' },
        { text: 'If a request-headers field is offered, add this header:', copy: header, copyLabel: 'Copy header' },
        { text: 'If Claude asks you to sign in instead, this connection cannot be used there yet. Use Claude Code for now.' },
      ],
    },
    {
      id: 'chatgpt', name: 'ChatGPT', status: 'unavailable',
      summary: 'Not available yet.',
      steps: [
        { text: 'ChatGPT connectors need a sign-in step that Rep & Plate does not offer yet, so an access key cannot be used there. Your key works today in Claude Code, Codex and other tools that can send it.' },
      ],
    },
    {
      id: 'other', name: 'Another tool', status: 'ready',
      summary: 'Any MCP client that can send a fixed request header.',
      steps: [
        { text: 'Add a remote (HTTP) MCP server with this address:', copy: address, copyLabel: 'Copy address' },
        { text: 'Send the access key with every request in this header:', copy: header, copyLabel: 'Copy header' },
        say,
      ],
    },
  ];
}

export type ExpiryNotice = { state: 'active' | 'soon' | 'expired'; days: number; label: string; renewable: boolean };
/** One wording for how long a connection has left, so web, native and the assistant agree. */
export function expiryNotice(expiresAt: string, now: number): ExpiryNotice {
  const left = Date.parse(expiresAt) - now;
  if (left <= 0) {
    const ago = Math.floor(-left / DAY);
    return { state: 'expired', days: 0, label: ago < 1 ? 'Stopped working today' : `Stopped working ${ago} day${ago === 1 ? '' : 's'} ago`, renewable: ago <= RENEWABLE_AFTER_EXPIRY_DAYS };
  }
  // A minute of slack: a screen whose clock ticks every few seconds must not read a fresh 90 days as 91.
  const days = Math.max(1, Math.ceil((left - 60_000) / DAY));
  const label = days === 1 ? 'Works for 1 more day' : `Works for ${days} more days`;
  return { state: days <= EXPIRY_WARNING_DAYS ? 'soon' : 'active', days, label, renewable: true };
}

/** What the assistant is told to pass on before the person's key runs out. Null when there is nothing to say. */
export function expiryNextStep(expiresAt: string, now: number): string | null {
  const notice = expiryNotice(expiresAt, now);
  if (notice.state !== 'soon') return null;
  return `This connection to Rep & Plate stops working in ${notice.days} day${notice.days === 1 ? '' : 's'}. Tell the user once: open Rep & Plate, go to Connections and choose "Keep connected" so check-ins continue without setting anything up again.`;
}
