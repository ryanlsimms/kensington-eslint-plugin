import noSetInDerivation from './rules/no-set-in-derivation.js';
import noSelfReadWrite from './rules/no-self-read-write.js';
import noSignalAsyncWrite from './rules/no-signal-async-write.js';
import noSetOnDerivedSignal from './rules/no-set-on-derived-signal.js';
import noNewSignalInEffect from './rules/no-new-signal-in-effect.js';
import noEffectInComputed from './rules/no-effect-in-computed.js';
import noIgnoredEffectReturn from './rules/no-ignored-effect-return.js';
import preferValueInAsync from './rules/prefer-value-in-async.js';
import noNewComputedInEffect from './rules/no-new-computed-in-effect.js';
import noNewSignalInComputed from './rules/no-new-signal-in-computed.js';
import noUnsafeLiteral from './rules/no-unsafe-literal.js';
import noNewComputedInComputed from './rules/no-new-computed-in-computed.js';
import noEffectInEffect from './rules/no-effect-in-effect.js';
import noOutOfScopeReactiveReference from './rules/no-out-of-scope-reactive-reference.js';
import noAsyncEffect from './rules/no-async-effect.js';
import noAsyncComputed from './rules/no-async-computed.js';
import preferBooleanAttributeTrue from './rules/prefer-boolean-attribute-true.js';
import preferCamelcaseAttrs from './rules/prefer-camelcase-attrs.js';
import preferStyleObject from './rules/prefer-style-object.js';
import preferNestedAttrGroups from './rules/prefer-nested-attr-groups.js';
import preferArrayForMultilineContent from './rules/prefer-array-for-multiline-content.js';
import attrsOnCallLine from './rules/attrs-on-call-line.js';
import attrsCanonicalShape from './rules/attrs-canonical-shape.js';
import consistentContentLayout from './rules/consistent-content-layout.js';

const plugin = {
  meta: { name: 'eslint-plugin-kensington' },
  rules: {
    'no-set-in-derivation': noSetInDerivation,
    'no-self-read-write': noSelfReadWrite,
    'no-signal-async-write': noSignalAsyncWrite,
    'no-set-on-derived-signal': noSetOnDerivedSignal,
    'no-new-signal-in-effect': noNewSignalInEffect,
    'no-effect-in-computed': noEffectInComputed,
    'no-ignored-effect-return': noIgnoredEffectReturn,
    'prefer-value-in-async': preferValueInAsync,
    'no-new-computed-in-effect': noNewComputedInEffect,
    'no-new-signal-in-computed': noNewSignalInComputed,
    'no-unsafe-literal': noUnsafeLiteral,
    'no-new-computed-in-computed': noNewComputedInComputed,
    'no-effect-in-effect': noEffectInEffect,
    'no-out-of-scope-reactive-reference': noOutOfScopeReactiveReference,
    'no-async-effect': noAsyncEffect,
    'no-async-computed': noAsyncComputed,
    'prefer-boolean-attribute-true': preferBooleanAttributeTrue,
    'prefer-camelcase-attrs': preferCamelcaseAttrs,
    'prefer-style-object': preferStyleObject,
    'prefer-nested-attr-groups': preferNestedAttrGroups,
    'prefer-array-for-multiline-content': preferArrayForMultilineContent,
    'attrs-on-call-line': attrsOnCallLine,
    'attrs-canonical-shape': attrsCanonicalShape,
    'consistent-content-layout': consistentContentLayout,
  },
  configs: {},
};

plugin.configs.recommended = {
  plugins: { kensington: plugin },
  rules: {
    'kensington/no-set-in-derivation': 'error',
    'kensington/no-self-read-write': 'error',
    'kensington/no-signal-async-write': 'warn',
    'kensington/no-set-on-derived-signal': 'error',
    'kensington/no-new-signal-in-effect': 'error',
    'kensington/no-effect-in-computed': 'error',
    'kensington/no-ignored-effect-return': 'warn',
    'kensington/prefer-value-in-async': 'warn',
    'kensington/no-new-computed-in-effect': 'error',
    'kensington/no-new-signal-in-computed': 'error',
    'kensington/no-unsafe-literal': 'error',
    'kensington/no-new-computed-in-computed': 'warn',
    'kensington/no-effect-in-effect': 'error',
    'kensington/no-async-effect': 'error',
    'kensington/no-async-computed': 'error',
    'kensington/no-out-of-scope-reactive-reference': 'warn',
  },
};

plugin.configs.style = {
  plugins: { kensington: plugin },
  rules: {
    'kensington/prefer-boolean-attribute-true': 'warn',
    'kensington/prefer-camelcase-attrs': 'warn',
    'kensington/prefer-style-object': 'warn',
    'kensington/prefer-nested-attr-groups': 'warn',
    'kensington/prefer-array-for-multiline-content': 'warn',
    'kensington/attrs-on-call-line': 'warn',
    'kensington/attrs-canonical-shape': 'warn',
    'kensington/consistent-content-layout': 'warn',
  },
};

export default plugin;
