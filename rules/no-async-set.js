// Reports `.set(async fn)` on any signal. An async updater returns a Promise
// instead of the next value, which:
//   - For a regular signal, stores the Promise object as the value. Reads
//     return the Promise; downstream code that expects T sees a Thenable.
//   - For a liveSignal, serializes the Promise to "{}" on the wire,
//     corrupting every subscriber's view of the value.
//
// The async-fn pattern is almost always a sign of "I want to do async work
// then update the signal." The right shape is to await the async work
// first, THEN call `.set(value)` with the resolved value. Or use
// effect()/setTimeout to schedule the write.

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow passing an async function to .set() on a signal. The Promise return corrupts the stored value (especially across the wire for liveSignals).',
    },
    messages: {
      noAsyncSet:
        '.set(async fn) is almost always a bug. The function returns a Promise instead of the next value, '
        + 'which gets stored as-is (and serializes to "{}" on the wire for liveSignals). '
        + 'Await the async work first, then call `.set(resolvedValue)`. Or use effect() to schedule the write.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== 'MemberExpression'
          || callee.computed
          || callee.property.type !== 'Identifier'
          || callee.property.name !== 'set'
        ) { return; }
        const arg = node.arguments[0];
        if (arg === undefined) { return; }
        if (
          (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression')
          && arg.async === true
        ) {
          context.report({ node: arg, messageId: 'noAsyncSet' });
        }
      },
    };
  },
};
