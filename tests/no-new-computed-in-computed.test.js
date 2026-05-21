import { RuleTester } from 'eslint';
import rule from '../rules/no-new-computed-in-computed.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-new-computed-in-computed', rule, {
  valid: [
    // computed declared outside — correct pattern
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const inner = computed(() => x.get() * 2);
     const outer = computed(() => inner.get() + 1);`,

    // computed() inside an effect — covered by no-new-computed-in-effect, not flagged here
    `import { effect, computed, signal } from 'kensington';
     const x = signal(0);
     effect(() => { const c = computed(() => x.get()); });`,

    // computed not imported from kensington
    `import { computed } from 'kensington';
     import { computed as otherComputed } from 'other-lib';
     const outer = computed(() => { const inner = otherComputed(() => 1); return inner.get(); });`,
  ],

  invalid: [
    // computed() directly inside computed callback
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             const outer = computed(() => { const inner = computed(() => x.get()); return inner.get(); });`,
      errors: [{ messageId: 'noNewComputedInComputed' }],
    },

    // computed() inside a nested function within computed
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             const outer = computed(() => { const fn = () => computed(() => x.get()); return fn().get(); });`,
      errors: [{ messageId: 'noNewComputedInComputed' }],
    },
  ],
});
