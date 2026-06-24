import { signal } from 'kensington';
import { rowHelper } from './index.js';

const items = signal<{ id: string }[]>([], 'items');
export const rows = items.mapWithKey('id', item => rowHelper(item));
