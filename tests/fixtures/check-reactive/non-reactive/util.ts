import { signal } from 'kensington';

export function build() {
  // Unkeyed signal, but never reached from a reactive callback.
  const s = signal(0);
  return s;
}
