import { RuleTester } from 'eslint';
import rule from '../rules/no-new-signal-in-effect.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-new-signal-in-effect', rule, {
  valid: [
    // signal declared outside effect — correct pattern
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { console.log(x.get()); });`,

    // signal() at module level — fine
    `import { signal } from 'kensington';
     const x = signal(0);`,

    // signal() inside a computed — not an effect, different concern
    `import { computed, signal } from 'kensington';
     const c = computed(() => { const x = signal(0); return x.get(); });`,

    // signal not imported from kensington
    `import { effect } from 'kensington';
     import { signal } from 'other-lib';
     effect(() => { const x = signal(0); });`,
  ],

  invalid: [
    // signal() directly inside effect callback
    {
      code: `import { effect, signal } from 'kensington';
             effect(() => { const x = signal(0); });`,
      errors: [{ messageId: 'noNewSignalInEffect' }],
    },

    // signal() inside async callback within effect
    {
      code: `import { effect, signal } from 'kensington';
             effect(() => { setTimeout(() => { const x = signal(0); }); });`,
      errors: [{ messageId: 'noNewSignalInEffect' }],
    },

    // signal() inside nested effect — flagged for the inner effect
    {
      code: `import { effect, signal } from 'kensington';
             effect(() => { effect(() => { const x = signal(0); }); });`,
      errors: [{ messageId: 'noNewSignalInEffect' }],
    },

    // renamed import — rule still fires when signal is aliased
    {
      code: `import { effect, signal as sig } from 'kensington';
             effect(() => { const x = sig(0); });`,
      errors: [{ messageId: 'noNewSignalInEffect' }],
    },
  ],
});
