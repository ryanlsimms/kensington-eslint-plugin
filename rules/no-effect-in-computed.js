// Reports effect() called inside a computed() callback. Computed functions must be
// pure derivations — side effects inside them run on every re-evaluation and the
// returned effect handle is dropped, making cleanup impossible.
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow calling effect() inside a computed() body',
    },
    messages: {
      noEffectInComputed:
        'effect() called inside a computed() body. Computed functions must be pure derivations. ' +
        'Move the effect() call outside, or restructure using only signal reads.',
    },
  },

  create(context) {
    const effectNames = new Set();
    const computedNames = new Set();
    // Each entry is 'computed', 'effect', or 'other'.
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
          !effectNames.has(node.callee.name)
        ) { return; }

        for (let i = fnStack.length - 1; i >= 0; i--) {
          if (fnStack[i] === 'computed') {
            context.report({ node, messageId: 'noEffectInComputed' });
            return;
          }
          if (fnStack[i] === 'effect') { return; }
        }
      },
    };
  },
};
