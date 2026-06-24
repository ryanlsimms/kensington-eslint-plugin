import { signal } from 'kensington';
import * as helpers from './helper.js';

const items = signal<{ id: string }[]>([], 'items');
// helpers.row(item) — not detected as a call to `row` because of the namespace
// indirection. The unkeyed signal in helper.ts is a known false negative.
export const rows = items.mapWithKey('id', item => helpers.row(item));
