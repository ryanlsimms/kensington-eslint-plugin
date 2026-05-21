// Reports computed() called inside an effect() callback. Each effect run creates a new
// orphaned derived signal with no cleanup path — declare the computed outside the effect.
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow creating a new computed() inside an effect() body',
    },
    messages: {
      noNewComputedInEffect:
        'computed() called inside an effect() body. Each effect run creates a new orphaned derived signal. ' +
        'Declare the computed outside the effect instead.',
    },
  },

  create(context) {
    const effectNames = new Set();
    const computedNames = new Set();
    // Each entry is 'effect', 'computed', or 'other' — innermost frame is last.
    const fnStack = [];

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
          if (spec.imported.name === 'effect') { effectNames.add(spec.local.name); }
          if (spec.imported.name === 'computed') { computedNames.add(spec.local.name); }
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
        if (
          node.callee.type !== 'Identifier' ||
          !computedNames.has(node.callee.name)
        ) { return; }

        for (let i = fnStack.length - 1; i >= 0; i--) {
          if (fnStack[i] === 'effect') {
            context.report({ node, messageId: 'noNewComputedInEffect' });
            return;
          }
          if (fnStack[i] === 'computed') { return; }
        }
      },
    };
  },
};
