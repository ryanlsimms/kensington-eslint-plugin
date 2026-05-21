// Reports .set() calls inside a computed() callback imported from kensington.
// Stops searching when a nested effect() or computed() is reached (separate reactive context).
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow .set() inside a computed() body',
    },
    messages: {
      noSetInComputed:
        '.set() called inside a computed() body. Computed functions must be pure derivations. ' +
        'Move the write into a separate effect() instead.',
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
          node.callee.type !== 'MemberExpression' ||
          node.callee.object.type !== 'Identifier' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'set' ||
          node.arguments.length !== 1
        ) { return; }

        for (let i = fnStack.length - 1; i >= 0; i--) {
          if (fnStack[i] === 'computed') {
            context.report({ node, messageId: 'noSetInComputed' });
            return;
          }
          if (fnStack[i] === 'effect') { return; }
        }
      },
    };
  },
};
