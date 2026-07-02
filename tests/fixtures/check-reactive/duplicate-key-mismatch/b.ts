import { signal } from 'kensington';

// Different file, same literal key 'counter', different literal initial.
// Should produce a duplicate-key-initial-mismatch finding on each call site.
export const b = signal(7, 'counter');
