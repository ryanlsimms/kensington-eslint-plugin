import { RuleTester } from 'eslint';
import rule from '../rules/no-helper-function-trap.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-helper-function-trap', rule, {
  valid: [
    // Helper called from a reactive callback, but the inner signal IS keyed.
    `import { signal } from 'kensington';
     function row(item) { const open = signal(false, item.id); return open; }
     const list = items.mapWithKey('id', item => row(item));`,

    // Helper is defined but never reached from any reactive callback.
    `import { signal } from 'kensington';
     function build() { const s = signal(0); return s; }
     const top = build();`,

    // Reactive callback contains no helper calls. Nothing to mark.
    `import { computed } from 'kensington';
     const c = computed(() => 1 + 1);`,

    // Helper called only from non-reactive code.
    `import { signal } from 'kensington';
     function counter() { const s = signal(0); return s; }
     const a = counter();
     const b = counter();`,

    // Inline anonymous arrow inside a computed. The existing rule
    // `no-new-signal-in-computed` catches the lexical case; this rule is for
    // the call-stack case and intentionally doesn't fire here.
    `import { computed, signal } from 'kensington';
     const c = computed(() => { const x = signal(0); return x.get(); });`,

    // Const-assigned arrow helper with a keyed signal.
    `import { computed } from 'kensington';
     const derive = item => item.flag.transform(v => v ? 'on' : 'off', \`\${item.id}-flag\`);
     const list = items.mapWithKey('id', item => derive(item));`,

    // Helper passed to effect() but doesn't create reactive primitives.
    `import { effect } from 'kensington';
     function onSave() { localStorage.setItem('saved', '1'); }
     effect(() => onSave());`,
  ],

  invalid: [
    // Classic mapWithKey + helper with single-call arrow.
    {
      code: `import { signal } from 'kensington';
             function row(item) { const open = signal(false); return open; }
             const list = items.mapWithKey('id', item => row(item));`,
      errors: [{ messageId: 'helperFunctionTrap' }],
    },

    // Bare-identifier callback to mapWithKey.
    {
      code: `import { signal } from 'kensington';
             function row(item) { const open = signal(false); return open; }
             const list = items.mapWithKey('id', row);`,
      errors: [{ messageId: 'helperFunctionTrap' }],
    },

    // computed-wrapped UI variant. cell() is called inside an outer
    // computed via list.map(a => cell(a)) — wrapped through a non-reactive
    // method but still on the call stack.
    {
      code: `import { computed, signal } from 'kensington';
             function cell(addr) { const isActive = computed(() => addr === 'A1'); return isActive; }
             const body = computed(() => list.map(a => cell(a)));`,
      errors: [{ messageId: 'helperFunctionTrap' }],
    },

    // Transitive: outer -> inner -> unkeyed primitive.
    {
      code: `import { signal } from 'kensington';
             function innerHelper(x) { const s = signal(0); return s; }
             function outerHelper(x) { return innerHelper(x); }
             const list = items.mapWithKey('id', x => outerHelper(x));`,
      errors: [{ messageId: 'helperFunctionTrap' }],
    },

    // .transform() unkeyed inside helper called from mapWithKey.
    {
      code: `import { computed } from 'kensington';
             function row(item) { return item.flag.transform(v => v ? 'on' : 'off'); }
             const list = items.mapWithKey('id', item => row(item));`,
      errors: [{ messageId: 'helperFunctionTrap' }],
    },

    // Helper passed as bare identifier to .transform().
    {
      code: `import { signal } from 'kensington';
             function expand(v) { const s = signal(v); return s; }
             const derived = base.transform(expand);`,
      errors: [{ messageId: 'helperFunctionTrap' }],
    },

    // Helper passed via single-call arrow to .transform().
    {
      code: `import { signal } from 'kensington';
             function expand(v) { const s = signal(v); return s; }
             const derived = base.transform(v => expand(v));`,
      errors: [{ messageId: 'helperFunctionTrap' }],
    },

    // Helper passed via bare identifier to computed().
    {
      code: `import { computed, signal } from 'kensington';
             function derive() { const s = signal(0); return s.get(); }
             const c = computed(derive);`,
      errors: [{ messageId: 'helperFunctionTrap' }],
    },

    // Helper passed to effect() should be reactive entry point too.
    {
      code: `import { effect, signal } from 'kensington';
             function tick() { const c = signal(0); c.set(1); }
             effect(() => tick());`,
      errors: [{ messageId: 'helperFunctionTrap' }],
    },

    // Const-assigned arrow helper.
    {
      code: `import { signal } from 'kensington';
             const row = item => { const s = signal(0); return s; };
             const list = items.mapWithKey('id', item => row(item));`,
      errors: [{ messageId: 'helperFunctionTrap' }],
    },

    // Renamed import. signal -> sig.
    {
      code: `import { signal as sig } from 'kensington';
             function row(item) { const s = sig(0); return s; }
             const list = items.mapWithKey('id', item => row(item));`,
      errors: [{ messageId: 'helperFunctionTrap' }],
    },

    // Multiple unkeyed primitives inside one helper -> one report each.
    {
      code: `import { computed, signal } from 'kensington';
             function row(item) {
               const a = signal(0);
               const b = computed(() => 1);
               const c = item.flag.transform(v => v);
               return [a, b, c];
             }
             const list = items.mapWithKey('id', row);`,
      errors: [
        { messageId: 'helperFunctionTrap' },
        { messageId: 'helperFunctionTrap' },
        { messageId: 'helperFunctionTrap' },
      ],
    },

    // Helper called from BOTH reactive and non-reactive sites. Still reports
    // because reaching it from any reactive path is enough.
    {
      code: `import { signal } from 'kensington';
             function row(item) { const s = signal(0); return s; }
             const standalone = row({ id: 'x' });
             const list = items.mapWithKey('id', item => row(item));`,
      errors: [{ messageId: 'helperFunctionTrap' }],
    },
  ],
});
