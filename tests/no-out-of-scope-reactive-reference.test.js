import { RuleTester } from 'eslint';
import rule from '../rules/no-out-of-scope-reactive-reference.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-out-of-scope-reactive-reference', rule, {
  valid: [
    // computed consumed inline with .get()
    `import { computed, signal } from 'kensington';
     const items = signal([{ id: 'a', v: 1 }]);
     const list = computed(() => items.get().map(item =>
       computed(() => item.v * 2, item.id).get()
     ));`,

    // computed passed as tag content
    `import { computed, signal, t } from 'kensington';
     const items = signal([{ id: 'a', v: 1 }]);
     const list = computed(() => items.get().map(item =>
       t.li({ dataKey: item.id }, computed(() => item.v * 2, item.id))
     ));`,

    // computed passed as tag attribute value
    `import { computed, signal, t } from 'kensington';
     const items = signal([{ id: 'a' }]);
     const filter = signal('a');
     const list = computed(() => items.get().map(item =>
       t.li({ dataKey: item.id, class: computed(() => filter.get() === item.id ? 'on' : '', item.id) }, item.id)
     ));`,

    // signal consumed via .transform() on the same line (the transform itself is then a tag arg)
    `import { computed, signal, t } from 'kensington';
     const items = signal([{ id: 'a' }]);
     const list = computed(() => items.get().map(item =>
       t.li({ dataKey: item.id, class: signal(false, item.id).transform(v => v ? 'on' : '', item.id) }, item.id)
     ));`,

    // transform consumed inline with .get()
    `import { computed, signal } from 'kensington';
     const src = signal(0);
     const items = signal([{ id: 'a' }]);
     const list = computed(() => items.get().map(item =>
       src.transform(v => v + item.id, item.id).get()
     ));`,

    // transform passed as tag attribute
    `import { computed, signal, t } from 'kensington';
     const filter = signal('a');
     const items = signal([{ id: 'a' }]);
     const list = computed(() => items.get().map(item =>
       t.li({ dataKey: item.id, class: filter.transform(f => f === item.id ? 'on' : '', item.id) }, item.id)
     ));`,

    // call inside a content array passed to a tag
    `import { computed, signal, t } from 'kensington';
     const items = signal([{ id: 'a', label: 'A' }]);
     const list = computed(() => items.get().map(item =>
       t.li({ dataKey: item.id }, ['Value: ', computed(() => item.label.toUpperCase(), item.id)])
     ));`,

    // call outside any computed — no scope to escape from
    `import { computed, signal } from 'kensington';
     const x = signal(0);
     const c = computed(() => x.get() * 2);
     const s = signal(false, 'k');`,

    // creation inside an effect — different rule's concern
    `import { computed, effect, signal } from 'kensington';
     const x = signal(0);
     effect(() => { const c = computed(() => x.get(), 'k'); });`,

    // not imported from kensington
    `import { computed } from 'kensington';
     import { computed as otherComputed } from 'other-lib';
     const outer = computed(() => otherComputed(() => 1, 'key'));`,
  ],

  invalid: [
    // signal instance assigned to a module-level cache (escapes)
    {
      code: `import { computed, signal } from 'kensington';
             const items = signal([{ id: 'a' }]);
             const cache = new Map();
             const outer = computed(() => items.get().map(item => {
               const s = signal(false, item.id);
               cache.set(item.id, s);
               return s;
             }));`,
      // Two violations: `signal(false, item.id)` itself (assigned to s, escapes),
      // and the same call referenced via `s` in the return. Rule reports the call site.
      errors: [{ messageId: 'noOutOfScopeSignal' }],
    },

    // computed instance returned from map (escapes)
    {
      code: `import { computed, signal } from 'kensington';
             const items = signal([{ id: 'a', v: 1 }]);
             const list = computed(() => items.get().map(item =>
               computed(() => item.v * 2, item.id)
             ));`,
      errors: [{ messageId: 'noOutOfScopeComputed' }],
    },

    // transform instance returned from map (escapes)
    {
      code: `import { computed, signal } from 'kensington';
             const src = signal(0);
             const items = signal([{ id: 'a' }]);
             const list = computed(() => items.get().map(item =>
               src.transform(v => v + item.id, item.id)
             ));`,
      errors: [{ messageId: 'noOutOfScopeTransform' }],
    },

    // renamed import — rule still fires
    {
      code: `import { computed as c, signal } from 'kensington';
             const items = signal([{ id: 'a', v: 1 }]);
             const list = c(() => items.get().map(item => c(() => item.v, item.id)));`,
      errors: [{ messageId: 'noOutOfScopeComputed' }],
    },
  ],
});
