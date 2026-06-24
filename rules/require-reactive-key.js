// Paranoid mode. Flags EVERY `signal()`, `computed()`, or `.transform()` call
// site that does not pass a key. Keys are cheap and harmless: at runtime the
// key is IGNORED when the call is not inside a reactive scope. The only cost is
// a few extra characters per call. The benefit is that the code is robust to
// future refactors that lift a top-level helper inside a `computed()` callback
// or a `mapWithKey()` mapFn. Without the key, that refactor silently introduces
// the helper-function trap; per-row local state then resets on every outer
// re-run and the operator only discovers it during manual testing.
//
// Suppress per call site with `// eslint-disable-next-line kensington/require-reactive-key`
// when you're certain the call site will never be moved into a reactive scope.
//
// Off in the `recommended` config. On in `strict` and intended for use by
// agents and projects that want maximum safety.

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'require a stable key on every signal/computed/.transform call. Keys are no-ops '
        + 'at the module scope and required inside reactive callbacks; passing one always '
        + 'is safer than auditing call-site reachability.',
    },
    messages: {
      missingKey:
        '{{primitive}}() called without a key. Pass a stable key as the second argument '
        + '(e.g. {{primitive}}({{exampleFirstArg}}, \'{{exampleKey}}\')). Keys are ignored '
        + 'outside a reactive scope so this is safe everywhere; required inside one. '
        + 'Suppress per call site with `eslint-disable-next-line kensington/require-reactive-key` '
        + 'when the call site is known never to move into a reactive scope.',
    },
    schema: [],
  },

  create(context) {
    const signalNames = new Set();
    const computedNames = new Set();

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') {
          return;
        }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') {
            continue;
          }
          if (spec.imported.name === 'signal') { signalNames.add(spec.local.name); }
          if (spec.imported.name === 'computed') { computedNames.add(spec.local.name); }
        }
      },

      CallExpression(node) {
        const callee = node.callee;
        const hasKey = node.arguments.length >= 2;
        if (hasKey) {
          return;
        }

        if (callee.type === 'Identifier' && signalNames.has(callee.name)) {
          // signal(initial) — second arg should be the key.
          context.report({
            node,
            messageId: 'missingKey',
            data: { primitive: callee.name, exampleFirstArg: 'initial', exampleKey: 'unique-id' },
          });
          return;
        }

        if (callee.type === 'Identifier' && computedNames.has(callee.name)) {
          context.report({
            node,
            messageId: 'missingKey',
            data: { primitive: callee.name, exampleFirstArg: 'fn', exampleKey: 'unique-id' },
          });
          return;
        }

        if (
          callee.type === 'MemberExpression'
          && !callee.computed
          && callee.property.type === 'Identifier'
          && callee.property.name === 'transform'
        ) {
          // .transform(fn) — second arg should be the key.
          context.report({
            node,
            messageId: 'missingKey',
            data: { primitive: '.transform', exampleFirstArg: 'fn', exampleKey: 'unique-id' },
          });
        }
      },
    };
  },
};
