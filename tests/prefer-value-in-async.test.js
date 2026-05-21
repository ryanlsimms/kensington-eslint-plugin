import { RuleTester } from 'eslint';
import rule from '../rules/prefer-value-in-async.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('prefer-value-in-async', rule, {
  valid: [
    // .get() in effect body — reactive read, correct
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { console.log(x.get()); });`,

    // .value in async callback — correct pattern
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { setTimeout(() => { console.log(x.value); }); });`,

    // .get() in async callback outside any effect — no opinion
    `import { signal } from 'kensington';
     const x = signal(0);
     setTimeout(() => { console.log(x.get()); });`,

    // .get() with an argument — not a signal read (e.g. Map.get)
    `import { effect } from 'kensington';
     const m = new Map();
     effect(() => { setTimeout(() => { m.get('key'); }); });`,

    // effect not from kensington
    `import { effect } from 'other-lib';
     const x = { get() {} };
     effect(() => { setTimeout(() => x.get()); });`,
  ],

  invalid: [
    // .get() inside setTimeout within effect
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => { setTimeout(() => { console.log(x.get()); }); });`,
      errors: [{ messageId: 'preferValueInAsync' }],
    },

    // .get() inside .then() within effect
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => { fetch('/api').then(() => { console.log(x.get()); }); });`,
      errors: [{ messageId: 'preferValueInAsync' }],
    },

    // .get() inside requestAnimationFrame within effect
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => { requestAnimationFrame(() => { console.log(x.get()); }); });`,
      errors: [{ messageId: 'preferValueInAsync' }],
    },

    // .get() inside nested async callback
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => {
               setTimeout(() => {
                 fetch('/api').then(() => { console.log(x.get()); });
               });
             });`,
      errors: [{ messageId: 'preferValueInAsync' }],
    },

    // renamed import — rule still fires when effect is aliased
    {
      code: `import { effect as fx, signal } from 'kensington';
             const x = signal(0);
             fx(() => { setTimeout(() => { console.log(x.get()); }); });`,
      errors: [{ messageId: 'preferValueInAsync' }],
    },
  ],
});
