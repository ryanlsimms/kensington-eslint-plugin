import { signal } from 'kensington';

function row(item: { id: string; name: string }) {
  const open = signal(false);
  return { open, name: item.name };
}

const items = signal([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
const list = items.mapWithKey('id', item => row(item));
export { list };
