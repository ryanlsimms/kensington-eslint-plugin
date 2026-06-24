import { computed, signal } from 'kensington';
import { cell } from './cell.js';

const addresses = signal([], 'addrs');
export const body = computed(() => addresses.get().map(a => cell(a)), 'body');
