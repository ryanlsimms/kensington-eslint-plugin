// Reports .set() on a variable that was directly assigned from computed() imported from kensington.
// Computed signals are read-only — kensington throws at runtime, but this catches it statically.
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow .set() on a computed signal',
    },
    messages: {
      noSetOnComputed:
        "'{{name}}' is a computed signal and cannot be written with .set(). " +
        'Use signal() for writable state.',
    },
  },

  create(context) {
    const computedNames = new Set();
    const computedBindings = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
          if (spec.imported.name === 'computed') { computedNames.add(spec.local.name); }
        }
      },

      VariableDeclarator(node) {
        if (
          node.id.type !== 'Identifier' ||
          !node.init ||
          node.init.type !== 'CallExpression' ||
          node.init.callee.type !== 'Identifier' ||
          !computedNames.has(node.init.callee.name)
        ) { return; }
        computedBindings.add(node.id.name);
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
        if (computedBindings.has(name)) {
          context.report({ node, messageId: 'noSetOnComputed', data: { name } });
        }
      },
    };
  },
};
