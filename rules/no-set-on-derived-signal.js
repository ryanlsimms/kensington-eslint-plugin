// Reports .set() on a variable that holds a derived signal — one produced by
// computed() (imported from kensington) or by .transform() on any signal.
// Derived signals are read-only; kensington throws at runtime, but this catches
// it statically.
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow .set() on a derived (computed or transform) signal',
    },
    messages: {
      noSetOnDerived:
        "'{{name}}' is a {{kind}} signal and cannot be written with .set(). " +
        'Use signal() for writable state.',
    },
  },

  create(context) {
    const computedNames = new Set();
    // name -> 'computed' | 'transform'
    const derivedBindings = new Map();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
          if (spec.imported.name === 'computed') { computedNames.add(spec.local.name); }
        }
      },

      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || !node.init) { return; }
        const init = node.init;
        if (init.type !== 'CallExpression') { return; }

        if (init.callee.type === 'Identifier' && computedNames.has(init.callee.name)) {
          derivedBindings.set(node.id.name, 'computed');
          return;
        }
        if (
          init.callee.type === 'MemberExpression' &&
          init.callee.property.type === 'Identifier' &&
          init.callee.property.name === 'transform'
        ) {
          derivedBindings.set(node.id.name, 'transform');
        }
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
        const kind = derivedBindings.get(name);
        if (kind) {
          const label = kind === 'computed' ? 'computed' : 'transform-derived';
          context.report({ node, messageId: 'noSetOnDerived', data: { name, kind: label } });
        }
      },
    };
  },
};
