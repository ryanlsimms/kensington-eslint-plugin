import { RuleTester } from 'eslint';
import rule from '../rules/no-async-effect.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-async-effect', rule, {
  valid: [
    // Owned effects use the same synchronous callback contract, without a handle to capture.
    `import { t } from 'kensington'; t.div().effect(() => {});`,
    `function component(root) { root.effect(() => { load().then(update); }); }`,
    `root['effect'](function() { update(); });`,
    `root?.effect(() => {}); root.effect?.(() => {});`,
    `root.effect();`,
    `root.otherEffect(async () => {});`,
    `root[method](async () => {});`,
    `const effect = async fn => fn(); effect(async () => {});`,
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
    {
      code: `import { t } from 'kensington'; t.div().effect(async () => { await load(); });`,
      errors: [{ messageId: 'noAsyncEffect' }],
    },
    {
      code: `function component(root) { root.effect(async function() { await load(); }); }`,
      errors: [{ messageId: 'noAsyncEffect' }],
    },
    {
      code: `import { t as tags } from 'kensington';
             const panel = tags.div(); panel.effect(async () => {});`,
      errors: [{ messageId: 'noAsyncEffect' }],
    },
    {
      code: `root['effect'](async () => {});`,
      errors: [{ messageId: 'noAsyncEffect' }],
    },
    {
      code: `root?.effect(async () => {}); root.effect?.(async () => {});`,
      errors: [{ messageId: 'noAsyncEffect' }, { messageId: 'noAsyncEffect' }],
    },
    {
      code: `import * as k from 'kensington'; k.effect(async () => {});`,
      errors: [{ messageId: 'noAsyncEffect' }],
    },
    {
      code: `import { effect as watch } from 'kensington/reactive'; watch(async () => {});`,
      errors: [{ messageId: 'noAsyncEffect' }],
    },
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
