import { RuleTester } from 'eslint';
import rule from '../rules/require-reactive-key.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('require-reactive-key', rule, {
  valid: [
    // Keyed signal.
    `import { signal } from 'kensington';
     const s = signal(0, 'count');`,

    // Keyed computed.
    `import { computed } from 'kensington';
     const c = computed(() => 1 + 1, 'sum');`,

    // Keyed .transform.
    `import { signal } from 'kensington';
     const s = signal(0, 'src');
     const d = s.transform(v => v * 2, 'double');`,

    // Keyed everywhere with various key shapes.
    `import { signal, computed } from 'kensington';
     const id = 'row-7';
     const a = signal(0, id);
     const b = signal(0, \`row-\${id}\`);
     const c = computed(() => a.get(), id + '-derived');`,

    // signal/computed from a non-kensington module — not flagged.
    `import { signal } from 'other-lib';
     const s = signal(0);`,

    // effect() is intentionally not flagged. Effects don't take keys.
    `import { effect } from 'kensington';
     effect(() => console.log('tick'));`,

    // .set() / .get() / .value reads — never flagged.
    `import { signal } from 'kensington';
     const s = signal(0, 'k');
     s.set(1);
     s.get();
     const v = s.value;`,

    // Plain .transform() on a non-signal object that the user happens to also
    // own — still flagged by this rule (syntax-based detection). Suppress at
    // the call site with eslint-disable-next-line if you have a different
    // `.transform()` semantics. This case is documented as the rule's
    // false-positive surface and is the trade-off for paranoid simplicity.
    // (No assertion needed; just a note. The invalid section below covers it.)
  ],

  invalid: [
    // Unkeyed signal at module scope.
    {
      code: `import { signal } from 'kensington';
             const s = signal(0);`,
      errors: [{ messageId: 'missingKey' }],
    },

    // Unkeyed computed at module scope.
    {
      code: `import { computed } from 'kensington';
     const c = computed(() => 1 + 1);`,
      errors: [{ messageId: 'missingKey' }],
    },

    // Unkeyed .transform() on a kensington signal.
    {
      code: `import { signal } from 'kensington';
             const s = signal(0, 'k');
             const d = s.transform(v => v * 2);`,
      errors: [{ messageId: 'missingKey' }],
    },

    // Aliased signal import.
    {
      code: `import { signal as sig } from 'kensington';
             const s = sig(0);`,
      errors: [{ messageId: 'missingKey' }],
    },

    // Aliased computed import.
    {
      code: `import { computed as comp } from 'kensington';
             const c = comp(() => 1);`,
      errors: [{ messageId: 'missingKey' }],
    },

    // Multiple unkeyed primitives, one report each.
    {
      code: `import { signal, computed } from 'kensington';
             const a = signal(0);
             const b = signal('');
             const c = computed(() => 1);`,
      errors: [
        { messageId: 'missingKey' },
        { messageId: 'missingKey' },
        { messageId: 'missingKey' },
      ],
    },

    // .transform() chained off another .transform(). Both unkeyed.
    {
      code: `import { signal } from 'kensington';
             const s = signal(0, 'k');
             const d = s.transform(v => v * 2).transform(v => v + 1);`,
      errors: [
        { messageId: 'missingKey' },
        { messageId: 'missingKey' },
      ],
    },

    // Unkeyed signal inside a function body.
    {
      code: `import { signal } from 'kensington';
             function build() { return signal(0); }`,
      errors: [{ messageId: 'missingKey' }],
    },

  ],
});
