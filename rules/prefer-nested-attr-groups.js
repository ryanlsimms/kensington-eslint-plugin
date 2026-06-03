import { getTagAttrsObject, getPropertyKey, normalizeAttrName, kebabToCamel, isValidIdentifier, getObjectNames, getNamespaces, objectNamesSchema, namespacesSchema } from './_utils.js';

// When two or more attribute keys share the same namespace prefix (data-*,
// aria-*, hx-*, etc.), prefer the nested object form. The default namespace
// list is ['data', 'aria']; override via the `namespaces` option or
// plugin-level `settings.kensington.namespaces`. The rule does NOT fire for
// multi-word HTML/SVG attribute names that happen to share a word (e.g.
// strokeWidth + strokeLinecap are separate attributes, not a "stroke
// namespace").

export default {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'prefer nested object form for attributes sharing a namespace prefix',
    },
    schema: [{
      type: 'object',
      properties: {
        objectNames: objectNamesSchema,
        namespaces: namespacesSchema,
      },
      additionalProperties: false,
    }],
    messages: {
      preferNested: 'Attributes sharing the `{{prefix}}-` namespace should be nested under a single `{{prefix}}` key.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const objectNames = getObjectNames(context);
    const namespaces = new Set(getNamespaces(context));

    return {
      CallExpression(node) {
        const attrs = getTagAttrsObject(node, objectNames);
        if (!attrs) { return; }

        const groups = new Map();

        for (const prop of attrs.properties) {
          const key = getPropertyKey(prop);
          if (!key) { continue; }
          const kebab = normalizeAttrName(key);
          const hy = kebab.indexOf('-');
          if (hy === -1) { continue; }
          const prefix = kebab.slice(0, hy);
          if (!isValidIdentifier(prefix)) { continue; }
          if (!namespaces.has(prefix)) { continue; }
          if (!groups.has(prefix)) { groups.set(prefix, []); }
          groups.get(prefix).push({ prop, remainder: kebab.slice(hy + 1) });
        }

        for (const [prefix, members] of groups) {
          if (members.length < 2) { continue; }

          // If a sibling already uses the bare `prefix` key, skip auto-fix to
          // avoid producing duplicate keys.
          const existingBare = attrs.properties.find(p => getPropertyKey(p) === prefix);

          const memberSet = new Set(members.map(m => m.prop));
          const indexes = members.map(m => attrs.properties.indexOf(m.prop)).sort((a, b) => a - b);
          const contiguous = indexes.every((idx, i) => i === 0 || idx === indexes[i - 1] + 1);

          const innerPairs = members
            .slice()
            .sort((a, b) => a.prop.range[0] - b.prop.range[0])
            .map(m => {
              const innerKey = kebabToCamel(m.remainder);
              const keyText = isValidIdentifier(innerKey) ? innerKey : JSON.stringify(m.remainder);
              const valueText = sourceCode.getText(m.prop.value);
              return `${keyText}: ${valueText}`;
            });
          const nested = `${prefix}: { ${innerPairs.join(', ')} }`;

          const canFix = !existingBare && contiguous;

          context.report({
            node: members[0].prop,
            messageId: 'preferNested',
            data: { prefix },
            fix: canFix ? (fixer => {
              const sorted = [...memberSet].sort((a, b) => a.range[0] - b.range[0]);
              const first = sorted[0];
              const last = sorted[sorted.length - 1];
              return fixer.replaceTextRange([first.range[0], last.range[1]], nested);
            }) : null,
          });
        }
      },
    };
  },
};
