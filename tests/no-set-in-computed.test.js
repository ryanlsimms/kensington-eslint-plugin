import { RuleTester } from 'eslint';
import rule from '../rules/no-set-in-computed.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-set-in-computed', rule, {
  valid: [
    // .set() in effect, not computed
    `import { computed, effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { x.set(1); });`,

    // no .set() in computed at all
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const c = computed(() => x.get() + 1);`,

    // .set() inside a nested effect() within computed — separate reactive context
    `import { computed, effect, signal } from 'kensington';
     const x = signal(0);
     const y = signal(0);
     computed(() => { effect(() => { x.set(1); }); return y.get(); });`,

    // computed not imported from kensington — rule does not apply
    `import { computed } from 'some-other-lib';
     const x = { set(v) {} };
     computed(() => { x.set(1); });`,

    // Map.set — two arguments, not flagged
    `import { computed, signal } from 'kensington';
     const map = new Map();
     const x = signal(0);
     computed(() => { map.set('key', 1); return x.get(); });`,
  ],

  invalid: [
    // synchronous .set() directly in computed body
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             computed(() => { y.set(1); return x.get(); });`,
      errors: [{ messageId: 'noSetInComputed' }],
    },

    // .set() inside a setTimeout within computed
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             computed(() => { setTimeout(() => y.set(1)); return x.get(); });`,
      errors: [{ messageId: 'noSetInComputed' }],
    },

    // .set() inside an arrow function defined within computed
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             computed(() => { const fn = () => y.set(1); fn(); return x.get(); });`,
      errors: [{ messageId: 'noSetInComputed' }],
    },

    // renamed import — rule still fires when computed is aliased
    {
      code: `import { computed as derive, signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             derive(() => { y.set(1); return x.get(); });`,
      errors: [{ messageId: 'noSetInComputed' }],
    },
  ],
});
