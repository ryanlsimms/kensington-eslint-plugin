import { liveSignal } from 'kensington/live';

// Same name as a.ts, different primitive initial. Should produce a
// duplicate-key-initial-mismatch finding under the 'liveSignal' primitive.
export const b = liveSignal(99, 'shared:value');
