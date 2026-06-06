# kensington-eslint-plugin

ESLint rules for [kensington](https://github.com/beezwax/kensington) signal correctness.

Catches common reactive programming mistakes (read/write loops, writes inside computed derivations, orphaned effects, and async subscription pitfalls) at lint time rather than at runtime.

## Installation

```sh
npm install --save-dev kensington-eslint-plugin
```

Requires ESLint 9+ and Node 18+.

## Usage

Add the recommended config to your `eslint.config.js`:

```js
import kensington from 'kensington-eslint-plugin';

export default [
  kensington.configs.recommended,
  // ...your other configs
];
```

Or enable rules individually:

```js
import kensington from 'kensington-eslint-plugin';

export default [
  {
    plugins: { kensington },
    rules: {
      'kensington/no-set-in-derivation': 'error',
      'kensington/no-self-read-write': 'error',
      // ...
    },
  },
];
```

The `style` config is opt-in and bundles the formatting rules at `warn` level:

```js
import kensington from 'kensington-eslint-plugin';

export default [
  kensington.configs.recommended,
  kensington.configs.style,
];
```

The formatting rules match calls on `t.<tag>(...)` by default. If your Kensington
instance is bound to a different name, set it once via plugin-level settings:

```js
import kensington from 'kensington-eslint-plugin';

export default [
  kensington.configs.recommended,
  kensington.configs.style,
  {
    settings: { kensington: { objectNames: ['t', 'tag'] } },
  },
];
```

Per-rule options override the shared setting:

```js
'kensington/prefer-camelcase-attrs': ['warn', { objectNames: ['k'] }],
```

## Editor and tooling support

Because this is a standard ESLint plugin, it works anywhere ESLint runs with no extra configuration needed.

- **Editors.** VS Code, JetBrains IDEs (RubyMine, WebStorm, etc.), Neovim, and any editor with an ESLint language server show inline errors automatically once the plugin is configured.
- **CI.** Run `eslint --max-warnings 0` in any pipeline to enforce rules on every push.
- **Pre-commit hooks.** Works with `lint-staged` or any hook runner that invokes ESLint.
- **Programmatic use.** Available via the ESLint Node.js API (`new ESLint()`) for custom tooling.

## Rules

| Rule | Description | Recommended |
|------|-------------|-------------|
| [`no-set-in-derivation`](#no-set-in-derivation) | Disallow `.set()` inside a `computed()` body or `.transform()` callback | error |
| [`no-self-read-write`](#no-self-read-write) | Disallow reading and writing the same signal in the same reactive run | error |
| [`no-set-on-derived-signal`](#no-set-on-derived-signal) | Disallow `.set()` on a derived (computed or transform) signal | error |
| [`no-new-signal-in-effect`](#no-new-signal-in-effect) | Disallow creating a new `signal()` inside an `effect()` body | error |
| [`no-effect-in-computed`](#no-effect-in-computed) | Disallow calling `effect()` inside a `computed()` body | error |
| [`no-signal-async-write`](#no-signal-async-write) | Disallow writing a signal in an async callback when it was read in the enclosing `effect()` | warn |
| [`no-ignored-effect-return`](#no-ignored-effect-return) | Require capturing the return value of `effect()` inside a function | warn |
| [`prefer-value-in-async`](#prefer-value-in-async) | Prefer `.value` over `.get()` inside async callbacks within an `effect()` | warn |
| [`no-new-computed-in-effect`](#no-new-computed-in-effect) | Disallow creating a new `computed()` inside an `effect()` body | error |
| [`no-new-signal-in-computed`](#no-new-signal-in-computed) | Require a stable key for `signal()` calls inside a `computed()` body | error |
| [`no-unsafe-literal`](#no-unsafe-literal) | Disallow `.unsafeLiteral()` calls that bypass XSS protection | error |
| [`no-new-computed-in-computed`](#no-new-computed-in-computed) | Require a stable key for `computed()` and `.transform()` calls inside a `computed()` body | warn |
| [`no-out-of-scope-reactive-reference`](#no-out-of-scope-reactive-reference) | Disallow referencing a `signal()`, `computed()`, or `.transform()` from outside the computed scope where it was created | warn |
| [`no-effect-in-effect`](#no-effect-in-effect) | Disallow creating a new `effect()` inside an `effect()` body | error |
| [`no-async-effect`](#no-async-effect) | Disallow async callbacks passed to `effect()` | error |
| [`no-async-computed`](#no-async-computed) | Disallow async callbacks passed to `computed()` | error |
| [`prefer-boolean-attribute-true`](#prefer-boolean-attribute-true) | Prefer `true` over `''` for boolean HTML attributes | style |
| [`prefer-camelcase-attrs`](#prefer-camelcase-attrs) | Prefer camelCase identifier keys over quoted kebab-case | style |
| [`prefer-style-object`](#prefer-style-object) | Prefer a `style` object over a CSS string | style |
| [`prefer-nested-attr-groups`](#prefer-nested-attr-groups) | Prefer nested form when attrs share a kebab prefix | style |
| [`prefer-array-for-multiline-content`](#prefer-array-for-multiline-content) | Require array brackets around multi-line tag content | style |
| [`attrs-on-call-line`](#attrs-on-call-line) | Attributes object must hug the tag call on both ends | style |
| [`attrs-canonical-shape`](#attrs-canonical-shape) | Attributes object must be inline or canonically stacked | style |
| [`consistent-content-layout`](#consistent-content-layout) | Tag content must hug the attrs `}` and the call's `)` | style |

---

### `no-set-in-derivation`

Derivations are `computed()` bodies and `.transform()` callbacks. They must be pure. Calling `.set()` inside one causes a write during a read pass.

```js
// Bad. Write inside computed().
const doubled = computed(() => {
  sideEffect.set(true); // error
  return count.get() * 2;
});

// Bad. Write inside .transform().
const rows = items.transform(list => {
  selectedId.set(null); // error
  return list.map(item => t.li(item.name));
});

// Good. Move the write into a separate effect.
effect(() => {
  sideEffect.set(doubled.get() > 10);
});
```

---

### `no-self-read-write`

Reading a signal with `.get()` subscribes to it. Writing it with `.set()` in the same run re-triggers the run, creating an infinite loop.

```js
// Bad
effect(() => {
  const val = count.get();
  count.set(val + 1); // error. Triggers the effect again.
});

// Good. Use .value to read without subscribing.
effect(() => {
  const val = count.value;
  count.set(val + 1);
});
```

---

### `no-set-on-derived-signal`

Derived signals are those produced by `computed()` or `.transform()`. They are read-only. Kensington throws at runtime if you call `.set()` on one; this catches it statically.

```js
// computed
const doubled = computed(() => count.get() * 2);
doubled.set(10); // error. Use signal() for writable state.

// transform
const rows = items.transform(v => v.map(x => x.id));
rows.set([]); // error. Write to the source signal instead.
```

---

### `no-new-signal-in-effect`

Each effect run creates a fresh signal with no cleanup path. The signal should be declared outside the effect.

```js
// Bad
effect(() => {
  const local = signal(0); // error. Orphaned on every run.
});

// Good
const local = signal(0);
effect(() => {
  local.set(local.get() + 1);
});
```

---

### `no-effect-in-computed`

Computed functions must be pure. An `effect()` call inside one runs on every re-evaluation and its handle is dropped, making cleanup impossible.

```js
// Bad
const doubled = computed(() => {
  effect(() => console.log('hi')); // error
  return count.get() * 2;
});
```

---

### `no-signal-async-write`

If a signal is read via `.get()` in an effect and then written in an async callback, the write re-triggers the effect after each async resolution.

```js
// Bad
effect(() => {
  const val = count.get(); // subscribes
  setTimeout(() => {
    count.set(val + 1); // error. Re-triggers the effect.
  }, 100);
});

// Good. Use .value to read without subscribing.
effect(() => {
  setTimeout(() => {
    count.set(count.value + 1);
  }, 100);
});
```

---

### `no-ignored-effect-return`

`effect()` returns `{ pause, resume, stop }`. Discarding the return value inside a function makes cleanup impossible, leaking the subscription across calls.

```js
// Bad
function setup() {
  effect(() => console.log(count.get())); // warn. Can't stop it.
}

// Good
function setup() {
  const fx = effect(() => console.log(count.get()));
  return () => fx.stop();
}
```

Module-level effects are intentionally long-lived and are not flagged.

---

### `prefer-value-in-async`

Once an effect's synchronous body completes, async callbacks run outside its reactive context. `.get()` registers no subscription there. `.value` makes that explicit.

```js
// Bad
effect(() => {
  fetch('/api').then(() => {
    console.log(count.get()); // warn. No subscription is registered.
  });
});

// Good
effect(() => {
  fetch('/api').then(() => {
    console.log(count.value);
  });
});
```

---

### `no-new-computed-in-effect`

Creating `computed()` inside an `effect()` creates a new orphaned derived signal on every run. The previous one silently loses its subscriber with no cleanup.

```js
// Bad
effect(() => {
  const doubled = computed(() => count.get() * 2); // error. Orphaned every run.
  console.log(doubled.get());
});

// Good
const doubled = computed(() => count.get() * 2);
effect(() => { console.log(doubled.get()); });
```

---

### `no-new-signal-in-computed`

Creating `signal()` inside `computed()` creates a new orphaned signal on every recompute.

```js
// Bad
const c = computed(() => {
  const temp = signal(0); // error. Orphaned every recompute.
  return temp.get() + base.get();
});

// Good
const temp = signal(0);
const c = computed(() => temp.get() + base.get());
```

---

### `no-unsafe-literal`

`.unsafeLiteral()` injects raw HTML with no script-tag validation. Use `.literal()` instead, which validates the string before injecting it.

```js
// Bad
t.unsafeLiteral(userContent); // error. Bypasses XSS protection.

// Good
t.literal(userContent);
```

---

### `no-new-computed-in-computed`

Creating `computed()` or `.transform()` inside a `computed()` body without a key creates a new orphaned derived signal on every recompute. Pass a stable key as the second argument to reuse the same instance across outer re-runs.

```js
// Bad. New instance on every outer re-run, inner state lost
const list = computed(() =>
  items.get().map(item => {
    const cls = computed(() => filter.get() === item.cat ? 'on' : ''); // warn
    return t.li({ dataKey: item.id, class: cls }, item.name);
  })
);

// Bad. Same problem with .transform()
const list = computed(() =>
  items.get().map(item =>
    t.li({ dataKey: item.id, class: filter.transform(f => f === item.cat ? 'on' : '') }, item.name) // warn
  )
);

// Good. Keyed computed
const list = computed(() =>
  items.get().map(item =>
    t.li({ dataKey: item.id, class: computed(() => filter.get() === item.cat ? 'on' : '', item.id) }, item.name)
  )
);

// Good. Keyed transform
const list = computed(() =>
  items.get().map(item =>
    t.li({ dataKey: item.id, class: filter.transform(f => f === item.cat ? 'on' : '', item.id) }, item.name)
  )
);

// Also good. Declare outside when fn has no per-item closure
const upper = computed(() => name.get().toUpperCase());
const outer = computed(() => upper.get() + '!');
```

---

### `no-out-of-scope-reactive-reference`

A reactive primitive (`signal()`, `computed()`, or `.transform()`) created inside a `computed()` body is owned by the surrounding computed. The owner can stop it at any time. When a re-run doesn't access the key, the instance is swept from the registry and stopped. Any reference held outside the owner's scope silently drops subscribers and produces out-of-sync state.

Two inline-consumption patterns are safe and allowed:

1. The result is consumed by an immediate method chain (`.get()`, `.transform()`, `.toString()`, etc.). The chain consumes the instance; the instance itself never escapes.
2. The result is passed directly to a tag call as content or an attribute value. The DOM binding effect created by `toElement()` is part of the owner's own render cycle, so its lifetime is tied to the DOM.

```js
// Bad. Instance escapes via module-level cache; external code can hold a dead signal
const editingSignals = new Map();
const list = computed(() =>
  items.get().map(item => {
    const editing = signal(false, item.id);
    editingSignals.set(item.id, editing); // warn
    return t.li({ dataKey: item.id, class: editing.transform(v => v ? 'on' : '') }, item.name);
  })
);

// Bad. Instance returned from map; consumers see a stale signal after a sweep
const list = computed(() =>
  items.get().map(item => computed(() => item.v * 2, item.id)) // warn
);

// Good. Consumed via method chain
const list = computed(() =>
  items.get().map(item =>
    computed(() => filter.get() === item.cat ? 'on' : '', item.id).get()
  )
);

// Good. Passed directly to a tag; DOM binding owns lifetime
const list = computed(() =>
  items.get().map(item =>
    t.li({
      dataKey: item.id,
      class: computed(() => filter.get() === item.cat ? 'on' : '', item.id),
    }, item.name)
  )
);
```

---

### `no-effect-in-effect`

Creating `effect()` inside an `effect()` body means every re-run of the outer effect adds a new inner effect without stopping the previous one. Subscriptions accumulate indefinitely. Capturing the return handle does not fix this; the previous handle would need to be explicitly stopped at the top of each run.

```js
// Bad
effect(() => {
  const items = list.get();
  effect(() => console.log(items)); // error. Previous inner effect never stopped.
});

// Good. Restructure as a single effect.
effect(() => {
  console.log(list.get());
});
```

---

### `no-async-effect`

The effect system runs callbacks synchronously and ignores the returned `Promise`. Any `.get()` calls after the first `await` run outside the reactive context and register no subscription. Errors thrown inside the async body are also silently swallowed.

```js
// Bad
effect(async () => { // error
  const data = await fetch(`/api/${id.get()}`).then(r => r.json());
  title.set(data.title); // runs outside reactive context
});

// Good. Keep reactive reads synchronous, push async work into .then().
effect(() => {
  fetch(`/api/${id.get()}`).then(r => r.json()).then(data => title.set(data.title));
});
```

---

### `no-async-computed`

The reactive system runs `computed()` callbacks synchronously. An async callback returns a `Promise` immediately, so the computed value is always a `Promise` object rather than the intended derived value.

```js
// Bad. Computed value is a Promise, not the resolved data.
const data = computed(async () => { // error
  return await fetch('/api').then(r => r.json());
});
t.p(data); // renders "[object Promise]"

// Good. Signal for the result, effect to populate it.
const data = signal(null);
effect(() => {
  fetch('/api').then(r => r.json()).then(v => data.set(v));
});
```

---

### `prefer-boolean-attribute-true`

The HTML spec lists ~30 boolean attributes (`disabled`, `checked`, `hidden`, `selected`, etc.). Kensington treats `true` as "present" and `false`/`null`/`undefined` as "absent". An empty string is a confusing way to spell the same thing.

```js
// Bad
t.input({ disabled: '' });

// Good
t.input({ disabled: true });
```

Auto-fixable. Extend the recognised set with the `extraBooleanAttrs` option.

---

### `prefer-camelcase-attrs`

Quoted kebab-case keys (`'aria-label'`, `'data-key'`) work, but the camelCase identifier form is the idiomatic Kensington style and matches what `html-to-kensington` emits.

```js
// Bad
t.div({ 'aria-label': 'foo', 'data-key': k });

// Good
t.div({ ariaLabel: 'foo', dataKey: k });
```

Auto-fixable.

---

### `prefer-style-object`

A `style` object lets TypeScript validate CSS property names and lets Kensington skip runtime string parsing. The fixer parses the CSS string and converts each declaration to a camelCase property.

```js
// Bad
t.div({ style: 'background-color: red; z-index: 2' });

// Good
t.div({ style: { backgroundColor: 'red', zIndex: '2' } });
```

Auto-fixable. The rule does **not** trigger when any property name fails to round-trip cleanly through Kensington's kebab/camelCase conversion. The two notable cases:

- CSS custom properties (`--bg-color`) would require quoted JS keys.
- Vendor prefixes (`-webkit-appearance`) lose their leading dash when Kensington serialises the object back to CSS.

Strings containing template expressions (`style: \`color: ${c}\``) are also skipped.

---

### `prefer-nested-attr-groups`

When two or more keys share the same kebab prefix (`data-*`, `aria-*`, `hx-*`, etc.), the nested form is shorter and groups related attributes visually.

```js
// Bad
t.input({ hxGet: '/x', hxTrigger: 'change', hxTarget: '#y' });

// Good
t.input({ hx: { get: '/x', trigger: 'change', target: '#y' } });
```

Auto-fixable when the group's members are contiguous in the source. Non-contiguous members and groups whose prefix is already in use by a sibling key are reported but not fixed.

---

### `prefer-array-for-multiline-content`

Mirrors what `html-to-kensington` emits: when a tag's content occupies its own line(s). Separated from both the opening and closing paren. It goes in an array, even when it's the only item. The array form makes line-by-line edits easier (no need to add `[ ]` when adding a sibling).

```js
// Bad
t.div({ class: 'x' },
  t.p('only')
);

// Good
t.div({ class: 'x' }, [
  t.p('only'),
]);

// Also good. Content trails on the closing-paren line, no array needed
t.a({
  href: 'https://example.com',
  target: '_blank',
}, 'VS Code');
```

Auto-fixable. Single-line calls (`t.div({…}, t.p('inner'))`) are left alone.

---

### `attrs-on-call-line`

The attributes object hugs the call on both ends:

- the opening `{` sits on the same line as the call's `(`, and
- the closing `}` sits on the same line as the content (or its `[`) when there is one, or on the same line as the call's `)` when there isn't.

```js
// Bad. { not on call line.
t.div(
  { class: 'x' }
);

// Bad. } not on the ) line.
t.div({
  class: 'x',
}
);

// Bad. } not on the content's line.
t.div({
  class: 'x',
},
  t.p('inner')
);

// Good
t.div({ class: 'x' });
t.div({
  class: 'x',
});
t.div({
  class: 'x',
}, [
  t.p('a'),
]);
t.div({ class: 'x' }, t.p('inner'));
```

Auto-fixable. A comment in the gap blocks the auto-fix for that side; the issue is still reported.

---

### `attrs-canonical-shape`

The attributes object is either fully inline or fully stacked with one property per line and the braces on their own lines. Mixed forms are inconsistent and harder to diff.

```js
// Bad. Open brace shares a line with the first prop.
t.div({ class: 'x',
  id: 'y',
});

// Bad. Close brace shares a line with the last prop.
t.div({
  class: 'x',
  id: 'y' });

// Bad. Two props on the same line in an otherwise multi-line object.
t.div({
  class: 'x', id: 'y',
  role: 'button',
});

// Good
t.div({ class: 'x', id: 'y' });
t.div({
  class: 'x',
  id: 'y',
});
```

Auto-fixable when the object contains no interior comments. The fixer rewrites to the stacked form using the call's leading indentation as the base.

---

### `consistent-content-layout`

The content argument (or its opening `[`) hugs the attrs object's `}` (or the call's `(` when there are no attrs), and the content's last token (or `]`) hugs the closing `)`. This is the shape `html-to-kensington` emits and what makes line-by-line diffs clean.

```js
// Bad. Content on a separate line from the attrs/call.
t.div({ class: 'x' },
  t.p('only')
);

// Bad. [ on its own line.
t.div({ class: 'x' },
  [
    t.p('a'),
  ]);

// Bad. ] not on the closing-paren line.
t.div({ class: 'x' }, [
  t.p('a'),
]
);

// Good
t.div({ class: 'x' }, t.p('only'));
t.div({ class: 'x' }, [
  t.p('a'),
]);
t.div([
  t.p('a'),
]);
```

Auto-fixable. A comment between the anchor and the content (or between the content and `)`) suppresses the auto-fix for that side.
