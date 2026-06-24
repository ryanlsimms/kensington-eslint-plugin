import { computed } from 'kensington';

// TS helper. Called from a JS consumer.
export function cell(addr: string) {
  const isActive = computed(() => addr === 'A1');
  return { addr, isActive };
}
