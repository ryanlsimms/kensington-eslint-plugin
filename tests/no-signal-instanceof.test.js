import { RuleTester } from 'eslint';
import rule from '../rules/no-signal-instanceof.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-signal-instanceof', rule, {
  valid: [
    `import { Signal } from 'another-library';
     value instanceof Signal;`,
    `import { isKensingtonSignal } from 'kensington';
     isKensingtonSignal(value);`,
    `class Signal {}
     value instanceof Signal;`,
    `import * as k from 'another-library';
     value instanceof k.Signal;`,
    `import { Signal } from 'kensington';
     function check(Signal) { return value instanceof Signal; }`,
  ],

  invalid: [
    {
      code: `import { Signal } from 'kensington';
             value instanceof Signal;`,
      errors: [{ messageId: 'noSignalInstanceof' }],
    },
    {
      code: `import { Signal as KSignal } from 'kensington';
             value instanceof KSignal;`,
      errors: [{ messageId: 'noSignalInstanceof' }],
    },
    {
      code: `import * as k from 'kensington';
             value instanceof k.Signal;`,
      errors: [{ messageId: 'noSignalInstanceof' }],
    },
    {
      code: `import * as k from 'kensington/reactive';
             value instanceof k['Signal'];`,
      errors: [{ messageId: 'noSignalInstanceof' }],
    },
    {
      code: `import { Signal } from 'kensington/reactive';
             value instanceof Signal;`,
      errors: [{ messageId: 'noSignalInstanceof' }],
    },
  ],
});
