import { RuleTester } from 'eslint';
import rule from '../rules/prefer-subscribe-in-effect.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('prefer-subscribe-in-effect', rule, {
  valid: [
    // The value is used, so .get() communicates the right intent.
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { console.log(x.get()); });`,

    // Assigned value is used later in the effect.
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { const value = x.get(); console.log(value); });`,

    // Existing .subscribe() already expresses a trigger-only read.
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { x.subscribe(); });`,

    // Nested callbacks may use the value independently of the effect body.
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { [1].forEach(() => console.log(x.get())); });`,

    // A method with arguments is not a signal read.
    `import { effect } from 'kensington';
     const map = new Map();
     effect(() => { map.get('key'); });`,

    // Effects imported from another package are outside this rule's scope.
    `import { effect } from 'other-lib';
     const x = { get() {} };
     effect(() => { x.get(); });`,
  ],

  invalid: [
    // Bare trigger-only read in a block-bodied effect.
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => { x.get(); });`,
      errors: [{ messageId: 'preferSubscribeInEffect' }],
    },

    // Concise effect body is also trigger-only because effect ignores the callback return.
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => x.get());`,
      errors: [{ messageId: 'preferSubscribeInEffect' }],
    },

    // Trigger-only read inside a conditional still runs in the effect body.
    {
      code: `import { effect, signal } from 'kensington';
             const enabled = signal(true);
             const x = signal(0);
             effect(() => { if (enabled.get()) x.get(); });`,
      errors: [{ messageId: 'preferSubscribeInEffect' }],
    },

    // Renamed import — rule still recognises the Kensington effect.
    {
      code: `import { effect as fx, signal } from 'kensington';
             const x = signal(0);
             fx(() => { x.get(); });`,
      errors: [{ messageId: 'preferSubscribeInEffect' }],
    },
  ],
});
