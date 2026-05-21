import { RuleTester } from 'eslint';
import rule from '../rules/no-async-effect.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-async-effect', rule, {
  valid: [
    // synchronous arrow function — correct
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { console.log(x.get()); });`,

    // synchronous function expression — correct
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(function() { console.log(x.get()); });`,

    // async function called elsewhere — not an effect callback
    `import { effect } from 'kensington';
     async function load() { return fetch('/api'); }
     effect(() => { load().then(r => r.json()); });`,

    // effect not imported from kensington
    `import { effect } from 'other-lib';
     effect(async () => { await fetch('/api'); });`,
  ],

  invalid: [
    // async arrow function
    {
      code: `import { effect } from 'kensington';
             effect(async () => { const data = await fetch('/api').then(r => r.json()); });`,
      errors: [{ messageId: 'noAsyncEffect' }],
    },

    // async function expression
    {
      code: `import { effect } from 'kensington';
             effect(async function() { await fetch('/api'); });`,
      errors: [{ messageId: 'noAsyncEffect' }],
    },

    // renamed import
    {
      code: `import { effect as watchEffect } from 'kensington';
             watchEffect(async () => { await fetch('/api'); });`,
      errors: [{ messageId: 'noAsyncEffect' }],
    },
  ],
});
