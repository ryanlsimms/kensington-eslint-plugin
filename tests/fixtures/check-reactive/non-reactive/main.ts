import { build } from './util.js';

// Called from module scope. Not a reactive callback. Should not flag util.ts.
export const x = build();
