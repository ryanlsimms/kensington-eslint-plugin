// Reports effect() calls whose return value is discarded inside a function body.
// The return value is { pause, resume, stop } — dropping it makes cleanup impossible,
// causing subscription leaks when the surrounding function runs more than once.
// Module-level effects are intentionally long-lived and are not flagged.

function isInsideFunction(node) {
  let current = node.parent;
  while (current) {
    if (
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression' ||
      current.type === 'ArrowFunctionExpression'
    ) { return true; }
    current = current.parent;
  }
  return false;
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require capturing the return value of effect() when called inside a function',
    },
    messages: {
      noIgnoredEffectReturn:
        'The return value of effect() is discarded. Inside a function, capture it so you can call ' +
        '.stop() for cleanup — otherwise each call creates a new subscription that can never be removed.',
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
          !effectNames.has(node.callee.name)
        ) { return; }

        // Return value is used unless the call is a bare ExpressionStatement.
        if (node.parent.type !== 'ExpressionStatement') { return; }

        // Only flag inside a function body — module-level effects are intentional.
        if (!isInsideFunction(node)) { return; }

        context.report({ node, messageId: 'noIgnoredEffectReturn' });
      },
    };
  },
};
