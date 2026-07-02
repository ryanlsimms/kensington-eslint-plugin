import { signal } from 'kensington';

// Same key as a.ts, same initial — legitimate reuse, no finding expected.
export const b = signal(0, 'counter');
