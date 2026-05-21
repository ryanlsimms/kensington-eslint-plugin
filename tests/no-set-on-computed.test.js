import { RuleTester } from 'eslint';
import rule from '../rules/no-set-on-computed.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-set-on-computed', rule, {
  valid: [
    // .set() on a signal, not a computed
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const c = computed(() => x.get() * 2);
     x.set(5);`,

    // computed not imported from kensington
    `import { computed } from 'other-lib';
     const c = computed(() => 1);
     c.set(2);`,

    // computed variable used with .get() — fine
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
    // direct .set() on a computed binding
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             const c = computed(() => x.get() * 2);
             c.set(10);`,
      errors: [{ messageId: 'noSetOnComputed' }],
    },

    // .set() on computed inside an effect
    {
      code: `import { computed, effect, signal } from 'kensington';
             const x = signal(0);
             const doubled = computed(() => x.get() * 2);
             effect(() => { doubled.set(5); });`,
      errors: [{ messageId: 'noSetOnComputed' }],
    },

    // alias import
    {
      code: `import { computed as comp, signal } from 'kensington';
             const x = signal(0);
             const c = comp(() => x.get() * 2);
             c.set(99);`,
      errors: [{ messageId: 'noSetOnComputed' }],
    },
  ],
});
