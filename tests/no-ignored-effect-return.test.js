import { RuleTester } from 'eslint';
import rule from '../rules/no-ignored-effect-return.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-ignored-effect-return', rule, {
  valid: [
    // return value captured — fine
    `import { effect, signal } from 'kensington';
     function setup() {
       const x = signal(0);
       const handle = effect(() => { console.log(x.get()); });
       return handle;
     }`,

    // module-level effect with ignored return — intentionally long-lived
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { console.log(x.get()); });`,

    // return value passed directly to another function
    `import { effect, signal } from 'kensington';
     function setup() { return effect(() => {}); }`,

    // return value stored on object
    `import { effect, signal } from 'kensington';
     class MyEl extends HTMLElement {
       connectedCallback() { this._eff = effect(() => {}); }
       disconnectedCallback() { this._eff.stop(); }
     }`,

    // effect not from kensington
    `import { effect } from 'other-lib';
     function setup() { effect(() => {}); }`,
  ],

  invalid: [
    // ignored inside a regular function
    {
      code: `import { effect, signal } from 'kensington';
             function setup() { effect(() => {}); }`,
      errors: [{ messageId: 'noIgnoredEffectReturn' }],
    },

    // ignored inside an arrow function
    {
      code: `import { effect, signal } from 'kensington';
             const setup = () => { effect(() => {}); };`,
      errors: [{ messageId: 'noIgnoredEffectReturn' }],
    },

    // ignored inside a class method (connectedCallback without storing)
    {
      code: `import { effect } from 'kensington';
             class MyEl extends HTMLElement {
               connectedCallback() { effect(() => {}); }
             }`,
      errors: [{ messageId: 'noIgnoredEffectReturn' }],
    },

    // inner effect inside outer effect — inner return ignored inside a function
    {
      code: `import { effect } from 'kensington';
             effect(() => { effect(() => {}); });`,
      errors: [{ messageId: 'noIgnoredEffectReturn' }],
    },
  ],
});
