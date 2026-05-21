# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-05-21

### Added

- `no-set-in-transform` — disallow `.set()` inside a `.transform()` callback (transform callbacks are pure derivations; a write during a read pass corrupts the dependency graph)
- `no-set-on-transform` — disallow `.set()` on a transform-derived signal (transform results are read-only; kensington throws at runtime)

### Fixed

- Added renamed-import test coverage to all rules that use import tracking, verifying that aliased imports (e.g. `import { effect as fx }`) are correctly recognised

## [0.1.1] - 2026-05-21

### Added

- `no-async-computed` — disallow async callbacks passed to `computed()` (the computed value would always be a `Promise` rather than the derived value)
- `no-async-effect` — disallow async callbacks passed to `effect()` (reactive reads after the first `await` run outside the reactive context and errors are silently swallowed)
- `no-effect-in-computed` — disallow calling `effect()` inside a `computed()` body (breaks purity; the effect handle is dropped on every recompute)
- `no-effect-in-effect` — disallow creating a new `effect()` inside an `effect()` body (each outer re-run adds a new inner effect without stopping the previous one, leaking subscriptions indefinitely)
- `no-ignored-effect-return` — require capturing the return value of `effect()` inside a function (discarding it makes calling `stop()` impossible, leaking the subscription)
- `no-new-computed-in-computed` — disallow creating a new `computed()` inside a `computed()` body (orphaned derived signal on every recompute)
- `no-new-computed-in-effect` — disallow creating a new `computed()` inside an `effect()` body (orphaned derived signal on every effect run)
- `no-new-signal-in-computed` — disallow creating a new `signal()` inside a `computed()` body (orphaned signal on every recompute)
- `no-new-signal-in-effect` — disallow creating a new `signal()` inside an `effect()` body (orphaned signal on every effect run with no cleanup path)
- `no-self-read-write` — disallow reading and writing the same signal in the same reactive run (`.get()` subscribes; `.set()` in the same run re-triggers, creating an infinite loop)
- `no-set-in-computed` — disallow `.set()` inside a `computed()` body (causes a write during a read pass)
- `no-set-on-computed` — disallow `.set()` on a computed signal (computed signals are read-only; kensington throws at runtime)
- `no-signal-async-write` — disallow writing a signal inside an async callback when it was read via `.get()` in the enclosing `effect()` (re-triggers the effect after each async resolution)
- `no-unsafe-literal` — disallow `.unsafeLiteral()` calls that bypass XSS protection (use `.literal()` instead)
- `prefer-value-in-async` — prefer `.value` over `.get()` inside async callbacks within an `effect()` (async callbacks run outside the reactive context, so `.get()` registers no subscription)
- Recommended config (`kensington/recommended`) with all rules pre-configured at appropriate severities (`error` for clear bugs, `warn` for correctness issues with rare valid exceptions)
- Import-tracking in every rule to avoid false positives on same-named functions from libraries other than kensington
