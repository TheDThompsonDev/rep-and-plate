/** A device state is usable only after it has been loaded for the current owner.
 * Invalidation is synchronous; asynchronous reads cannot publish across epochs.
 */
export class OwnedStateGate<T> {
  value: T | null = null;
  owner: string | null = null;
  private generation = -1;
  private ticket = 0;
  private pending: Promise<void> = Promise.resolve();
  constructor(
    private readonly deps: {
      epoch: () => number;
      owner: () => Promise<string | null>;
      load: () => Promise<T>;
    },
  ) {}
  get ready() {
    return this.value !== null && this.generation === this.deps.epoch();
  }
  get current() {
    return this.ready ? this.value : null;
  }
  refresh(
    publish: (value: T | null, firstBinding: boolean) => void,
    failure: (error: unknown) => void,
  ) {
    const ticket = ++this.ticket,
      epoch = this.deps.epoch();
    this.generation = -1;
    publish(null, false);
    const live = () => ticket === this.ticket && epoch === this.deps.epoch();
    const task = (async () => {
      const owner = await this.deps.owner();
      if (!live()) return;
      const firstBinding = this.owner === null && owner !== null;
      const next =
        owner === this.owner && this.value !== null
          ? this.value
          : await this.deps.load();
      if (!live() || (await this.deps.owner()) !== owner || !live()) return;
      this.owner = owner;
      this.value = next;
      this.generation = epoch;
      publish(next, firstBinding);
    })().catch((error) => {
      if (live()) failure(error);
    });
    this.pending = task;
    return task;
  }
  async wait() {
    let pending: Promise<void>;
    do {
      pending = this.pending;
      await pending;
    } while (pending !== this.pending);
    if (!this.ready)
      throw Error("Your account records are still loading. Please try again.");
    return this.value!;
  }
  set(value: T) {
    if (!this.ready)
      throw Error("Your account changed. Wait for its records to load.");
    this.value = value;
  }
  close() {
    this.ticket++;
    this.generation = -1;
  }
}
