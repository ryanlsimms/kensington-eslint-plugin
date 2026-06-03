import { getTagAttrsObject, kebabToCamel, isValidIdentifier, getObjectNames, objectNamesSchema } from './_utils.js';

export default {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'prefer camelCase identifier keys over quoted kebab-case in tag attributes',
    },
    schema: [{
      type: 'object',
      properties: { objectNames: objectNamesSchema },
      additionalProperties: false,
    }],
    messages: {
      preferCamelCase: 'Attribute key `{{kebab}}` should be the camelCase identifier `{{camel}}`.',
    },
  },

  create(context) {
    const objectNames = getObjectNames(context);
    return {
      CallExpression(node) {
        const attrs = getTagAttrsObject(node, objectNames);
        if (!attrs) { return; }

        for (const prop of attrs.properties) {
          if (prop.type !== 'Property') { continue; }
          if (prop.computed) { continue; }
          if (prop.shorthand) { continue; }
          if (prop.key.type !== 'Literal') { continue; }
          if (typeof prop.key.value !== 'string') { continue; }

          const kebab = prop.key.value;
          if (!kebab.includes('-')) { continue; }

          const camel = kebabToCamel(kebab);
          if (!isValidIdentifier(camel)) { continue; }

          context.report({
            node: prop.key,
            messageId: 'preferCamelCase',
            data: { kebab, camel },
            fix: fixer => fixer.replaceText(prop.key, camel),
          });
        }
      },
    };
  },
};
