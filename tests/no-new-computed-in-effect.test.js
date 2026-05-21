import { RuleTester } from 'eslint';
import rule from '../rules/no-new-computed-in-effect.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-new-computed-in-effect', rule, {
  valid: [
    // computed declared outside effect — correct pattern
    `import { effect, computed, signal } from 'kensington';
     const x = signal(0);
     const doubled = computed(() => x.get() * 2);
     effect(() => { console.log(doubled.get()); });`,

    // computed() at module level — fine
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const doubled = computed(() => x.get() * 2);`,

    // computed() inside another computed — different concern (no-new-signal-in-computed)
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const outer = computed(() => { const inner = computed(() => x.get()); return inner.get(); });`,

    // computed not imported from kensington
    `import { effect } from 'kensington';
     import { computed } from 'other-lib';
     const x = computed(() => 1);
     effect(() => { const c = computed(() => 2); });`,
  ],

  invalid: [
    // computed() directly inside effect callback
    {
      code: `import { effect, computed, signal } from 'kensington';
             const x = signal(0);
             effect(() => { const doubled = computed(() => x.get() * 2); });`,
      errors: [{ messageId: 'noNewComputedInEffect' }],
    },

    // computed() inside async callback within effect
    {
      code: `import { effect, computed, signal } from 'kensington';
             const x = signal(0);
             effect(() => { setTimeout(() => { const c = computed(() => x.get()); }); });`,
      errors: [{ messageId: 'noNewComputedInEffect' }],
    },

    // computed() inside nested effect — flagged for the inner effect
    {
      code: `import { effect, computed, signal } from 'kensington';
             const x = signal(0);
             effect(() => { effect(() => { const c = computed(() => x.get()); }); });`,
      errors: [{ messageId: 'noNewComputedInEffect' }],
    },
  ],
});
