// Tag content on a separate line from the call's opening paren must be wrapped
// in an array, even when it's the only item. Mirrors what html-to-kensington
// emits when a tag's content can't fit on a single line.

import { isTagCall, getObjectNames, objectNamesSchema } from './_utils.js';

export default {
  meta: {
    type: 'layout',
    fixable: 'code',
    docs: {
      description: 'require array brackets around tag content that spans multiple lines',
    },
    schema: [{
      type: 'object',
      properties: { objectNames: objectNamesSchema },
      additionalProperties: false,
    }],
    messages: {
      wrapInArray: 'Tag content on a separate line must be wrapped in an array.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const objectNames = getObjectNames(context);

    function getContentArg(node) {
      if (node.arguments.length === 1) {
        const arg = node.arguments[0];
        if (arg.type === 'ObjectExpression') { return null; } // attrs only
        return arg;
      }
      if (node.arguments.length === 2) {
        if (node.arguments[0].type !== 'ObjectExpression') { return null; }
        return node.arguments[1];
      }
      return null;
    }

    return {
      CallExpression(node) {
        if (!isTagCall(node, objectNames)) { return; }

        const content = getContentArg(node);
        if (!content) { return; }
        if (content.type === 'ArrayExpression') { return; }
        if (content.type === 'SpreadElement') { return; }

        // The "opening line" is where the open paren sits — same line as the
        // callee's last token. Content on that line stays bare.
        const openParenLine = node.callee.loc.end.line;
        if (content.loc.start.line <= openParenLine) { return; }

        context.report({
          node: content,
          messageId: 'wrapInArray',
          *fix(fixer) {
            const closeParen = sourceCode.getLastToken(node);
            const tokenAfterContent = sourceCode.getTokenAfter(content);
            const hasTrailingComma = tokenAfterContent
              && tokenAfterContent.value === ','
              && tokenAfterContent.range[0] < closeParen.range[0];

            if (node.arguments.length === 2) {
              const commaToken = sourceCode.getTokenAfter(node.arguments[0]);
              yield fixer.insertTextAfter(commaToken, ' [');
            } else {
              const openParen = sourceCode.getTokenAfter(node.callee);
              yield fixer.insertTextAfter(openParen, '[');
            }

            if (!hasTrailingComma) {
              yield fixer.insertTextAfter(content, ',');
            }

            yield fixer.insertTextBefore(closeParen, ']');
          },
        });
      },
    };
  },
};
