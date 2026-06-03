import { RuleTester } from 'eslint';
import rule from '../rules/attrs-canonical-shape.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('attrs-canonical-shape', rule, {
  valid: [
    // inline
    `t.div({ class: 'x', id: 'y' });`,

    // canonical stacked
    `t.div({
      class: 'x',
      id: 'y',
    });`,

    // single property, either form
    `t.div({ class: 'x' });`,
    `t.div({
      class: 'x',
    });`,

    // empty
    `t.div({});`,

    // not a tag call
    `obj.method({ a: 1,
      b: 2 });`,

    // a prop value spans lines but each outer prop is on its own line
    `t.div({
      style: {
        color: 'red',
      },
      class: 'x',
    });`,
  ],

  invalid: [
    {
      code: `t.div({ class: 'x',
  id: 'y',
});`,
      output: `t.div({
  class: 'x',
  id: 'y',
});`,
      errors: [{ messageId: 'openBraceMustEndLine' }],
    },
    {
      code: `t.div({
  class: 'x',
  id: 'y' });`,
      output: `t.div({
  class: 'x',
  id: 'y',
});`,
      errors: [{ messageId: 'closeBraceMustStartLine' }],
    },
    {
      code: `t.div({
  class: 'x', id: 'y',
  role: 'button',
});`,
      output: `t.div({
  class: 'x',
  id: 'y',
  role: 'button',
});`,
      errors: [{ messageId: 'mixedLayout' }],
    },
    {
      code: `  t.div({ class: 'x',
    id: 'y',
  });`,
      output: `  t.div({
    class: 'x',
    id: 'y',
  });`,
      errors: [{ messageId: 'openBraceMustEndLine' }],
    },
  ],
});
