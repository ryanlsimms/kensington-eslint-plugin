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

    // bound to const, used as tag arg — common composition idiom
    `import { computed, t } from 'kensington';
     const v = computed(() => {
       const sig = computed(() => 42, 'sig');
       return t.div(sig);
     });`,

    // bound to const, used as multiple tag args
    `import { computed, t } from 'kensington';
     const v = computed(() => {
       const sig = computed(() => 42, 'sig');
       return t.div([t.span(sig), t.strong(sig)]);
     });`,

    // bound to const, returned directly from the computed callback (canonical
    // return-a-signal-from-a-component pattern)
    `import { computed } from 'kensington';
     const v = computed(() => {
       const sig = computed(() => 42, 'sig');
       return sig;
     });`,

    // bound to const, passed to a helper function — the rule trusts the helper
    `import { computed, t } from 'kensington';
     function lineChart(s) { return t.div(s); }
     const v = computed(() => {
       const points = computed(() => [1, 2, 3], 'points');
       return lineChart(points);
     });`,

    // bound to const, consumed via .get() and used in event handler .set()
    `import { computed, t } from 'kensington';
     const v = computed(() => {
       const sig = computed(() => 42, 'sig');
       return t.button({ onclick: () => sig.get() }, 'click');
     });`,

    // bound to const, multiple references all method chains
    `import { computed, t } from 'kensington';
     const v = computed(() => {
       const sig = computed(() => 42, 'sig');
       return t.div([sig.get(), sig.transform(v => v + 1, 'twice')]);
     });`,
  ],

  invalid: [
    // signal instance assigned to a module-level cache and returned from a
    // nested map callback. The return-from-nested-fn pattern is the escape.
    {
      code: `import { computed, signal } from 'kensington';
             const items = signal([{ id: 'a' }]);
             const cache = new Map();
             const outer = computed(() => items.get().map(item => {
               const s = signal(false, item.id);
               cache.set(item.id, s);
               return s;
             }));`,
      errors: [{ messageId: 'escapeReturn' }],
    },

    // computed instance returned from map (escapes via nested-fn return)
    {
      code: `import { computed, signal } from 'kensington';
             const items = signal([{ id: 'a', v: 1 }]);
             const list = computed(() => items.get().map(item =>
               computed(() => item.v * 2, item.id)
             ));`,
      errors: [{ messageId: 'escapeReturn' }],
    },

    // transform instance returned from map (escapes via nested-fn return)
    {
      code: `import { computed, signal } from 'kensington';
             const src = signal(0);
             const items = signal([{ id: 'a' }]);
             const list = computed(() => items.get().map(item =>
               src.transform(v => v + item.id, item.id)
             ));`,
      errors: [{ messageId: 'escapeReturn' }],
    },

    // renamed import — rule still fires
    {
      code: `import { computed as c, signal } from 'kensington';
             const items = signal([{ id: 'a', v: 1 }]);
             const list = c(() => items.get().map(item => c(() => item.v, item.id)));`,
      errors: [{ messageId: 'escapeReturn' }],
    },

    // explicit assignment to outside-scope variable
    {
      code: `import { computed, signal } from 'kensington';
             let leaked;
             const outer = computed(() => {
               const sig = computed(() => 42, 'sig');
               leaked = sig;
               return sig;
             });`,
      errors: [{ messageId: 'escapeAssign' }],
    },
  ],
});
