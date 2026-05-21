import noSetInComputed from './rules/no-set-in-computed.js';
import noSelfReadWrite from './rules/no-self-read-write.js';
import noSignalAsyncWrite from './rules/no-signal-async-write.js';
import noSetOnComputed from './rules/no-set-on-computed.js';
import noNewSignalInEffect from './rules/no-new-signal-in-effect.js';
import noEffectInComputed from './rules/no-effect-in-computed.js';
import noIgnoredEffectReturn from './rules/no-ignored-effect-return.js';
import preferValueInAsync from './rules/prefer-value-in-async.js';
import noNewComputedInEffect from './rules/no-new-computed-in-effect.js';
import noNewSignalInComputed from './rules/no-new-signal-in-computed.js';
import noUnsafeLiteral from './rules/no-unsafe-literal.js';
import noNewComputedInComputed from './rules/no-new-computed-in-computed.js';
import noEffectInEffect from './rules/no-effect-in-effect.js';
import noAsyncEffect from './rules/no-async-effect.js';
import noAsyncComputed from './rules/no-async-computed.js';
import noSetInTransform from './rules/no-set-in-transform.js';
import noSetOnTransform from './rules/no-set-on-transform.js';

const plugin = {
  meta: { name: 'eslint-plugin-kensington' },
  rules: {
    'no-set-in-computed': noSetInComputed,
    'no-self-read-write': noSelfReadWrite,
    'no-signal-async-write': noSignalAsyncWrite,
    'no-set-on-computed': noSetOnComputed,
    'no-new-signal-in-effect': noNewSignalInEffect,
    'no-effect-in-computed': noEffectInComputed,
    'no-ignored-effect-return': noIgnoredEffectReturn,
    'prefer-value-in-async': preferValueInAsync,
    'no-new-computed-in-effect': noNewComputedInEffect,
    'no-new-signal-in-computed': noNewSignalInComputed,
    'no-unsafe-literal': noUnsafeLiteral,
    'no-new-computed-in-computed': noNewComputedInComputed,
    'no-effect-in-effect': noEffectInEffect,
    'no-async-effect': noAsyncEffect,
    'no-async-computed': noAsyncComputed,
    'no-set-in-transform': noSetInTransform,
    'no-set-on-transform': noSetOnTransform,
  },
  configs: {},
};

plugin.configs.recommended = {
  plugins: { kensington: plugin },
  rules: {
    'kensington/no-set-in-computed': 'error',
    'kensington/no-self-read-write': 'error',
    'kensington/no-signal-async-write': 'warn',
    'kensington/no-set-on-computed': 'error',
    'kensington/no-new-signal-in-effect': 'error',
    'kensington/no-effect-in-computed': 'error',
    'kensington/no-ignored-effect-return': 'warn',
    'kensington/prefer-value-in-async': 'warn',
    'kensington/no-new-computed-in-effect': 'error',
    'kensington/no-new-signal-in-computed': 'error',
    'kensington/no-unsafe-literal': 'error',
    'kensington/no-new-computed-in-computed': 'error',
    'kensington/no-effect-in-effect': 'error',
    'kensington/no-async-effect': 'error',
    'kensington/no-async-computed': 'error',
    'kensington/no-set-in-transform': 'error',
    'kensington/no-set-on-transform': 'error',
  },
};

export default plugin;
