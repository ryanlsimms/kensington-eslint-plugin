// Reports unkeyed `signal()`, `computed()`, or `.transform()` calls inside named
// functions that are transitively reachable from a reactive callback in the
// same file (a mapWithKey mapFn, a `computed(fn)`, `transform(fn)`, or
// `effect(fn)`). The existing `no-new-signal-in-computed` and
// `no-new-computed-in-computed` rules catch the LEXICAL case (the call is
// directly inside a `computed(() => ...)` body in the source). This rule
// catches the CALL-STACK case (the call is in a helper, the helper is called
// from inside a computed/transform/mapFn callback, so at runtime the call runs
// in a reactive scope).
//
// Single-file analysis only. We track only named top-level functions; nested
// anonymous helpers are out of scope (the lexical rule already covers them).
//
// Algorithm:
//   Single AST walk that maintains TWO stacks:
//     - fnStack: named-function frames (innermost last). Used to attribute
//       unkeyed reactive primitives to their containing function and to record
//       which other named functions each function calls.
//     - reactiveDepth: an integer counter incremented when entering a reactive
//       callback (the function argument to `computed(fn)`, `effect(fn)`,
//       `signal.transform(fn)`, or `signal.mapWithKey(key, fn)`). When > 0,
//       every named CallExpression encountered marks its callee as a reactive
//       entry point. This captures helpers reached via arbitrary intermediate
//       wrappers (`.map(a => cell(a))`, nested arrows, loops, etc.).
//   Then on Program:exit, BFS from reactive entry points through the call
//   graph; every reached function is in a reactive scope. Report every unkeyed
//   reactive-primitive call site inside any reached function.

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'require a stable key for signal/computed/.transform calls inside helper '
        + 'functions called from a reactive callback (mapWithKey mapFn, '
        + 'computed/transform/effect body) in the same file',
    },
    messages: {
      helperFunctionTrap:
        '{{primitive}}() call without a key inside `{{fnName}}`, which is called from '
        + 'a reactive callback in this file ({{reason}}). The call runs inside the '
        + 'surrounding reactive scope at runtime even though the call site looks '
        + 'top-level here. Pass a stable key as the second argument to scope the '
        + 'instance to the surrounding reactive scope.',
    },
    schema: [],
  },

  create(context) {
    const signalNames = new Set();
    const computedNames = new Set();
    const effectNames = new Set();

    // funcName -> { unkeyedCalls: [{node, primitive}], callees: Set<funcName> }
    const funcs = new Map();
    // funcName -> reason it's a reactive entry point.
    const reactiveEntryPoints = new Map();
    // Stack of named-function frames; innermost last.
    const fnStack = [];
    // How many reactive callbacks deep we are at the lexical level.
    let reactiveDepth = 0;

    function currentFn() {
      return fnStack.length ? fnStack[fnStack.length - 1] : null;
    }

    function ensureFunc(name) {
      if (!funcs.has(name)) {
        funcs.set(name, { unkeyedCalls: [], callees: new Set() });
      }
      return funcs.get(name);
    }

    function fnBindingName(node) {
      if (node.type === 'FunctionDeclaration' && node.id) {
        return node.id.name;
      }
      if (
        node.parent
        && node.parent.type === 'VariableDeclarator'
        && node.parent.id.type === 'Identifier'
        && node.parent.init === node
      ) {
        return node.parent.id.name;
      }
      return null;
    }

    // True when the given (Function|Arrow)Expression is being passed as a
    // reactive callback argument to a kensington reactive wrapper or method.
    function isReactiveCallback(node) {
      const { parent } = node;
      if (!parent || parent.type !== 'CallExpression') {
        return false;
      }
      const callee = parent.callee;
      if (callee.type === 'Identifier') {
        if (
          (computedNames.has(callee.name) || effectNames.has(callee.name))
          && parent.arguments[0] === node
        ) {
          return true;
        }
      }
      if (
        callee.type === 'MemberExpression'
        && !callee.computed
        && callee.property.type === 'Identifier'
      ) {
        // signal.transform(fn) — first arg is the callback.
        if (callee.property.name === 'transform' && parent.arguments[0] === node) {
          return true;
        }
        // signal.mapWithKey(key, fn) — second arg is the callback.
        if (callee.property.name === 'mapWithKey' && parent.arguments[1] === node) {
          return true;
        }
      }
      return false;
    }

    function reasonFor(node) {
      const { parent } = node;
      const callee = parent.callee;
      if (callee.type === 'Identifier') {
        if (computedNames.has(callee.name)) { return 'passed to computed()'; }
        if (effectNames.has(callee.name)) { return 'passed to effect()'; }
      }
      if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
        if (callee.property.name === 'transform') { return 'passed to .transform()'; }
        if (callee.property.name === 'mapWithKey') { return 'passed to mapWithKey() as mapFn'; }
      }
      return 'inside a reactive callback';
    }

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
          if (spec.imported.name === 'effect') { effectNames.add(spec.local.name); }
        }
      },

      ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)'(node) {
        const name = fnBindingName(node);
        if (name) {
          fnStack.push(ensureFunc(name));
        } else {
          fnStack.push({ unkeyedCalls: [], callees: new Set(), anonymous: true });
        }
        if (isReactiveCallback(node)) {
          reactiveDepth++;
        }
      },

      ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression):exit'(node) {
        if (isReactiveCallback(node)) {
          reactiveDepth--;
        }
        fnStack.pop();
      },

      CallExpression(node) {
        const callee = node.callee;
        const hasKey = node.arguments.length >= 2;

        // 1. If we are lexically inside ANY reactive callback and the callee is a
        //    named identifier, mark that function as a reactive entry point.
        if (reactiveDepth > 0 && callee.type === 'Identifier') {
          if (!reactiveEntryPoints.has(callee.name)) {
            reactiveEntryPoints.set(
              callee.name,
              `transitively reached from a reactive callback in this file`,
            );
          }
        }

        // 1b. Detect bare-identifier callbacks passed to reactive wrappers:
        //     computed(fn), effect(fn), signal.transform(fn), signal.mapWithKey(key, fn).
        //     The callback isn't lexically a Function/Arrow, so it never enters our
        //     reactiveDepth tracking. Mark the identifier as an entry point directly.
        function checkBareIdent(arg, reason) {
          if (arg && arg.type === 'Identifier' && !reactiveEntryPoints.has(arg.name)) {
            reactiveEntryPoints.set(arg.name, reason);
          }
        }
        if (callee.type === 'Identifier') {
          if (computedNames.has(callee.name)) {
            checkBareIdent(node.arguments[0], 'passed to computed()');
          } else if (effectNames.has(callee.name)) {
            checkBareIdent(node.arguments[0], 'passed to effect()');
          }
        } else if (
          callee.type === 'MemberExpression'
          && !callee.computed
          && callee.property.type === 'Identifier'
        ) {
          if (callee.property.name === 'transform') {
            checkBareIdent(node.arguments[0], 'passed to .transform()');
          } else if (callee.property.name === 'mapWithKey') {
            checkBareIdent(node.arguments[1], 'passed to mapWithKey() as mapFn');
          }
        }

        // 2. Record unkeyed reactive-primitive calls inside the current named function.
        const fn = currentFn();
        if (fn && !fn.anonymous) {
          if (callee.type === 'Identifier' && signalNames.has(callee.name) && !hasKey) {
            fn.unkeyedCalls.push({ node, primitive: 'signal' });
          } else if (callee.type === 'Identifier' && computedNames.has(callee.name) && !hasKey) {
            fn.unkeyedCalls.push({ node, primitive: 'computed' });
          } else if (
            callee.type === 'MemberExpression'
            && !callee.computed
            && callee.property.type === 'Identifier'
            && callee.property.name === 'transform'
            && !hasKey
          ) {
            fn.unkeyedCalls.push({ node, primitive: '.transform' });
          } else if (callee.type === 'Identifier') {
            fn.callees.add(callee.name);
          }
        }
      },

      'Program:exit'() {
        // BFS over the call graph starting from reactive entry points.
        const reachable = new Map();
        const queue = [];
        for (const [name, reason] of reactiveEntryPoints) {
          if (funcs.has(name)) {
            reachable.set(name, reason);
            queue.push(name);
          }
        }
        while (queue.length) {
          const name = queue.shift();
          const rec = funcs.get(name);
          if (!rec) {
            continue;
          }
          for (const callee of rec.callees) {
            if (!reachable.has(callee) && funcs.has(callee)) {
              reachable.set(callee, `called transitively from ${name}`);
              queue.push(callee);
            }
          }
        }

        for (const [name, rec] of funcs) {
          if (!reachable.has(name)) {
            continue;
          }
          const reason = reachable.get(name);
          for (const hit of rec.unkeyedCalls) {
            context.report({
              node: hit.node,
              messageId: 'helperFunctionTrap',
              data: { primitive: hit.primitive, fnName: name, reason },
            });
          }
        }

        // The reasonFor helper isn't used by the simplified entry-point recording
        // (reason text is generic now). Keeping the function for future detail
        // upgrades without changing the public message shape.
        void reasonFor;
      },
    };
  },
};
