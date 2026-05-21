// Reports effect() calls whose callback is declared async. The effect system runs the
// callback synchronously and ignores the returned Promise — any .get() calls after the
// first await run outside the reactive context and register no subscription. Errors thrown
// inside the async body are also silently swallowed.
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow async callbacks passed to effect()',
    },
    messages: {
      noAsyncEffect:
        'effect() callback is async. The effect system runs callbacks synchronously and ignores ' +
        'the returned Promise. Any signal reads after the first await register no subscription, ' +
        'and errors thrown inside the async body are silently swallowed. ' +
        'Move async work into a .then() chain inside a synchronous callback instead.',
    },
  },

  create(context) {
    const effectNames = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
          if (spec.imported.name === 'effect') { effectNames.add(spec.local.name); }
        }
      },

      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          !effectNames.has(node.callee.name) ||
          node.arguments.length === 0
        ) { return; }

        const cb = node.arguments[0];
        if (
          (cb.type === 'ArrowFunctionExpression' || cb.type === 'FunctionExpression') &&
          cb.async
        ) {
          context.report({ node, messageId: 'noAsyncEffect' });
        }
      },
    };
  },
};
