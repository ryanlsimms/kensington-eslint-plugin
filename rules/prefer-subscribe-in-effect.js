// Reports trigger-only .get() calls in an effect() callback. `.subscribe()` is
// an alias for `.get()` that makes it clear the value is intentionally ignored.
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'prefer .subscribe() over trigger-only .get() calls in effect() callbacks',
    },
    messages: {
      preferSubscribeInEffect:
        'Use .subscribe() for a trigger-only read inside an effect. ' +
        'It makes clear that the signal value is intentionally ignored.',
    },
  },

  create(context) {
    const effectNames = new Set();
    // Each frame is { type: 'effect'|'other', callback? }. Nested functions are
    // excluded because their .get() calls may consume a value independently of
    // the surrounding effect's trigger-only reads.
    const fnStack = [];

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
          if (spec.imported.name === 'effect') { effectNames.add(spec.local.name); }
        }
      },

      ':matches(ArrowFunctionExpression, FunctionExpression)'(node) {
        const { parent } = node;
        if (
          parent.type === 'CallExpression' &&
          parent.arguments[0] === node &&
          parent.callee.type === 'Identifier' &&
          effectNames.has(parent.callee.name)
        ) {
          fnStack.push({ type: 'effect', callback: node });
          return;
        }

        fnStack.push({ type: 'other' });
      },

      ':matches(ArrowFunctionExpression, FunctionExpression):exit'() {
        fnStack.pop();
      },

      CallExpression(node) {
        const frame = fnStack[fnStack.length - 1];
        if (!frame || frame.type !== 'effect') { return; }
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.object.type !== 'Identifier' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'get' ||
          node.arguments.length !== 0
        ) { return; }

        const parent = node.parent;
        const isExpressionStatement = parent.type === 'ExpressionStatement';
        const isConciseEffectBody = parent === frame.callback &&
          frame.callback.type === 'ArrowFunctionExpression' &&
          frame.callback.expression;

        if (isExpressionStatement || isConciseEffectBody) {
          context.report({ node, messageId: 'preferSubscribeInEffect' });
        }
      },
    };
  },
};
