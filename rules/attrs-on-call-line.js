import { getTagAttrsObject, getObjectNames, objectNamesSchema } from './_utils.js';

// The attributes object hugs the call on both ends:
//   - the opening `{` sits on the same line as the call's `(`, and
//   - the closing `}` sits on the same line as the content (or its `[`) when
//     there is a content arg, or on the same line as the call's `)` when there
//     is not.

export default {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description: 'attributes object must hug the tag call on both ends',
    },
    schema: [{
      type: 'object',
      properties: { objectNames: objectNamesSchema },
      additionalProperties: false,
    }],
    messages: {
      attrsMustStartOnCallLine: 'Attributes object must start on the same line as the tag call.',
      attrsMustEndOnContentLine: 'Closing brace of attributes object must be on the same line as the content.',
      attrsMustEndOnCloseParenLine: 'Closing brace of attributes object must be on the same line as the closing parenthesis.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const objectNames = getObjectNames(context);

    return {
      CallExpression(node) {
        const attrs = getTagAttrsObject(node, objectNames);
        if (!attrs) { return; }

        // Open-brace check: `{` on the same line as `(`.
        const openParen = sourceCode.getTokenAfter(node.callee);
        if (openParen && attrs.loc.start.line > openParen.loc.end.line) {
          const between = sourceCode.text.slice(openParen.range[1], attrs.range[0]);
          const hasComment = /\/\/|\/\*/.test(between);
          context.report({
            node: attrs,
            messageId: 'attrsMustStartOnCallLine',
            fix: hasComment
              ? null
              : (fixer => fixer.replaceTextRange([openParen.range[1], attrs.range[0]], '')),
          });
        }

        // Close-brace check: `}` on the same line as the next anchor.
        if (node.arguments.length === 2) {
          const content = node.arguments[1];
          if (attrs.loc.end.line < content.loc.start.line) {
            const between = sourceCode.text.slice(attrs.range[1], content.range[0]);
            const hasComment = /\/\/|\/\*/.test(between);
            context.report({
              node: attrs,
              messageId: 'attrsMustEndOnContentLine',
              fix: hasComment
                ? null
                : (fixer => fixer.replaceTextRange([attrs.range[1], content.range[0]], ', ')),
            });
          }
        } else if (node.arguments.length === 1) {
          const closeParen = sourceCode.getLastToken(node);
          if (closeParen && closeParen.value === ')' && attrs.loc.end.line < closeParen.loc.start.line) {
            const between = sourceCode.text.slice(attrs.range[1], closeParen.range[0]);
            const hasComment = /\/\/|\/\*/.test(between);
            context.report({
              node: attrs,
              messageId: 'attrsMustEndOnCloseParenLine',
              fix: hasComment
                ? null
                : (fixer => fixer.replaceTextRange([attrs.range[1], closeParen.range[0]], '')),
            });
          }
        }
      },
    };
  },
};
