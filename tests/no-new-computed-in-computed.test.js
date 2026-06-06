import { RuleTester } from 'eslint';
import rule from '../rules/no-new-computed-in-computed.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-new-computed-in-computed', rule, {
  valid: [
    // computed declared outside — correct pattern
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const inner = computed(() => x.get() * 2);
     const outer = computed(() => inner.get() + 1);`,

    // keyed computed inside computed — this is the intended pattern
    `import { computed, signal } from 'kensington';
     const items = signal([{ id: 'a', v: 1 }]);
     const list = computed(() => items.get().map(item =>
       computed(() => item.v * 2, item.id).get()
     ));`,

    // keyed computed with numeric key
    `import { computed, signal } from 'kensington';
     const items = signal([1, 2, 3]);
     const list = computed(() => items.get().map((x, i) =>
       computed(() => x * 2, i).get()
     ));`,

    // keyed .transform() inside computed — also the intended pattern
    `import { computed, signal } from 'kensington';
     const src = signal(0);
     const items = signal([{ id: 'a' }]);
     const list = computed(() => items.get().map(item =>
       src.transform(v => v + item.id, item.id).get()
     ));`,

    // .transform() outside a computed — no concern
    `import { signal } from 'kensington';
     const src = signal(0);
     const doubled = src.transform(v => v * 2);`,

    // computed() inside an effect — covered by no-new-computed-in-effect, not flagged here
    `import { effect, computed, signal } from 'kensington';
     const x = signal(0);
     effect(() => { const c = computed(() => x.get()); });`,

    // computed not imported from kensington
    `import { computed } from 'kensington';
     import { computed as otherComputed } from 'other-lib';
     const outer = computed(() => { const inner = otherComputed(() => 1); return inner.get(); });`,
  ],

  invalid: [
    // unkeyed computed() directly inside computed callback
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             const outer = computed(() => { const inner = computed(() => x.get()); return inner.get(); });`,
      errors: [{ messageId: 'noNewComputedInComputed' }],
    },

    // unkeyed computed() inside a nested function within computed
    {
      code: `import { computed, signal } from 'kensington';
             const x = signal(0);
             const outer = computed(() => { const fn = () => computed(() => x.get()); return fn().get(); });`,
      errors: [{ messageId: 'noNewComputedInComputed' }],
    },

    // unkeyed computed() inside map — flagged; should use keyed form
    {
      code: `import { computed, signal } from 'kensington';
             const items = signal([{ id: 'a', v: 1 }]);
             const list = computed(() => items.get().map(item => computed(() => item.v * 2)));`,
      errors: [{ messageId: 'noNewComputedInComputed' }],
    },

    // unkeyed .transform() inside computed — flagged with transform-specific message
    {
      code: `import { computed, signal } from 'kensington';
             const src = signal(0);
             const items = signal([{ id: 'a' }]);
             const list = computed(() => items.get().map(item => src.transform(v => v + item.id).get()));`,
      errors: [{ messageId: 'noNewTransformInComputed' }],
    },

    // unkeyed .transform() inside nested function within computed
    {
      code: `import { computed, signal } from 'kensington';
             const src = signal(0);
             const outer = computed(() => { const fn = () => src.transform(v => v * 2); return fn().get(); });`,
      errors: [{ messageId: 'noNewTransformInComputed' }],
    },
  ],
});
