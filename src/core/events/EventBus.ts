export type Listener<T> = (payload: T) => void;

/** Minimal strongly-typed pub/sub used to decouple core, globe and UI. */
export class EventBus<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>();

  on<K extends keyof Events>(type: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener as Listener<never>);
    return () => set.delete(listener as Listener<never>);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) {
      try {
        (listener as Listener<Events[K]>)(payload);
      } catch (err) {
        console.error(`[EventBus] listener for "${String(type)}" failed`, err);
      }
    }
  }
}
