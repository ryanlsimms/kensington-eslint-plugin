import { signal } from 'kensington';

// .mjs source. Same kind of trap as the .js fixture.
export function rowHelper(item) {
  const open = signal(false);
  return open;
}
