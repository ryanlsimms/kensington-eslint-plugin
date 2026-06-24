import { computed } from 'kensington';

// Plain JS, no type annotations. Same trap as the TS cross-file fixture:
// the inner computed is unkeyed and the helper is called from grid.js's
// reactive callback at runtime.
export function cell(addr) {
  const isActive = computed(() => addr === 'A1');
  return { addr, isActive };
}
