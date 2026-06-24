import { signal } from 'kensington';

// Unkeyed; consumer uses a namespace import, which the analyzer doesn't follow.
// Documents the known false-negative case.
export function row(item: { id: string }) {
  const open = signal(false);
  return open;
}
