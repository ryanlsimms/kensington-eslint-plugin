// Reports reactive primitives (signal, computed, .transform) that are created inside a
// `computed()` callback and escape its scope. The owning computed can stop the inner
// instance at any time (when its key isn't accessed during a re-run), so external
// references silently drop subscribers and produce out-of-sync state.
//
// Designed to avoid false positives. The conservative-by-default policy is:
//   - The CREATION site of a signal/computed/.transform inside a computed body is only
//     flagged when the result is used in a way that clearly escapes the callback. The
//     common idiom `const sig = computed(...); return t.div(sig);` (bind to a const,
//     use as a tag argument) is safe and not flagged.
//   - The OFFENDING REFERENCE (not just the creation site) is what the rule flags,
//     so the message points at the actual escape rather than the (safe) creation.
//
// Patterns the rule treats as SAFE (none of these fire the rule):
//   1. Result consumed inline by a method chain (`.get()`, `.transform()`, `.set()`,
//      `.value`, etc.).
//   2. Result passed directly to a tag call as content or an attribute value.
//   3. Result passed as a function-call argument (`helper(sig)`, `obj.method(sig)`).
//      We assume the receiving function is synchronous and well-behaved.
//   4. Result assigned to a `const` declared inside the same computed callback, where
//      every reference to that const is itself a safe pattern (1-3 above or
//      return-from-the-computed-callback-directly).
//
// Patterns the rule treats as ESCAPES (these fire the rule):
//   A. Reference appears as the return value of a NESTED function inside the computed
//      callback (e.g. the mapFn of `arr.map(item => sig)`). The signal then becomes
//      part of the outer computed's value, subscribed to by consumers outside the
//      callback scope.
//   B. Reference is assigned to an identifier defined OUTSIDE the computed callback
//      (`outsideVar = sig` where `outsideVar` is from a parent scope or module scope).
//
// Returning a signal directly from the computed callback (`return sig`) is the
// canonical "return-a-signal-from-a-component-function" pattern and is treated as
// safe; the binding effect on the outer's content is internal and the runtime's
// `_isInternal` check handles it.

// Returns true when `node` is being used as an argument to a tag-builder method call
// (t.li(node), t.div({ class: node }), t.span([..., node, ...])). Recurses through
// containing object/array literals to handle attribute objects and content arrays.
function isTagArgument(node) {
  let current = node.parent;
  let inner = node;
  while (current) {
    if (current.type === 'CallExpression') {
      const c = current.callee;
      if (
        c.type === 'MemberExpression'
        && !c.computed
        && c.object.type === 'Identifier'
        && c.property.type === 'Identifier'
        && /^[a-z]/.test(c.property.name)
      ) {
        if (current.arguments.includes(inner)) { return true; }
      }
      return false;
    }
    if (
      current.type === 'ArrayExpression'
      || current.type === 'ObjectExpression'
      || current.type === 'Property'
      || current.type === 'SpreadElement'
    ) {
      inner = current;
      current = current.parent;
      continue;
    }
    return false;
  }
  return false;
}

// Walks up `node`'s parents through array/object/property/spread containers and
// returns the first ancestor that isn't one of those. Used to classify how a
// reference is consumed.
function unwrapContainers(node) {
  let inner = node;
  let current = node.parent;
  while (
    current
    && (current.type === 'ArrayExpression'
      || current.type === 'ObjectExpression'
      || current.type === 'Property'
      || current.type === 'SpreadElement')
  ) {
    inner = current;
    current = current.parent;
  }
  return { inner, parent: current };
}

// Given a node that's KNOWN to be inside a computed callback, walks up to find the
// nearest enclosing function. Returns that function node (the computed callback OR
// a nested function inside it).
function nearestEnclosingFunction(node) {
  let cur = node.parent;
  while (cur) {
    if (
      cur.type === 'ArrowFunctionExpression'
      || cur.type === 'FunctionExpression'
      || cur.type === 'FunctionDeclaration'
    ) {
      return cur;
    }
    cur = cur.parent;
  }
  return null;
}

// Classifies a single reference to a kensington-primitive-bound const.
// Returns 'safe' | 'escape-return' | 'escape-assign' | 'unknown'.
//   safe          consumed via method chain, tag arg, function-call arg, OR
//                 returned directly from the computed callback itself.
//   escape-return reference is returned from a NESTED function inside the
//                 computed callback. The value flows out via the nested function's
//                 return.
//   escape-assign reference is assigned to an identifier declared outside the
//                 computed callback.
//   unknown       reference appears in some shape the rule doesn't recognize.
//                 Treated as safe by the no-false-positives policy.
function classifyReference(refNode, computedCallback) {
  // Method chain: `sig.get()`, `sig.transform(...)`, `sig.set(...)`, `sig.value`.
  if (
    refNode.parent
    && refNode.parent.type === 'MemberExpression'
    && refNode.parent.object === refNode
  ) {
    return 'safe';
  }

  // Tag argument (possibly through array/object/spread containers).
  if (isTagArgument(refNode)) {
    return 'safe';
  }

  // Function-call argument (any function, not just tag calls). The rule
  // intentionally trusts the receiving function rather than chasing flow.
  const { inner, parent } = unwrapContainers(refNode);
  if (parent && parent.type === 'CallExpression' && parent.arguments.includes(inner)) {
    return 'safe';
  }

  // Assignment expression where the reference is on the right-hand side. If
  // the left-hand-side identifier resolves to a binding OUTSIDE the computed
  // callback, this is a clear escape.
  if (parent && parent.type === 'AssignmentExpression' && parent.right === inner) {
    if (parent.left.type === 'Identifier') {
      return 'escape-assign';
    }
    if (
      parent.left.type === 'MemberExpression'
      && parent.left.object.type === 'Identifier'
    ) {
      // outer.field = sig — escape if `outer` is outside-scope.
      return 'escape-assign';
    }
    return 'unknown';
  }

  // Return statement. Safe ONLY if the return belongs to the computed callback
  // itself; flagged if it belongs to a nested function inside the callback.
  if (parent && parent.type === 'ReturnStatement') {
    const fn = nearestEnclosingFunction(refNode);
    return fn === computedCallback ? 'safe' : 'escape-return';
  }

  // Concise-body arrow function whose body IS the reference. Safe only if the
  // arrow IS the computed callback itself; otherwise the reference is the
  // return value of a nested function.
  if (parent && (parent.type === 'ArrowFunctionExpression' || parent.type === 'FunctionExpression') && parent.body === inner) {
    return parent === computedCallback ? 'safe' : 'escape-return';
  }

  return 'unknown';
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow referencing a signal/computed/transform from outside the computed scope where it was created',
    },
    messages: {
      escapeReturn:
        'Reactive primitive created inside a computed() escapes via a nested function\'s return value. '
        + 'The instance is owned by the surrounding computed and may be stopped at any time. '
        + 'Either consume inline (call .get()) or hoist the primitive to a parent scope so it has no owner.',
      escapeAssign:
        'Reactive primitive created inside a computed() escapes via assignment to an outside-scope variable. '
        + 'The instance is owned by the surrounding computed and may be stopped at any time. '
        + 'Either consume inline or hoist the primitive to a parent scope so it has no owner.',
    },
  },

  create(context) {
    const signalNames = new Set();
    const computedNames = new Set();
    const effectNames = new Set();
    // Each entry is { kind: 'computed'|'effect'|'other', node }. Innermost last.
    const fnStack = [];

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'kensington') { return; }
        for (const spec of node.specifiers) {
          if (spec.type !== 'ImportSpecifier') { continue; }
          if (spec.imported.name === 'signal') { signalNames.add(spec.local.name); }
          if (spec.imported.name === 'computed') { computedNames.add(spec.local.name); }
          if (spec.imported.name === 'effect') { effectNames.add(spec.local.name); }
        }
      },

      ':matches(ArrowFunctionExpression, FunctionExpression)'(node) {
        const { parent } = node;
        if (
          parent.type === 'CallExpression'
          && parent.arguments[0] === node
          && parent.callee.type === 'Identifier'
        ) {
          if (computedNames.has(parent.callee.name)) {
            fnStack.push({ kind: 'computed', node });
            return;
          }
          if (effectNames.has(parent.callee.name)) {
            fnStack.push({ kind: 'effect', node });
            return;
          }
        }
        fnStack.push({ kind: 'other', node });
      },

      ':matches(ArrowFunctionExpression, FunctionExpression):exit'() {
        fnStack.pop();
      },

      CallExpression(node) {
        // Is this a signal/computed/.transform call?
        const isSignalCall = node.callee.type === 'Identifier' && signalNames.has(node.callee.name);
        const isComputedCall = node.callee.type === 'Identifier' && computedNames.has(node.callee.name);
        const isTransformCall = node.callee.type === 'MemberExpression'
          && !node.callee.computed
          && node.callee.property.type === 'Identifier'
          && node.callee.property.name === 'transform';
        if (!isSignalCall && !isComputedCall && !isTransformCall) {
          return;
        }

        // Must be inside a computed callback (innermost reactive frame). Inside
        // an effect is a different rule's concern.
        let computedFrame = null;
        for (let i = fnStack.length - 1; i >= 0; i--) {
          if (fnStack[i].kind === 'computed') { computedFrame = fnStack[i]; break; }
          if (fnStack[i].kind === 'effect') { return; }
        }
        if (!computedFrame) { return; }
        const computedCallback = computedFrame.node;

        // Direct-use safe patterns at the creation site.
        if (
          node.parent
          && node.parent.type === 'MemberExpression'
          && !node.parent.computed
          && node.parent.object === node
        ) {
          return; // method chain
        }
        if (isTagArgument(node)) {
          return; // tag content / attribute value
        }

        // If bound to a const inside the callback, classify each reference. Only
        // flag if at least one reference is a clear escape (escape-return or
        // escape-assign). Everything else is treated as safe.
        if (
          node.parent
          && node.parent.type === 'VariableDeclarator'
          && node.parent.init === node
          && node.parent.id.type === 'Identifier'
        ) {
          const varName = node.parent.id.name;
          const scope = context.sourceCode.getScope(node);
          const variable = scope.variables.find(v => v.name === varName)
            || scope.references.find(r => r.identifier.name === varName)?.resolved;
          if (!variable) {
            return; // can't analyze; trust the no-false-positives policy
          }
          for (const ref of variable.references) {
            // Skip the declaration's own write reference.
            if (ref.identifier === node.parent.id) { continue; }
            const refNode = ref.identifier;
            const verdict = classifyReference(refNode, computedCallback);
            if (verdict === 'escape-return') {
              context.report({ node: refNode, messageId: 'escapeReturn' });
              return;
            }
            if (verdict === 'escape-assign') {
              context.report({ node: refNode, messageId: 'escapeAssign' });
              return;
            }
          }
          return; // all references are safe (or unknown but trusted)
        }

        // Not bound to a const. Classify the creation site itself as if it were
        // a reference (handles the inline return-from-map idiom).
        const verdict = classifyReference(node, computedCallback);
        if (verdict === 'escape-return') {
          context.report({ node, messageId: 'escapeReturn' });
          return;
        }
        if (verdict === 'escape-assign') {
          context.report({ node, messageId: 'escapeAssign' });
          return;
        }
        // 'safe' or 'unknown' → no report.
      },
    };
  },
};
