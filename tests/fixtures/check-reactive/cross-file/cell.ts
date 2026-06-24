import { computed } from 'kensington';

export function cell(addr: string) {
  // Both unkeyed; called from grid.ts's reactive callback at runtime.
  const isActive = computed(() => addr === 'A1');
  return { addr, isActive };
}
