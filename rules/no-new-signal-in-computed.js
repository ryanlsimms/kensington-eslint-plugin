// Reports unkeyed signal() calls inside a computed() callback. Kensington handles the
// unkeyed case correctly via reconciler-driven node replacement, but local signal state
// resets to the initial value on every outer re-render and DOM identity is not preserved.
// Pass a stable key as the second argument (e.g. signal(false, item.id)) to scope the
// signal to the surrounding computed so the same instance is reused across re-runs.
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require a stable key for signal() calls inside a computed() body',
    },
    messages: {
      noNewSignalInComputed:
        'signal() called inside a computed() body without a key. Local state resets on ' +
        'every outer re-render. Pass a stable key as the second argument ' +
        '(e.g. signal(initial, item.id)) so the same signal instance is reused across ' +
        'computed re-runs.',
    },
  },

  create(context) {
    const signalNames = new Set();
    const computedNames = new Set();
    const effectNames = new Set();
    // Each entry is 'computed', 'effect', or 'other' — innermost frame is last.
    const fnStack = [];

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
          if (spec.imported.name === 'signal') { signalNames.add(spec.local.name); }
          if (spec.imported.name === 'computed') { computedNames.add(spec.local.name); }
          if (spec.imported.name === 'effect') { effectNames.add(spec.local.name); }
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
        if (
          node.callee.type !== 'Identifier' ||
          !signalNames.has(node.callee.name)
        ) { return; }
        // A key was supplied — this is the intended pattern, not a problem.
        if (node.arguments.length >= 2) { return; }

        for (let i = fnStack.length - 1; i >= 0; i--) {
          if (fnStack[i] === 'computed') {
            context.report({ node, messageId: 'noNewSignalInComputed' });
            return;
          }
          if (fnStack[i] === 'effect') { return; }
        }
      },
    };
  },
};
