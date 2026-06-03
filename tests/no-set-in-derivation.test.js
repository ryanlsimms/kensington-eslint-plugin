import { RuleTester } from 'eslint';
import rule from '../rules/no-set-in-derivation.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-set-in-derivation', rule, {
  valid: [
    // .set() in effect, not derivation
    `import { computed, effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { x.set(1); });`,

    // no .set() in computed at all
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const c = computed(() => x.get() + 1);`,

    // no .set() in transform
    `import { signal } from 'kensington';
     const x = signal(0);
     const d = x.transform(v => v * 2);`,

    // .set() inside a nested effect within a computed — separate context
    `import { computed, effect, signal } from 'kensington';
     const x = signal(0);
     const y = signal(0);
     computed(() => { effect(() => { x.set(1); }); return y.get(); });`,

    // .set() inside a nested effect within a transform — separate context
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     const y = signal(0);
     x.transform(v => { effect(() => { y.set(1); }); return v; });`,

    // event handler inside computed — .set() fires on user interaction
    `import { computed, signal } from 'kensington';
     const count = signal(0);
     computed(() => t.button({ onclick: () => count.set(n => n + 1) }, count));`,

    // event handler inside transform — same exemption
    `import { signal } from 'kensington';
     const count = signal(0);
     count.transform(v => t.button({ onclick: () => count.set(n => n + 1) }, v));`,

    // computed not imported from kensington — rule does not apply
    `import { computed } from 'some-other-lib';
     const x = { set(v) {} };
     computed(() => { x.set(1); });`,

    // Map.set — two args, not flagged
    `import { computed, signal } from 'kensington';
     const map = new Map();
     const x = signal(0);
     computed(() => { map.set('key', 1); return x.get(); });`,
  ],

  invalid: [
    // .set() in computed body
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             computed(() => { y.set(1); return x.get(); });`,
      errors: [{ messageId: 'noSetInDerivation', data: { kind: 'computed() body' } }],
    },

    // .set() in transform callback
    {
      code: `import { signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             x.transform(v => { y.set(v); return v; });`,
      errors: [{ messageId: 'noSetInDerivation', data: { kind: '.transform() callback' } }],
    },

    // .set() inside a setTimeout within computed
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             computed(() => { setTimeout(() => y.set(1)); return x.get(); });`,
      errors: [{ messageId: 'noSetInDerivation' }],
    },

    // .set() inside a setTimeout within transform
    {
      code: `import { signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             x.transform(v => { setTimeout(() => y.set(v)); return v; });`,
      errors: [{ messageId: 'noSetInDerivation' }],
    },

    // renamed computed import
    {
      code: `import { computed as derive, signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             derive(() => { y.set(1); return x.get(); });`,
      errors: [{ messageId: 'noSetInDerivation' }],
    },

    // chained .transform()
    {
      code: `import { signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             x.transform(v => v * 2).transform(v => { y.set(v); return v; });`,
      errors: [{ messageId: 'noSetInDerivation' }],
    },

    // .set() inside a computed nested within a transform — the .set is inside
    // a derivation (the computed), so it's still a bug.
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             x.transform(v => { const c = computed(() => { y.set(1); return v; }); return c; });`,
      errors: [{ messageId: 'noSetInDerivation', data: { kind: 'computed() body' } }],
    },
  ],
});
