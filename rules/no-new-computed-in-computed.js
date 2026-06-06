// Reports unkeyed computed() or .transform() calls inside a computed() callback. Each
// recompute creates a new orphaned derived signal with no cleanup path. Pass a stable key
// as the second argument (e.g. computed(fn, item.id) or sig.transform(fn, item.id)) to
// scope the derived signal to the surrounding computed so the same instance is reused
// across re-runs.
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require a stable key for computed() and .transform() calls inside a computed() body',
    },
    messages: {
      noNewComputedInComputed:
        'computed() called inside a computed() body without a key. The DOM node will be replaced ' +
        'on every outer re-render. Pass a stable key as the second argument ' +
        '(e.g. computed(fn, item.id)) so the same instance is reused across computed re-runs.',
      noNewTransformInComputed:
        '.transform() called inside a computed() body without a key. The DOM node will be replaced ' +
        'on every outer re-render. Pass a stable key as the second argument ' +
        '(e.g. sig.transform(fn, item.id)) so the same instance is reused across computed re-runs.',
    },
  },

  create(context) {
    const computedNames = new Set();
    const effectNames = new Set();
    // Each entry is 'computed', 'effect', or 'other'. Innermost frame is last.
    const fnStack = [];

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
          if (spec.imported.name === 'computed') { computedNames.add(spec.local.name); }
          if (spec.imported.name === 'effect') { effectNames.add(spec.local.name); }
        }
      },

      ':matches(ArrowFunctionExpression, FunctionExpression)'(node) {
        const { parent } = node;
        if (
          parent.type === 'CallExpression' &&
          parent.arguments[0] === node &&
          parent.callee.type === 'Identifier'
        ) {
          if (computedNames.has(parent.callee.name)) {
            fnStack.push('computed');
            return;
          }
          if (effectNames.has(parent.callee.name)) {
            fnStack.push('effect');
            return;
          }
        }
        fnStack.push('other');
      },

      ':matches(ArrowFunctionExpression, FunctionExpression):exit'() {
        fnStack.pop();
      },

      CallExpression(node) {
        let messageId;
        if (
          node.callee.type === 'Identifier'
          && computedNames.has(node.callee.name)
        ) {
          messageId = 'noNewComputedInComputed';
        } else if (
          node.callee.type === 'MemberExpression'
          && !node.callee.computed
          && node.callee.property.type === 'Identifier'
          && node.callee.property.name === 'transform'
        ) {
          messageId = 'noNewTransformInComputed';
        } else {
          return;
        }
        // A key was supplied. This is the intended keyed pattern, not a problem.
        if (node.arguments.length >= 2) { return; }

        for (let i = fnStack.length - 1; i >= 0; i--) {
          if (fnStack[i] === 'computed') {
            context.report({ node, messageId });
            return;
          }
          if (fnStack[i] === 'effect') { return; }
        }
      },
    };
  },
};
