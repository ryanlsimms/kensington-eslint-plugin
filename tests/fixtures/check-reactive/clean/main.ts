import { signal, computed } from 'kensington';

// All top-level, all keyed. Should produce zero findings.
const a = signal(0, 'a');
const b = signal('', 'b');
const c = computed(() => a.get() + 1, 'c');

function row(item: { id: string; name: string }) {
  const open = signal(false, item.id);
  const cls = open.transform(v => v ? 'open' : 'closed', `${item.id}-cls`);
  return { open, cls };
}

const items = signal<{ id: string; name: string }[]>([], 'items');
export const rows = items.mapWithKey('id', item => row(item));
export { a, b, c };
