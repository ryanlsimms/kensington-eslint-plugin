import { RuleTester } from 'eslint';
import rule from '../rules/no-effect-in-effect.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-effect-in-effect', rule, {
  valid: [
    // effects at the same level — correct pattern
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { console.log(x.get()); });
     effect(() => { console.log(x.get() * 2); });`,

    // effect() inside a computed — covered by no-effect-in-computed, not flagged here
    `import { effect, computed, signal } from 'kensington';
     const x = signal(0);
     const c = computed(() => { effect(() => {}); return x.get(); });`,

    // effect not imported from kensington
    `import { effect } from 'kensington';
     import { effect as otherEffect } from 'other-lib';
     effect(() => { otherEffect(() => {}); });`,
  ],

  invalid: [
    // effect() directly inside effect callback — return discarded
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => { effect(() => { console.log(x.get()); }); });`,
      errors: [{ messageId: 'noEffectInEffect' }],
    },

    // effect() inside effect callback — return captured (still leaks previous handle)
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => { const inner = effect(() => { console.log(x.get()); }); });`,
      errors: [{ messageId: 'noEffectInEffect' }],
    },

    // effect() inside async callback within effect
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => { setTimeout(() => { effect(() => { console.log(x.get()); }); }); });`,
      errors: [{ messageId: 'noEffectInEffect' }],
    },
  ],
});
