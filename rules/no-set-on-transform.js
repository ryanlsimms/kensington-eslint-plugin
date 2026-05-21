// Reports .set() on a variable directly assigned from a .transform() call.
// Transform-derived signals are read-only; kensington throws at runtime, but this catches it statically.
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow .set() on a transform-derived signal',
    },
    messages: {
      noSetOnTransform:
        "'{{name}}' is a transform-derived signal and cannot be written with .set(). " +
        'Use signal() for writable state.',
    },
  },

  create(context) {
    const transformBindings = new Set();

    return {
      VariableDeclarator(node) {
        if (
          node.id.type !== 'Identifier' ||
          !node.init ||
          node.init.type !== 'CallExpression' ||
          node.init.callee.type !== 'MemberExpression' ||
          node.init.callee.property.type !== 'Identifier' ||
          node.init.callee.property.name !== 'transform'
        ) { return; }
        transformBindings.add(node.id.name);
      },

      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.object.type !== 'Identifier' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'set' ||
          node.arguments.length !== 1
        ) { return; }

        const name = node.callee.object.name;
        if (transformBindings.has(name)) {
          context.report({ node, messageId: 'noSetOnTransform', data: { name } });
        }
      },
    };
  },
};
