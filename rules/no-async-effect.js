// Reports standalone effect() and tag.effect() calls whose callback is declared async. The effect system runs the
// callback synchronously and ignores the returned Promise — any .get() calls after the
// first await run outside the reactive context and register no subscription. Errors thrown
// inside the async body become Promise rejections outside effect error handling.
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow async callbacks passed to effect() or tag.effect()',
    },
    messages: {
      noAsyncEffect:
        'effect() callback is async. The effect system runs callbacks synchronously and ignores ' +
        'the returned Promise. Any signal reads after the first await register no subscription, ' +
        'and Promise rejections are not handled by the effect system. ' +
        'Move async work into a .then() chain inside a synchronous callback instead.',
    },
  },

  create(context) {
    const effectNames = new Set();

    return {
      ImportDeclaration(node) {
        if (!['kensington', 'kensington/reactive'].includes(node.source.value)) { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
          if (spec.imported.name === 'effect') { effectNames.add(spec.local.name); }
        }
      },

      CallExpression(node) {
        const callee = node.callee;
        const standalone = callee.type === 'Identifier' && effectNames.has(callee.name);
        // Like no-async-set, member matching is syntactic: tag variables may be
        // returned by helpers or passed as parameters, without a local t.* initializer.
        const member = callee.type === 'MemberExpression' && (
          !callee.computed && callee.property.type === 'Identifier' && callee.property.name === 'effect'
          || callee.computed && callee.property.type === 'Literal' && callee.property.value === 'effect'
        );
        if ((!standalone && !member) || node.arguments.length === 0) { return; }

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
