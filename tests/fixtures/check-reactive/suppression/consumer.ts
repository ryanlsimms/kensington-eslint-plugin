import { signal } from 'kensington';
import { getOrCreateRowState } from './state.js';

const ids = signal<string[]>([], 'ids');

// Calls getOrCreateRowState from inside a reactive callback. Without the
// suppression comments in state.ts, every lazy signal() there would be flagged.
export const rows = ids.transform(list => list.map(id => getOrCreateRowState(id)), 'rows');
