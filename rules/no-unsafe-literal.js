// Reports .unsafeLiteral() calls on any object. Unlike .literal(), unsafeLiteral skips
// the script-tag check and injects raw HTML directly — a potential XSS vector.
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow .unsafeLiteral() calls that bypass XSS protection',
    },
    messages: {
      noUnsafeLiteral:
        '.unsafeLiteral() bypasses XSS protection. Use .literal() instead, which validates ' +
        'that the string does not contain script tags.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'unsafeLiteral'
        ) { return; }
        context.report({ node, messageId: 'noUnsafeLiteral' });
      },
    };
  },
};
