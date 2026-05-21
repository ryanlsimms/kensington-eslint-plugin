# kensington-eslint-plugin

ESLint rules for [kensington](https://github.com/beezwax/kensington) signal correctness.

Catches common reactive programming mistakes — read/write loops, writes inside computed derivations, orphaned effects, and async subscription pitfalls — at lint time rather than at runtime.

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
      'kensington/no-set-in-computed': 'error',
      'kensington/no-self-read-write': 'error',
      // ...
    },
  },
];
```

## Editor and tooling support

Because this is a standard ESLint plugin, it works anywhere ESLint runs — no extra configuration needed:

- **Editors** — VS Code, JetBrains IDEs (RubyMine, WebStorm, etc.), Neovim, and any editor with an ESLint language server show inline errors automatically once the plugin is configured.
- **CI** — run `eslint --max-warnings 0` in any pipeline to enforce rules on every push.
- **Pre-commit hooks** — works with `lint-staged` or any hook runner that invokes ESLint.
- **Programmatic use** — available via the ESLint Node.js API (`new ESLint()`) for custom tooling.

## Rules

| Rule | Description | Recommended |
|------|-------------|-------------|
| [`no-set-in-computed`](#no-set-in-computed) | Disallow `.set()` inside a `computed()` body | error |
| [`no-self-read-write`](#no-self-read-write) | Disallow reading and writing the same signal in the same reactive run | error |
| [`no-set-on-computed`](#no-set-on-computed) | Disallow `.set()` on a computed signal | error |
| [`no-new-signal-in-effect`](#no-new-signal-in-effect) | Disallow creating a new `signal()` inside an `effect()` body | error |
| [`no-effect-in-computed`](#no-effect-in-computed) | Disallow calling `effect()` inside a `computed()` body | error |
| [`no-signal-async-write`](#no-signal-async-write) | Disallow writing a signal in an async callback when it was read in the enclosing `effect()` | warn |
| [`no-ignored-effect-return`](#no-ignored-effect-return) | Require capturing the return value of `effect()` inside a function | warn |
| [`prefer-value-in-async`](#prefer-value-in-async) | Prefer `.value` over `.get()` inside async callbacks within an `effect()` | warn |
| [`no-new-computed-in-effect`](#no-new-computed-in-effect) | Disallow creating a new `computed()` inside an `effect()` body | error |
| [`no-new-signal-in-computed`](#no-new-signal-in-computed) | Disallow creating a new `signal()` inside a `computed()` body | error |
| [`no-unsafe-literal`](#no-unsafe-literal) | Disallow `.unsafeLiteral()` calls that bypass XSS protection | error |
| [`no-new-computed-in-computed`](#no-new-computed-in-computed) | Disallow creating a new `computed()` inside a `computed()` body | error |
| [`no-effect-in-effect`](#no-effect-in-effect) | Disallow creating a new `effect()` inside an `effect()` body | error |
| [`no-async-effect`](#no-async-effect) | Disallow async callbacks passed to `effect()` | error |
| [`no-async-computed`](#no-async-computed) | Disallow async callbacks passed to `computed()` | error |

---

### `no-set-in-computed`

Computed functions must be pure derivations. Calling `.set()` inside one causes a write during a read pass.

```js
// Bad
const doubled = computed(() => {
  sideEffect.set(true); // error
  return count.get() * 2;
});

// Good — move the write into an effect
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
  count.set(val + 1); // error — triggers the effect again
});

// Good — use .value to read without subscribing
effect(() => {
  const val = count.value;
  count.set(val + 1);
});
```

---

### `no-set-on-computed`

Computed signals are read-only. Kensington throws at runtime if you call `.set()` on one; this catches it statically.

```js
const doubled = computed(() => count.get() * 2);
doubled.set(10); // error — use signal() for writable state
```

---

### `no-new-signal-in-effect`

Each effect run creates a fresh signal with no cleanup path. The signal should be declared outside the effect.

```js
// Bad
effect(() => {
  const local = signal(0); // error — orphaned on every run
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
    count.set(val + 1); // error — re-triggers the effect
  }, 100);
});

// Good — use .value to read without subscribing
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
  effect(() => console.log(count.get())); // warn — can't stop it
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

Once an effect's synchronous body completes, async callbacks run outside its reactive context. `.get()` registers no subscription there — `.value` makes that explicit.

```js
// Bad
effect(() => {
  fetch('/api').then(() => {
    console.log(count.get()); // warn — no subscription is registered
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
  const doubled = computed(() => count.get() * 2); // error — orphaned every run
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
  const temp = signal(0); // error — orphaned every recompute
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
t.unsafeLiteral(userContent); // error — bypasses XSS protection

// Good
t.literal(userContent);
```

---

### `no-new-computed-in-computed`

Creating `computed()` inside a `computed()` body creates a new orphaned derived signal on every recompute.

```js
// Bad
const outer = computed(() => {
  const inner = computed(() => count.get() * 2); // error — orphaned every recompute
  return inner.get() + 1;
});

// Good
const inner = computed(() => count.get() * 2);
const outer = computed(() => inner.get() + 1);
```

---

### `no-effect-in-effect`

Creating `effect()` inside an `effect()` body means every re-run of the outer effect adds a new inner effect without stopping the previous one — subscriptions accumulate indefinitely. Capturing the return handle does not fix this; the previous handle would need to be explicitly stopped at the top of each run.

```js
// Bad
effect(() => {
  const items = list.get();
  effect(() => console.log(items)); // error — previous inner effect never stopped
});

// Good — restructure as a single effect
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

// Good — keep reactive reads synchronous, push async work into .then()
effect(() => {
  fetch(`/api/${id.get()}`).then(r => r.json()).then(data => title.set(data.title));
});
```

---

### `no-async-computed`

The reactive system runs `computed()` callbacks synchronously. An async callback returns a `Promise` immediately, so the computed value is always a `Promise` object rather than the intended derived value.

```js
// Bad — computed value is a Promise, not the resolved data
const data = computed(async () => { // error
  return await fetch('/api').then(r => r.json());
});
t.p(data); // renders "[object Promise]"

// Good — signal for the result, effect to populate it
const data = signal(null);
effect(() => {
  fetch('/api').then(r => r.json()).then(v => data.set(v));
});
```
