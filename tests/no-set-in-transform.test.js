import { RuleTester } from 'eslint';
import rule from '../rules/no-set-in-transform.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-set-in-transform', rule, {
  valid: [
    // .set() in effect, not transform
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { x.set(1); });`,

    // no .set() in transform at all
    `import { signal } from 'kensington';
     const x = signal(0);
     const d = x.transform(v => v * 2);`,

    // .set() inside a nested effect() within transform — separate reactive context
    `import { effect, signal } from 'kensington';
     const x = signal(0);
     const y = signal(0);
     x.transform(v => { effect(() => { y.set(1); }); return v; });`,

    // event handler inside transform — .set() fires on user interaction, not during reactive run
    `import { signal } from 'kensington';
     const count = signal(0);
     count.transform(v => t.button({ onclick: () => count.set(n => n + 1) }, v));`,

    // .set() inside a nested computed() within transform — separate reactive context
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const y = signal(0);
     x.transform(v => { const c = computed(() => { y.set(1); return v; }); return c; });`,

    // Map.set — two arguments, not flagged
    `import { signal } from 'kensington';
     const map = new Map();
     const x = signal(0);
     x.transform(v => { map.set('key', v); return v; });`,

    // renamed effect import — still recognised as a stop boundary
    `import { effect as fx, signal } from 'kensington';
     const x = signal(0);
     const y = signal(0);
     x.transform(v => { fx(() => { y.set(1); }); return v; });`,

    // renamed computed import — still recognised as a stop boundary
    `import { computed as derive, signal } from 'kensington';
     const x = signal(0);
     const y = signal(0);
     x.transform(v => { const c = derive(() => { y.set(1); return v; }); return c; });`,
  ],

  invalid: [
    // .set() directly in transform callback
    {
      code: `import { signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             x.transform(v => { y.set(v); return v; });`,
      errors: [{ messageId: 'noSetInTransform' }],
    },

    // .set() inside a setTimeout within transform
    {
      code: `import { signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             x.transform(v => { setTimeout(() => y.set(v)); return v; });`,
      errors: [{ messageId: 'noSetInTransform' }],
    },

    // .set() inside an arrow function defined within transform
    {
      code: `import { signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             x.transform(v => { const fn = () => y.set(v); fn(); return v; });`,
      errors: [{ messageId: 'noSetInTransform' }],
    },

    // chained .transform() — inner transform also caught
    {
      code: `import { signal } from 'kensington';
             const x = signal(0);
             const y = signal(0);
             x.transform(v => v * 2).transform(v => { y.set(v); return v; });`,
      errors: [{ messageId: 'noSetInTransform' }],
    },
  ],
});
