import { getTagAttrsObject, getObjectNames, objectNamesSchema } from './_utils.js';

// An attributes object must be in one of two canonical forms:
//   inline:   { a: 1, b: 2 }            — every token on the same line.
//   stacked:  {                         — `{` ends its line,
//               a: 1,                     each property on its own line,
//               b: 2,                     `}` begins its line.
//             }
// Any mixed form (open brace adjacent to first prop in a multi-line body, close
// brace adjacent to last prop, or two props sharing a line) is reported.

export default {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description: 'attributes object must be inline or in canonical stacked form',
    },
    schema: [{
      type: 'object',
      properties: { objectNames: objectNamesSchema },
      additionalProperties: false,
    }],
    messages: {
      mixedLayout: 'Attribute properties must all be on the same line or each on its own line.',
      openBraceMustEndLine: 'Opening brace of a multi-line attributes object must end its line.',
      closeBraceMustStartLine: 'Closing brace of a multi-line attributes object must start its line.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode;
    const objectNames = getObjectNames(context);

    function leadingIndent(node) {
      const line = sourceCode.lines[node.loc.start.line - 1];
      const match = line.match(/^(\s*)/);
      return match ? match[1] : '';
    }

    function buildStackedText(attrs, baseIndent) {
      const propIndent = `${baseIndent}  `;
      const props = attrs.properties.map(p => sourceCode.getText(p));
      return `{\n${props.map(t => `${propIndent}${t},`).join('\n')}\n${baseIndent}}`;
    }

    function hasInteriorComments(attrs) {
      return sourceCode.getCommentsInside(attrs).length > 0;
    }

    return {
      CallExpression(node) {
        const attrs = getTagAttrsObject(node, objectNames);
        if (!attrs) { return; }
        if (attrs.properties.length < 2) { return; }

        const props = attrs.properties;
        const openLine = attrs.loc.start.line;
        const closeLine = attrs.loc.end.line;
        const first = props[0];
        const last = props[props.length - 1];

        const allInline =
          openLine === closeLine &&
          props.every(p => p.loc.start.line === openLine && p.loc.end.line === openLine);

        if (allInline) { return; }

        const openBraceOk = first.loc.start.line > openLine;
        const closeBraceOk = last.loc.end.line < closeLine;

        let propsLayoutOk = true;
        for (let i = 1; i < props.length; i++) {
          if (props[i].loc.start.line <= props[i - 1].loc.end.line) {
            propsLayoutOk = false;
            break;
          }
        }

        if (openBraceOk && closeBraceOk && propsLayoutOk) { return; }

        const baseIndent = leadingIndent(node);
        const canFix = !hasInteriorComments(attrs);
        const fix = canFix
          ? (fixer => fixer.replaceText(attrs, buildStackedText(attrs, baseIndent)))
          : null;

        if (!propsLayoutOk) {
          context.report({ node: attrs, messageId: 'mixedLayout', fix });
          return;
        }
        if (!openBraceOk) {
          context.report({ node: attrs, messageId: 'openBraceMustEndLine', fix });
          return;
        }
        if (!closeBraceOk) {
          context.report({ node: attrs, messageId: 'closeBraceMustStartLine', fix });
        }
      },
    };
  },
};
