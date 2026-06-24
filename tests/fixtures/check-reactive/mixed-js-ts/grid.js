import { computed, signal } from 'kensington';
// JS consumer imports a TS helper. The analyzer must follow the .ts file
// even though the import spec ends in .js (the common ts->js rewrite that
// node16/bundler module resolution uses).
import { cell } from './cell.js';

const addresses = signal([], 'addrs');
export const body = computed(() => addresses.get().map(a => cell(a)), 'body');
