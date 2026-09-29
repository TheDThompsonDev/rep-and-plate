export type StringStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
/** SecureStore values can exceed iOS item limits. Commit a generation only after
 * every small chunk exists, preserving the previous generation on write failure. */
export function chunkedStorage(
  storage: StringStorage,
  uuid: () => string,
): StringStorage {
  const queues = new Map<string, Promise<void>>();
  const pointer = (key: string) => `${key}.chunks`;
  const parse = (raw: string | null): { id: string; count: number } | null => {
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      !/^[a-zA-Z0-9-]+$/.test(value.id) ||
      !Number.isInteger(value.count) ||
      value.count < 1 ||
      value.count > 200
    )
      throw Error("Invalid secure session");
    return value;
  };
  const clear = async (key: string, meta: ReturnType<typeof parse>) => {
    if (meta)
      for (let i = 0; i < meta.count; i++)
        await storage.removeItem(`${key}.${meta.id}.${i}`);
  };
  const write = (key: string, action: () => Promise<void>) => {
    const pending = (queues.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(action);
    queues.set(key, pending);
    void pending
      .finally(() => {
        if (queues.get(key) === pending) queues.delete(key);
      })
      .catch(() => {});
    return pending;
  };
  return {
    async getItem(key) {
      await queues.get(key)?.catch(() => {});
      const meta = parse(await storage.getItem(pointer(key)));
      if (!meta) return storage.getItem(key); // Existing unchunked sessions migrate on refresh.
      const chunks: string[] = [];
      for (let i = 0; i < meta.count; i++) {
        const chunk = await storage.getItem(`${key}.${meta.id}.${i}`);
        if (chunk === null)
          throw Error("Your saved session is incomplete. Sign in again.");
        chunks.push(chunk);
      }
      return chunks.join("");
    },
    setItem: (key, value) =>
      write(key, async () => {
        const previous = parse(await storage.getItem(pointer(key)));
        // Split code points, not UTF-16 pairs; <= 1600 UTF-8 bytes per chunk.
        const chars = Array.from(value),
          id = uuid(),
          count = Math.max(1, Math.ceil(chars.length / 400));
        if (count > 200) throw Error("Session is too large to save securely.");
        try {
          for (let i = 0; i < count; i++)
            await storage.setItem(
              `${key}.${id}.${i}`,
              chars.slice(i * 400, (i + 1) * 400).join(""),
            );
          await storage.setItem(pointer(key), JSON.stringify({ id, count }));
        } catch (error) {
          await clear(key, { id, count }).catch(() => {});
          throw error;
        }
        await storage.removeItem(key).catch(() => {});
        await clear(key, previous).catch(() => {});
      }),
    removeItem: (key) =>
      write(key, async () => {
        const previous = parse(await storage.getItem(pointer(key)));
        await storage.removeItem(key);
        await storage.removeItem(pointer(key));
        await clear(key, previous);
      }),
  };
}
