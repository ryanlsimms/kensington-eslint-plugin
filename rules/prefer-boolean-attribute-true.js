import { HTML_BOOLEAN_ATTRS, getTagAttrsObject, getPropertyKey, normalizeAttrName, getObjectNames, objectNamesSchema } from './_utils.js';

export default {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'prefer `true` over an empty string for boolean HTML attributes',
    },
    schema: [{
      type: 'object',
      properties: {
        extraBooleanAttrs: { type: 'array', items: { type: 'string' } },
        objectNames: objectNamesSchema,
      },
      additionalProperties: false,
    }],
    messages: {
      preferTrue: 'Boolean attribute `{{name}}` should be `true`, not an empty string.',
    },
  },

  create(context) {
    const opts = context.options[0] ?? {};
    const extras = new Set((opts.extraBooleanAttrs ?? []).map(s => s.toLowerCase()));
    const booleanAttrs = new Set([...HTML_BOOLEAN_ATTRS, ...extras]);
    const objectNames = getObjectNames(context);

    return {
      CallExpression(node) {
        const attrs = getTagAttrsObject(node, objectNames);
        if (!attrs) { return; }

        for (const prop of attrs.properties) {
          const key = getPropertyKey(prop);
          if (!key) { continue; }
          const kebab = normalizeAttrName(key).toLowerCase();
          if (!booleanAttrs.has(kebab)) { continue; }
          if (prop.value.type !== 'Literal') { continue; }
          if (prop.value.value !== '') { continue; }
          context.report({
            node: prop.value,
            messageId: 'preferTrue',
            data: { name: key },
            fix: fixer => fixer.replaceText(prop.value, 'true'),
          });
        }
      },
    };
  },
};
