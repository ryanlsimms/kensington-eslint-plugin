import { RuleTester } from 'eslint';
import rule from '../rules/no-new-signal-in-computed.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-new-signal-in-computed', rule, {
  valid: [
    // signal declared outside computed — correct pattern
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const doubled = computed(() => x.get() * 2);`,

    // signal() inside an effect — covered by no-new-signal-in-effect, not flagged here
    `import { effect, signal } from 'kensington';
     effect(() => { const x = signal(0); });`,

    // signal not imported from kensington
    `import { computed } from 'kensington';
     import { signal } from 'other-lib';
     const c = computed(() => { const x = signal(0); return x.get(); });`,

    // keyed signal inside computed — recommended pattern for local state per item
    `import { computed, signal } from 'kensington';
     const items = signal([{ id: 'a' }]);
     const list = computed(() => items.get().map(item => {
       const local = signal(false, item.id);
       return local;
     }));`,
  ],

  invalid: [
    // unkeyed signal() directly inside computed callback
    {
      code: `import { computed, signal } from 'kensington';
             const c = computed(() => { const x = signal(0); return x.get(); });`,
      errors: [{ messageId: 'noNewSignalInComputed' }],
    },

    // unkeyed signal() inside nested function within computed
    {
      code: `import { computed, signal } from 'kensington';
             const c = computed(() => { const fn = () => signal(0); return fn().get(); });`,
      errors: [{ messageId: 'noNewSignalInComputed' }],
    },

    // unkeyed signal() inside nested computed — flagged for the inner computed
    {
      code: `import { computed, signal } from 'kensington';
             const outer = computed(() => { const inner = computed(() => { const x = signal(0); return x.get(); }); return inner.get(); });`,
      errors: [{ messageId: 'noNewSignalInComputed' }],
    },

    // renamed import — rule still fires when signal is aliased and unkeyed
    {
      code: `import { computed, signal as sig } from 'kensington';
             const c = computed(() => { const x = sig(0); return x.get(); });`,
      errors: [{ messageId: 'noNewSignalInComputed' }],
    },
  ],
});
