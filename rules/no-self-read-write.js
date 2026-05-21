// Reports .get() and .set() on the same binding within the top-level body of
// an effect() or computed() callback. Nested functions are excluded — the async
// case is covered by the no-signal-async-write rule.
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow reading and writing the same signal in the same effect or computed run',
    },
    messages: {
      noSelfReadWrite:
        "'{{name}}' is read via .get() and written via .set() in the same {{contextType}} run. " +
        'This creates a reactive loop — the write re-triggers the run. ' +
        'Use .value instead of .get() to read the current value without subscribing.',
    },
  },

  create(context) {
    const effectNames = new Set();
    const computedNames = new Set();
    // Each frame: { type: 'effect'|'computed'|'other', reads: Set<string> }
    const fnStack = [];

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
          if (spec.imported.name === 'effect') { effectNames.add(spec.local.name); }
          if (spec.imported.name === 'computed') { computedNames.add(spec.local.name); }
        }
      },

      ':matches(ArrowFunctionExpression, FunctionExpression)'(node) {
        const { parent } = node;
        if (
          parent.type === 'CallExpression' &&
          parent.arguments[0] === node &&
          parent.callee.type === 'Identifier'
        ) {
          if (effectNames.has(parent.callee.name)) {
            fnStack.push({ type: 'effect', reads: new Set() });
            return;
          }
          if (computedNames.has(parent.callee.name)) {
            fnStack.push({ type: 'computed', reads: new Set() });
            return;
          }
        }
        fnStack.push({ type: 'other', reads: new Set() });
      },

      ':matches(ArrowFunctionExpression, FunctionExpression):exit'() {
        fnStack.pop();
      },

      CallExpression(node) {
        const top = fnStack[fnStack.length - 1];
        if (!top || top.type === 'other') { return; }
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.object.type !== 'Identifier' ||
          node.callee.property.type !== 'Identifier'
        ) { return; }

        const name = node.callee.object.name;
        const method = node.callee.property.name;

        if (method === 'get' && node.arguments.length === 0) {
          top.reads.add(name);
        } else if (method === 'set' && node.arguments.length === 1 && top.reads.has(name)) {
          context.report({
            node,
            messageId: 'noSelfReadWrite',
            data: { name, contextType: top.type },
          });
        }
      },
    };
  },
};
