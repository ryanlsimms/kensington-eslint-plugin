import { RuleTester } from 'eslint';
import rule from '../rules/no-async-set.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-async-set', rule, {
  valid: [
    // Sync updater. The recommended shape.
    `import { signal } from 'kensington';
     const counter = signal(0);
     counter.set(n => n + 1);`,

    // Direct value write. Not a function form.
    `import { signal } from 'kensington';
     const theme = signal('light');
     theme.set('dark');`,

    // Async function passed to something else (not .set).
    `someApi.subscribe(async event => doStuff(event));`,

    // Sync function with awaited value computed elsewhere.
    `async function commit() {
       const value = await fetchValue();
       counter.set(value);
     }`,

    // .set on a non-signal-shaped thing with a sync fn is fine.
    `class FormState {
       constructor() { this.data = new Map(); }
       set(key, value) { this.data.set(key, value); }
     }
     const f = new FormState();
     f.set('name', 'ryan');`,
  ],

  invalid: [
    // Arrow async passed to .set.
    {
      code: `counter.set(async n => n + 1);`,
      errors: [{ messageId: 'noAsyncSet' }],
    },

    // Anonymous async function passed to .set.
    {
      code: `counter.set(async function (n) { return n + 1; });`,
      errors: [{ messageId: 'noAsyncSet' }],
    },

    // Async on liveSignal.
    {
      code: `import { liveSignal } from 'kensington/live';
             const items = liveSignal([], 'items');
             items.set(async prev => { const next = await fetchNext(); return [...prev, next]; });`,
      errors: [{ messageId: 'noAsyncSet' }],
    },

    // Member-expression chain (.get().set(async ...)).
    {
      code: `auction.currentBid.set(async prev => ({ ...prev, at: Date.now() }));`,
      errors: [{ messageId: 'noAsyncSet' }],
    },
  ],
});
