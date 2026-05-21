import { RuleTester } from 'eslint';
import rule from '../rules/no-effect-in-computed.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-effect-in-computed', rule, {
  valid: [
    // effect at module level — fine
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { console.log(x.get()); });`,

    // effect inside another effect — not a computed
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { effect(() => { x.get(); }); });`,

    // effect not from kensington
    `import { computed, signal } from 'kensington';
     import { effect } from 'other-lib';
     const x = signal(0);
     computed(() => { effect(() => {}); return x.get(); });`,
  ],

  invalid: [
    // effect() directly inside computed body
    {
      code: `import { computed, effect, signal } from 'kensington';
             const x = signal(0);
             computed(() => { effect(() => { console.log('side effect'); }); return x.get(); });`,
      errors: [{ messageId: 'noEffectInComputed' }],
    },

    // renamed import — rule still fires when effect is aliased
    {
      code: `import { computed, effect as fx, signal } from 'kensington';
             const x = signal(0);
             computed(() => { fx(() => { console.log('side effect'); }); return x.get(); });`,
      errors: [{ messageId: 'noEffectInComputed' }],
    },

    // effect() inside a nested function within computed
    {
      code: `import { computed, effect, signal } from 'kensington';
             const x = signal(0);
             computed(() => { const run = () => effect(() => {}); run(); return x.get(); });`,
      errors: [{ messageId: 'noEffectInComputed' }],
    },
  ],
});
