import { RuleTester } from 'eslint';
import rule from '../rules/no-async-computed.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-async-computed', rule, {
  valid: [
    // synchronous arrow function — correct
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const doubled = computed(() => x.get() * 2);`,

    // synchronous function expression — correct
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const doubled = computed(function() { return x.get() * 2; });`,

    // async function used elsewhere — not a computed callback
    `import { computed } from 'kensington';
     async function load() { return fetch('/api'); }
     const c = computed(() => 1);`,

    // computed not imported from kensington
    `import { computed } from 'other-lib';
     const c = computed(async () => await fetch('/api'));`,
  ],

  invalid: [
    // async arrow function
    {
      code: `import { computed } from 'kensington';
             const data = computed(async () => await fetch('/api').then(r => r.json()));`,
      errors: [{ messageId: 'noAsyncComputed' }],
    },

    // async function expression
    {
      code: `import { computed } from 'kensington';
             const data = computed(async function() { return await fetch('/api'); });`,
      errors: [{ messageId: 'noAsyncComputed' }],
    },

    // renamed import
    {
      code: `import { computed as derive } from 'kensington';
             const data = derive(async () => await fetch('/api'));`,
      errors: [{ messageId: 'noAsyncComputed' }],
    },
  ],
});
