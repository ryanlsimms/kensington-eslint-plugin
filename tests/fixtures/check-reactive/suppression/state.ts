import { signal, type Signal } from 'kensington';

interface RowState {
  expanded: Signal<boolean>;
  renaming: Signal<boolean>;
}

const rowRegistry = new Map<string, RowState>();

export function getOrCreateRowState(id: string): RowState {
  const existing = rowRegistry.get(id);
  if (existing) {
    return existing;
  }
  const created: RowState = {
    // kensington-check-reactive-ignore: lazy registry pre-seeded at mount.
    expanded: signal(false),
    renaming: signal(false), // kensington-check-reactive-ignore
  };
  rowRegistry.set(id, created);
  return created;
}
