// Reports .set() on a binding that was read via .get() in the enclosing effect() body,
// when the .set() is inside an async callback (setTimeout, rAF, .then, etc.).
// The async boundary means the write happens after the effect completes — re-triggering
// it on every async resolution and creating an invisible reactive loop.

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
    type: 'problem',
    docs: {
      description: 'disallow writing a signal in an async callback when it was read in the enclosing effect()',
    },
    messages: {
      noSignalAsyncWrite:
        "'{{name}}' is read via .get() in the effect body and written via .set() in an async callback. " +
        'This re-triggers the effect after each async operation, creating a potential reactive loop. ' +
        'Use .value instead of .get() to read without subscribing, or guard the write with a condition check.',
    },
  },

  create(context) {
    const effectNames = new Set();
    // Each frame: { type: 'effectTop'|'asyncCb'|'other', reads: Set<string>|null }
    // asyncCb shares the reads reference from its parent effectTop so .get() calls
    // registered before the async boundary are visible when checking .set() inside it.
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
          fnStack.push({ type: 'effectTop', reads: new Set() });
          return;
        }

        const top = fnStack[fnStack.length - 1];
        if (top && (top.type === 'effectTop' || top.type === 'asyncCb') && isAsyncParent(node)) {
          fnStack.push({ type: 'asyncCb', reads: top.reads });
          return;
        }

        fnStack.push({ type: 'other', reads: null });
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

        if (method === 'get' && node.arguments.length === 0 && top.type === 'effectTop') {
          top.reads.add(name);
        } else if (method === 'set' && node.arguments.length === 1 && top.type === 'asyncCb' && top.reads.has(name)) {
          context.report({
            node,
            messageId: 'noSignalAsyncWrite',
            data: { name },
          });
        }
      },
    };
  },
};
