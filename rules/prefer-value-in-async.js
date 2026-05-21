// Reports .get() calls inside async callbacks within an effect() body.
// The effect has already completed by the time the async callback runs, so .get()
// registers no subscription — it behaves like .value but looks like a reactive read.
// Use .value instead to make the intent clear.

const ASYNC_GLOBAL_FNS = new Set([
  'setTimeout', 'setInterval', 'setImmediate',
  'queueMicrotask', 'requestAnimationFrame', 'requestIdleCallback',
]);

const ASYNC_METHODS = new Set(['then', 'catch', 'finally']);

function isAsyncParent(fnNode) {
  const { parent } = fnNode;
  if (parent.type !== 'CallExpression' || !parent.arguments.includes(fnNode)) { return false; }
  const { callee } = parent;
  if (callee.type === 'Identifier' && ASYNC_GLOBAL_FNS.has(callee.name)) { return true; }
  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    ASYNC_METHODS.has(callee.property.name)
  ) { return true; }
  return false;
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'prefer .value over .get() inside async callbacks within an effect()',
    },
    messages: {
      preferValueInAsync:
        "Use .value instead of .get() inside an async callback. " +
        'The effect has already completed by the time this callback runs, so .get() ' +
        'registers no subscription. .value makes that intent explicit.',
    },
  },

  create(context) {
    const effectNames = new Set();
    // Each frame: { type: 'effectTop'|'asyncCb'|'other' }
    const fnStack = [];

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
          if (spec.imported.name === 'effect') { effectNames.add(spec.local.name); }
        }
      },

      ':matches(ArrowFunctionExpression, FunctionExpression)'(node) {
        const { parent } = node;
        if (
          parent.type === 'CallExpression' &&
          parent.arguments[0] === node &&
          parent.callee.type === 'Identifier' &&
          effectNames.has(parent.callee.name)
        ) {
          fnStack.push('effectTop');
          return;
        }

        const top = fnStack[fnStack.length - 1];
        if (top && (top === 'effectTop' || top === 'asyncCb') && isAsyncParent(node)) {
          fnStack.push('asyncCb');
          return;
        }

        fnStack.push('other');
      },

      ':matches(ArrowFunctionExpression, FunctionExpression):exit'() {
        fnStack.pop();
      },

      CallExpression(node) {
        if (fnStack[fnStack.length - 1] !== 'asyncCb') { return; }
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.object.type !== 'Identifier' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'get' ||
          node.arguments.length !== 0
        ) { return; }
        context.report({ node, messageId: 'preferValueInAsync' });
      },
    };
  },
};
