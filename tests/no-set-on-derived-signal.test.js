import { RuleTester } from 'eslint';
import rule from '../rules/no-set-on-derived-signal.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-set-on-derived-signal', rule, {
  valid: [
    // .set() on a signal, not a derived signal
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const c = computed(() => x.get() * 2);
     x.set(5);`,

    // .set() on the transform source signal
    `import { signal } from 'kensington';
     const x = signal(0);
     const d = x.transform(v => v * 2);
     x.set(5);`,

    // computed not imported from kensington — rule does not apply
    `import { computed } from 'other-lib';
     const c = computed(() => 1);
     c.set(2);`,

    // .get() on a derived signal — fine
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const c = computed(() => x.get() * 2);
     console.log(c.get());`,

    // Map.set with two args — not flagged
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const c = computed(() => x.get() * 2);
     const m = new Map();
     m.set('key', c.get());`,
  ],

  invalid: [
    // .set() on a computed binding
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             const c = computed(() => x.get() * 2);
             c.set(10);`,
      errors: [{ messageId: 'noSetOnDerived', data: { name: 'c', kind: 'computed' } }],
    },

    // .set() on a computed inside an effect
    {
      code: `import { computed, effect, signal } from 'kensington';
             const x = signal(0);
             const doubled = computed(() => x.get() * 2);
             effect(() => { doubled.set(5); });`,
      errors: [{ messageId: 'noSetOnDerived' }],
    },

    // alias import for computed
    {
      code: `import { computed as comp, signal } from 'kensington';
             const x = signal(0);
             const c = comp(() => x.get() * 2);
             c.set(99);`,
      errors: [{ messageId: 'noSetOnDerived' }],
    },

    // .set() on a transform-derived binding
    {
      code: `import { signal } from 'kensington';
             const x = signal(0);
             const d = x.transform(v => v * 2);
             d.set(10);`,
      errors: [{ messageId: 'noSetOnDerived', data: { name: 'd', kind: 'transform-derived' } }],
    },

    // chained transform
    {
      code: `import { signal } from 'kensington';
             const x = signal(0);
             const d = x.transform(v => v * 2).transform(v => v + 1);
             d.set(99);`,
      errors: [{ messageId: 'noSetOnDerived' }],
    },

    // .set() on a transform result inside an effect
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             const d = x.transform(v => v * 2);
             effect(() => { d.set(5); });`,
      errors: [{ messageId: 'noSetOnDerived' }],
    },
  ],
});
