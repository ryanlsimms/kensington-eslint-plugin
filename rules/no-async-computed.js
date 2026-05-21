// Reports computed() calls whose callback is declared async. The reactive system runs the
// callback synchronously — an async callback returns a Promise immediately, so the computed
// value is always a Promise object rather than the intended derived value.
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow async callbacks passed to computed()',
    },
    messages: {
      noAsyncComputed:
        'computed() callback is async. The reactive system runs callbacks synchronously, so the ' +
        'computed value will be a Promise rather than the intended derived value. ' +
        'Use a signal for the result and an effect() to populate it asynchronously instead.',
    },
  },

  create(context) {
    const computedNames = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
          if (spec.imported.name === 'computed') { computedNames.add(spec.local.name); }
        }
      },

      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          !computedNames.has(node.callee.name) ||
          node.arguments.length === 0
        ) { return; }

        const cb = node.arguments[0];
        if (
          (cb.type === 'ArrowFunctionExpression' || cb.type === 'FunctionExpression') &&
          cb.async
        ) {
          context.report({ node, messageId: 'noAsyncComputed' });
        }
      },
    };
  },
};
