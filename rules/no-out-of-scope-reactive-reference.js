// Reports reactive primitives (signal, computed, .transform) that are created inside a
// `computed()` callback but escape its scope. Assigned to a variable that survives the
// callback, returned for external use, captured by module-level state, etc. Even with a
// stable key, the owning computed can stop the inner instance at any time (when its key
// isn't accessed during a re-run), so external references silently drop subscribers and
// produce out-of-sync state.
//
// Two consumption patterns are safe and allowed:
//   1. Calling .get() immediately. Extracts the value as a plain JS value
//   2. Passing the result directly to a tag call as content or an attribute value. 
//      the DOM-binding effect created by toElement() is flagged as internal at runtime
//      and is part of the owner's own render cycle, so its lifetime is tied to the DOM.

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

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow referencing a signal/computed/transform from outside the computed scope where it was created',
    },
    messages: {
      noOutOfScopeSignal:
        'signal() created inside a computed() body is referenced out of scope. ' +
        'The instance is owned by the surrounding computed and may be stopped at any time. ' +
        'Consume inline: call .get() on it, or pass it directly to a tag.',
      noOutOfScopeComputed:
        'computed() created inside a computed() body is referenced out of scope. ' +
        'The instance is owned by the surrounding computed and may be stopped at any time. ' +
        'Consume inline: call .get() on it, or pass it directly to a tag.',
      noOutOfScopeTransform:
        '.transform() called inside a computed() body is referenced out of scope. ' +
        'The instance is owned by the surrounding computed and may be stopped at any time. ' +
        'Consume inline: call .get() on it, or pass it directly to a tag.',
    },
  },

  create(context) {
    const signalNames = new Set();
    const computedNames = new Set();
    const effectNames = new Set();
    // Each entry is 'computed', 'effect', or 'other'. Innermost frame is last.
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
          && signalNames.has(node.callee.name)
        ) {
          messageId = 'noOutOfScopeSignal';
        } else if (
          node.callee.type === 'Identifier'
          && computedNames.has(node.callee.name)
        ) {
          messageId = 'noOutOfScopeComputed';
        } else if (
          node.callee.type === 'MemberExpression'
          && !node.callee.computed
          && node.callee.property.type === 'Identifier'
          && node.callee.property.name === 'transform'
        ) {
          messageId = 'noOutOfScopeTransform';
        } else {
          return;
        }

        // Must be inside a computed callback. Inside an effect is a different concern.
        let insideComputed = false;
        for (let i = fnStack.length - 1; i >= 0; i--) {
          if (fnStack[i] === 'computed') { insideComputed = true; break; }
          if (fnStack[i] === 'effect') { return; }
        }
        if (!insideComputed) { return; }

        // Safe: result is consumed immediately by a method chain. Call.get(),
        // call.transform(...), call.toString(), etc. The chain consumes the instance;
        // the instance itself never escapes the scope.
        const { parent } = node;
        if (
          parent.type === 'MemberExpression'
          && !parent.computed
          && parent.object === node
        ) { return; }

        // Safe: passed directly to a tag call as content or an attribute value.
        if (isTagArgument(node)) { return; }

        context.report({ node, messageId });
      },
    };
  },
};
