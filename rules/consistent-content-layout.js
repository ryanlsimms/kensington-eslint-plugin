import { isTagCall, getObjectNames, objectNamesSchema } from './_utils.js';

// Tag content (or its opening `[`) must begin on the same line as the anchor
// before it — the attrs object's `}` for two-arg calls, or the call's `(` for
// one-arg calls. Content must also end on the same line as the call's `)`.

export default {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description: 'tag content must start on the call/attrs line and end on the closing-paren line',
    },
    schema: [{
      type: 'object',
      properties: { objectNames: objectNamesSchema },
      additionalProperties: false,
    }],
    messages: {
      contentMustStartOnAnchorLine: 'Tag content must start on the same line as {{anchor}}.',
      contentMustEndOnClosingParenLine: 'Tag content must end on the same line as the closing parenthesis.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const objectNames = getObjectNames(context);

    function getContentArg(node) {
      if (node.arguments.length === 1) {
        const arg = node.arguments[0];
        if (arg.type === 'ObjectExpression') { return null; }
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
        if (content.type === 'SpreadElement') { return; }

        const closeParen = sourceCode.getLastToken(node);
        if (!closeParen || closeParen.value !== ')') { return; }

        // Start check: content must begin on the anchor's line.
        if (node.arguments.length === 2) {
          const attrs = node.arguments[0];
          if (content.loc.start.line > attrs.loc.end.line) {
            const commaToken = sourceCode.getTokenAfter(attrs);
            if (commaToken && commaToken.value === ',') {
              const between = sourceCode.text.slice(commaToken.range[1], content.range[0]);
              const hasComment = /\/\/|\/\*/.test(between);
              context.report({
                node: content,
                messageId: 'contentMustStartOnAnchorLine',
                data: { anchor: "the attributes object's closing brace" },
                fix: hasComment
                  ? null
                  : (fixer => fixer.replaceTextRange([commaToken.range[1], content.range[0]], ' ')),
              });
            }
          }
        } else {
          const openParen = sourceCode.getTokenAfter(node.callee);
          if (openParen && content.loc.start.line > openParen.loc.end.line) {
            const between = sourceCode.text.slice(openParen.range[1], content.range[0]);
            const hasComment = /\/\/|\/\*/.test(between);
            context.report({
              node: content,
              messageId: 'contentMustStartOnAnchorLine',
              data: { anchor: "the tag method call's opening parenthesis" },
              fix: hasComment
                ? null
                : (fixer => fixer.replaceTextRange([openParen.range[1], content.range[0]], '')),
            });
          }
        }

        // End check: content must end on the closing paren's line. If there's a
        // trailing comma right after content, treat that as part of the end.
        const tokenAfterContent = sourceCode.getTokenAfter(content);
        const endBoundary = tokenAfterContent && tokenAfterContent.value === ',' && tokenAfterContent.range[0] < closeParen.range[0]
          ? tokenAfterContent
          : content;
        const endBoundaryLine = endBoundary === content ? content.loc.end.line : endBoundary.loc.end.line;

        if (endBoundaryLine < closeParen.loc.start.line) {
          const between = sourceCode.text.slice(endBoundary.range[1], closeParen.range[0]);
          const hasComment = /\/\/|\/\*/.test(between);
          context.report({
            node: content,
            messageId: 'contentMustEndOnClosingParenLine',
            fix: hasComment
              ? null
              : (fixer => fixer.replaceTextRange([endBoundary.range[1], closeParen.range[0]], '')),
          });
        }
      },
    };
  },
};
