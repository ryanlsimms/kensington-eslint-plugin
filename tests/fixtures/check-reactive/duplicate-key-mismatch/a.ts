import { signal } from 'kensington';

// First call site. Stable literal key 'counter', literal initial 0.
export const a = signal(0, 'counter');
