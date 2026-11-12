// No imports: the private-preview gate runs at the edge and must not pull in the agent service.

/** The shape of a connection key. */
export const CONNECTION_KEY = /^rpagent\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.[A-Za-z0-9_-]{43}$/;

/** People paste the scheme by habit; accept the key with or without it. */
export const bareKey = (value: string) => value.startsWith('Bearer ') ? value.slice(7) : value;
