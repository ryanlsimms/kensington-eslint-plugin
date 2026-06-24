import { signal } from 'kensington';
import { rowHelper } from './helper.mjs';

const items = signal([], 'items');
export const rows = items.mapWithKey('id', item => rowHelper(item));
