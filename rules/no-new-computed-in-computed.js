// Reports computed() called inside a computed() callback. Each recompute creates a new
// orphaned derived signal with no cleanup path — declare the computed outside.
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow creating a new computed() inside a computed() body',
    },
    messages: {
      noNewComputedInComputed:
        'computed() called inside a computed() body. Each recompute creates a new orphaned derived signal. ' +
        'Declare the computed outside instead.',
    },
  },

  create(context) {
    const computedNames = new Set();
    const effectNames = new Set();
    // Each entry is 'computed', 'effect', or 'other' — innermost frame is last.
    const fnStack = [];

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
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
          !computedNames.has(node.callee.name)
        ) { return; }

        for (let i = fnStack.length - 1; i >= 0; i--) {
          if (fnStack[i] === 'computed') {
            context.report({ node, messageId: 'noNewComputedInComputed' });
            return;
          }
          if (fnStack[i] === 'effect') { return; }
        }
      },
    };
  },
};
