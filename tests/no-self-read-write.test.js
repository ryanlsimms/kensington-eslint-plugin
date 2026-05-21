import { RuleTester } from 'eslint';
import rule from '../rules/no-self-read-write.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-self-read-write', rule, {
  valid: [
    // different bindings — no loop
    `import { effect, signal } from 'kensington';
     const a = signal(0); const b = signal(0);
     effect(() => { b.set(a.get() + 1); });`,

    // .value read — does not subscribe, safe to write after
    `import { effect, signal } from 'kensington';
     const x = signal(5);
     const trigger = signal(0);
     effect(() => { trigger.get(); if (x.value > 10) { x.set(0); } });`,

    // .set() in async callback — handled by no-signal-async-write, not this rule
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { x.get(); setTimeout(() => x.set(1)); });`,

    // .get() and .set() in nested functions inside effect — not top-level
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { const r = () => x.get(); const w = () => x.set(1); });`,

    // not from kensington
    `import { effect } from 'other-lib';
     const x = { get() {}, set(v) {} };
     effect(() => { x.get(); x.set(1); });`,
  ],

  invalid: [
    // same binding read and written in effect
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => { x.get(); x.set(1); });`,
      errors: [{ messageId: 'noSelfReadWrite' }],
    },

    // same binding read and written in computed
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             computed(() => { x.get(); x.set(1); return x.value; });`,
      errors: [{ messageId: 'noSelfReadWrite' }],
    },

    // conditional write still flagged — static analysis cannot verify convergence
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => { const v = x.get(); if (v < 10) { x.set(v + 1); } });`,
      errors: [{ messageId: 'noSelfReadWrite' }],
    },
  ],
});
