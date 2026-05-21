// Reports effect() called inside an effect() callback. Every re-run of the outer effect
// creates a new inner effect — the previous one is never stopped, so subscriptions accumulate.
// Capturing the return handle does not help; you would need to call .stop() on the previous
// handle at the top of each run, which the no-ignored-effect-return rule does not enforce.
export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow creating a new effect() inside an effect() body',
    },
    messages: {
      noEffectInEffect:
        'effect() called inside an effect() body. Each outer re-run creates a new inner effect ' +
        'without stopping the previous one, causing subscriptions to accumulate. ' +
        'Declare the effect at the same level or restructure using a single effect.',
    },
  },

  create(context) {
    const effectNames = new Set();
    const computedNames = new Set();
    // Each entry is 'effect', 'computed', or 'other' — innermost frame is last.
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
            fnStack.push('effect');
            return;
          }
          if (computedNames.has(parent.callee.name)) {
            fnStack.push('computed');
            return;
          }
        }
        fnStack.push('other');
      },

      ':matches(ArrowFunctionExpression, FunctionExpression):exit'() {
        fnStack.pop();
      },

      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          !effectNames.has(node.callee.name)
        ) { return; }

        for (let i = fnStack.length - 1; i >= 0; i--) {
          if (fnStack[i] === 'effect') {
            context.report({ node, messageId: 'noEffectInEffect' });
            return;
          }
          if (fnStack[i] === 'computed') { return; }
        }
      },
    };
  },
};
