// Reports unkeyed signal() calls inside a computed() callback. Kensington handles the
// unkeyed case correctly via reconciler-driven node replacement, but local signal state
// resets to the initial value on every outer re-render and DOM identity is not preserved.
// Pass a stable key as the second argument (e.g. signal(false, item.id)) to scope the
// signal to the surrounding computed so the same instance is reused across re-runs.
//
// Also reports liveSignal() calls inside a computed() body. liveSignal always has a name
// as its second argument so the key-presence check doesn't apply, but the lazy-registry
// creation on first sight still happens inside the reactive scope and trips the runtime
// warning. The fix is to eager-seed via queueMicrotask outside the reactive scope.
import { isKensingtonLiveSource } from './_utils.js';

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require a stable key for signal() and flag liveSignal() inside a computed() body',
    },
    messages: {
      noNewSignalInComputed:
        'signal() called inside a computed() body without a key. Local state resets on ' +
        'every outer re-render. Pass a stable key as the second argument ' +
        '(e.g. signal(initial, item.id)) so the same signal instance is reused across ' +
        'computed re-runs.',
      noLiveSignalInComputed:
        'liveSignal() called inside a computed() body. The first call for this name creates '
        + 'the transport entry inside the reactive scope, tripping the runtime warning. '
        + 'Eager-seed the liveSignal outside the reactive scope (queueMicrotask is the canonical '
        + 'pattern). See agent-docs/live-signals.md → "liveSignal inside a reactive callback".',
    },
  },

  create(context) {
    const signalNames = new Set();
    const liveSignalNames = new Set();
    const computedNames = new Set();
    const effectNames = new Set();
    // Each entry is 'computed', 'effect', or 'other' — innermost frame is last.
    const fnStack = [];

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'kensington') {
          for (const spec of node.specifiers) {
            if (spec.type !== 'ImportSpecifier') { continue; }
            if (spec.imported.name === 'signal') { signalNames.add(spec.local.name); }
            if (spec.imported.name === 'computed') { computedNames.add(spec.local.name); }
            if (spec.imported.name === 'effect') { effectNames.add(spec.local.name); }
          }
          return;
        }
        if (isKensingtonLiveSource(node.source.value)) {
          for (const spec of node.specifiers) {
            if (spec.type !== 'ImportSpecifier') { continue; }
            if (spec.imported.name === 'liveSignal') { liveSignalNames.add(spec.local.name); }
          }
        }
      },

      ':matches(ArrowFunctionExpression, FunctionExpression)'(node) {
        const { parent } = node;
        if (
          parent.type === 'CallExpression' &&
          parent.arguments[0] === node &&
          parent.callee.type === 'Identifier'
        ) {
          if (computedNames.has(parent.callee.name)) {
            fnStack.push('computed');
            return;
          }
          if (effectNames.has(parent.callee.name)) {
            fnStack.push('effect');
            return;
          }
        }
        fnStack.push('other');
      },

      ':matches(ArrowFunctionExpression, FunctionExpression):exit'() {
        fnStack.pop();
      },

      CallExpression(node) {
        if (node.callee.type !== 'Identifier') { return; }
        const isPlainSignal = signalNames.has(node.callee.name);
        const isLiveSignal = liveSignalNames.has(node.callee.name);
        if (!isPlainSignal && !isLiveSignal) { return; }
        // Plain signal: a second-arg key means the call is keyed correctly.
        // liveSignal: the second arg is always a name, but the lazy-registry
        // creation still happens inside the reactive scope on first sight,
        // so the trap applies regardless of args length.
        if (isPlainSignal && node.arguments.length >= 2) { return; }

        for (let i = fnStack.length - 1; i >= 0; i--) {
          if (fnStack[i] === 'computed') {
            context.report({
              node,
              messageId: isLiveSignal ? 'noLiveSignalInComputed' : 'noNewSignalInComputed',
            });
            return;
          }
          if (fnStack[i] === 'effect') { return; }
        }
      },
    };
  },
};
