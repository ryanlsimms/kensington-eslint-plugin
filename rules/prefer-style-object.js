import { getTagAttrsObject, getPropertyKey, parseStyleString, kebabToCamel, camelToKebab, isValidIdentifier, getObjectNames, objectNamesSchema } from './_utils.js';

export default {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description: 'prefer an object value for the `style` attribute over a CSS string',
    },
    schema: [{
      type: 'object',
      properties: { objectNames: objectNamesSchema },
      additionalProperties: false,
    }],
    messages: {
      preferObject: '`style` should be an object with camelCase properties, not a CSS string.',
    },
  },

  create(context) {
    const objectNames = getObjectNames(context);
    return {
      CallExpression(node) {
        const attrs = getTagAttrsObject(node, objectNames);
        if (!attrs) { return; }

        for (const prop of attrs.properties) {
          if (getPropertyKey(prop) !== 'style') { continue; }
          if (prop.value.type !== 'Literal') { continue; }
          if (typeof prop.value.value !== 'string') { continue; }

          const entries = parseStyleString(prop.value.value);
          if (!entries) { continue; }

          // Skip any property whose name can't be losslessly expressed as a
          // camelCase JS identifier — CSS custom properties (--foo) need quoted
          // keys and vendor-prefixed names (-webkit-appearance) lose their
          // leading dash through Kensington's camelToKebab round-trip.
          const cleanRoundTrip = entries.every(({ property }) => {
            const camel = kebabToCamel(property);
            return isValidIdentifier(camel) && camelToKebab(camel) === property;
          });
          if (!cleanRoundTrip) { continue; }

          context.report({
            node: prop.value,
            messageId: 'preferObject',
            fix(fixer) {
              const pairs = entries.map(({ property, value }) => {
                const camel = kebabToCamel(property);
                return `${camel}: ${JSON.stringify(value)}`;
              });
              return fixer.replaceText(prop.value, `{ ${pairs.join(', ')} }`);
            },
          });
        }
      },
    };
  },
};
