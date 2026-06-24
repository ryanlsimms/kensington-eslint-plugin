// Ambient declaration for the cross-file analyzer test fixtures.
// The fixtures import from 'kensington' so the analyzer recognizes the
// imports, but this directory is not part of any real TypeScript project.
// This shim quiets IDE "Cannot find module 'kensington'" warnings without
// pulling in the real package.

declare module 'kensington' {
  // For test-fixture use only. Models the minimal kensington API surface
  // touched by the fixtures. Intentionally permissive (mapWithKey's callback
  // arg is typed `any`) so the IDE doesn't complain when callers pass a
  // narrower function. The analyzer itself does not consult these types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface Signal<T> {
    get(): T;
    set(v: T | ((curr: T) => T)): void;
    readonly value: T;
    transform<U>(fn: (v: T) => U, key?: string): Signal<U>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapWithKey<U>(keyOrProp: string | ((item: any) => string), mapFn: (item: any) => U): Signal<U[]>;
  }

  export function signal<T>(initial: T, key?: string): Signal<T>;
  export function computed<T>(fn: () => T, key?: string): Signal<T>;
}
