import { signal } from 'kensington';

export function rowHelper(item: { id: string }) {
  // Unkeyed; reached via re-export chain.
  const open = signal(false);
  return { open };
}
