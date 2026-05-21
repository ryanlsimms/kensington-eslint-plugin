import { RuleTester } from 'eslint';
import rule from '../rules/no-set-on-transform.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-set-on-transform', rule, {
  valid: [
    // .set() on the source signal, not the transform result
    `import { signal } from 'kensington';
     const x = signal(0);
     const d = x.transform(v => v * 2);
     x.set(5);`,

    // .get() on a transform result — fine
    `import { signal } from 'kensington';
     const x = signal(0);
     const d = x.transform(v => v * 2);
     console.log(d.get());`,

    // Map.set with two args — not flagged
    `import { signal } from 'kensington';
     const x = signal(0);
     const d = x.transform(v => v * 2);
     const m = new Map();
     m.set('key', d.get());`,
  ],

  invalid: [
    // direct .set() on a transform binding
    {
      code: `import { signal } from 'kensington';
             const x = signal(0);
             const d = x.transform(v => v * 2);
             d.set(10);`,
      errors: [{ messageId: 'noSetOnTransform' }],
    },

    // .set() on transform result inside an effect
    {
      code: `import { effect, signal } from 'kensington';
             const x = signal(0);
             const d = x.transform(v => v * 2);
             effect(() => { d.set(5); });`,
      errors: [{ messageId: 'noSetOnTransform' }],
    },

    // chained transform assigned to a variable
    {
      code: `import { signal } from 'kensington';
             const x = signal(0);
             const d = x.transform(v => v * 2).transform(v => v + 1);
             d.set(99);`,
      errors: [{ messageId: 'noSetOnTransform' }],
    },
  ],
});
