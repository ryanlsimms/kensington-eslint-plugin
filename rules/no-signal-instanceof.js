const KENSINGTON_MODULES = new Set(['kensington', 'kensington/reactive']);

function isKensingtonImport(context, identifier, kind) {
  let scope = context.sourceCode.getScope(identifier);
  while (scope) {
    const variable = scope.set.get(identifier.name);
    if (variable) {
      return variable.defs.some(def => {
        if (def.type !== 'ImportBinding' || def.parent?.type !== 'ImportDeclaration') { return false; }
        const declaration = def.parent;
        if (!KENSINGTON_MODULES.has(declaration.source.value)
          || declaration.importKind === 'type'
          || def.node.importKind === 'type') { return false; }
        if (kind === 'named') {
          return def.node.type === 'ImportSpecifier' && def.node.imported.name === 'Signal';
        }
        return def.node.type === 'ImportNamespaceSpecifier';
      });
    }
    scope = scope.upper;
  }
  return false;
}

function memberName(node) {
  if (!node.computed && node.property.type === 'Identifier') { return node.property.name; }
  if (node.computed && node.property.type === 'Literal') { return node.property.value; }
  return null;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow instanceof checks against Kensington Signal constructors',
    },
    messages: {
      noSignalInstanceof:
        'Avoid `instanceof Signal`: separate Kensington entry points can have different constructors. '
        + 'Use isKensingtonSignal(value) to recognize signals across package copies.',
    },
    schema: [],
  },

  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator !== 'instanceof') { return; }

        if (node.right.type === 'Identifier' && isKensingtonImport(context, node.right, 'named')) {
          context.report({ node: node.right, messageId: 'noSignalInstanceof' });
          return;
        }

        if (
          node.right.type === 'MemberExpression'
          && memberName(node.right) === 'Signal'
          && node.right.object.type === 'Identifier'
          && isKensingtonImport(context, node.right.object, 'namespace')
        ) {
          context.report({ node: node.right, messageId: 'noSignalInstanceof' });
        }
      },
    };
  },
};
