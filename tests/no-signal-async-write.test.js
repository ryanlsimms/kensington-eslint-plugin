import { RuleTester } from 'eslint';
import rule from '../rules/no-signal-async-write.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-signal-async-write', rule, {
  valid: [
    // .value read (no subscription) — async write is safe
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { const v = x.value; setTimeout(() => x.set(v + 1)); });`,

    // different binding written in async callback
    `import { effect, signal } from 'kensington';
     const x = signal(0); const y = signal(0);
     effect(() => { x.get(); setTimeout(() => y.set(1)); });`,

    // .get() only, no .set() in async callback
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { x.get(); setTimeout(() => console.log('done')); });`,

    // not from kensington
    `import { effect } from 'other-lib';
     const x = { get() {}, set(v) {} };
     effect(() => { x.get(); setTimeout(() => x.set(1)); });`,

    // .set() in async callback but .get() never called in effect body
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { setTimeout(() => x.set(1)); });`,
  ],

  invalid: [
    // classic async loop via setTimeout
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => { x.get(); setTimeout(() => x.set(v => v + 1)); });`,
      errors: [{ messageId: 'noSignalAsyncWrite' }],
    },

    // async loop via requestAnimationFrame
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => { x.get(); requestAnimationFrame(() => x.set(v => v + 1)); });`,
      errors: [{ messageId: 'noSignalAsyncWrite' }],
    },

    // async loop via fetch .then()
    {
      code: `import { effect, signal } from 'kensington';
             const selectedId = signal(null);
             const items = signal([]);
             effect(() => {
               items.get();
               const id = selectedId.get();
               fetch('/api/default').then(r => r.json()).then(data => { selectedId.set(data.id); });
             });`,
      errors: [{ messageId: 'noSignalAsyncWrite' }],
    },

    // async loop via queueMicrotask
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => { x.get(); queueMicrotask(() => x.set(1)); });`,
      errors: [{ messageId: 'noSignalAsyncWrite' }],
    },

    // nested async callback (setTimeout → fetch.then)
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             effect(() => {
               x.get();
               setTimeout(() => {
                 fetch('/api').then(() => { x.set(1); });
               });
             });`,
      errors: [{ messageId: 'noSignalAsyncWrite' }],
    },
  ],
});
