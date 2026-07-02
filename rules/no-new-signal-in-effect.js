// Reports signal() or liveSignal() called inside an effect() callback. Each
// effect run creates a new orphaned signal (or a new transport entry, for
// liveSignal) with no cleanup path, which is almost always a bug. The
// primitive should be declared outside the effect.
import { isKensingtonLiveSource } from './_utils.js';

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow creating a new signal() or liveSignal() inside an effect() body',
    },
    messages: {
      noNewSignalInEffect:
        'signal() called inside an effect() body. Each effect run creates a new orphaned signal. ' +
        'Declare the signal outside the effect instead.',
      noNewLiveSignalInEffect:
        'liveSignal() called inside an effect() body. Each effect run looks up (and on first '
        + 'sight, creates) the transport entry inside the effect\'s reactive scope. Declare the '
        + 'liveSignal outside the effect, or eager-seed it via queueMicrotask outside the '
        + 'reactive scope. See agent-docs/live-signals.md → "liveSignal inside a reactive callback".',
    },
  },

  create(context) {
    const effectNames = new Set();
    const signalNames = new Set();
    const liveSignalNames = new Set();
    const computedNames = new Set();
    // Each entry is 'effect', 'computed', or 'other'.
    const fnStack = [];

    return {
      ImportDeclaration(node) {
        if (node.source.value === 'kensington') {
          for (const spec of node.specifiers) {
            if (spec.type !== 'ImportSpecifier') { continue; }
            if (spec.imported.name === 'effect') { effectNames.add(spec.local.name); }
            if (spec.imported.name === 'signal') { signalNames.add(spec.local.name); }
            if (spec.imported.name === 'computed') { computedNames.add(spec.local.name); }
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
          if (effectNames.has(parent.callee.name)) {
            fnStack.push('effect');
            return;
          }
          if (computedNames.has(parent.callee.name)) {
            fnStack.push('computed');
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

        for (let i = fnStack.length - 1; i >= 0; i--) {
          if (fnStack[i] === 'effect') {
            context.report({
              node,
              messageId: isLiveSignal ? 'noNewLiveSignalInEffect' : 'noNewSignalInEffect',
            });
            return;
          }
          if (fnStack[i] === 'computed') { return; }
        }
      },
    };
  },
};
