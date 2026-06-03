import { RuleTester } from 'eslint';
import rule from '../rules/attrs-on-call-line.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('attrs-on-call-line', rule, {
  valid: [
    `t.div({ class: 'x' });`,
    `t.div({
      class: 'x',
      id: 'y',
    });`,
    // attrs missing entirely — nothing to check
    `t.div('hello');`,
    // not a tag call
    `obj.method(
      { class: 'x' }
    );`,
  ],

  invalid: [
    {
      code: `t.div(
  { class: 'x' }
);`,
      output: `t.div({ class: 'x' });`,
      errors: [
        { messageId: 'attrsMustStartOnCallLine' },
        { messageId: 'attrsMustEndOnCloseParenLine' },
      ],
    },
    {
      code: `t.div(
  {
    class: 'x',
    id: 'y',
  }
);`,
      output: `t.div({
    class: 'x',
    id: 'y',
  });`,
      errors: [
        { messageId: 'attrsMustStartOnCallLine' },
        { messageId: 'attrsMustEndOnCloseParenLine' },
      ],
    },
    // comment between ( and { blocks the auto-fix
    {
      code: `t.div(
  // first
  { class: 'x' });`,
      output: null,
      errors: [{ messageId: 'attrsMustStartOnCallLine' }],
    },

    // close brace on a separate line from the call's )
    {
      code: `t.div({ class: 'x' }
);`,
      output: `t.div({ class: 'x' });`,
      errors: [{ messageId: 'attrsMustEndOnCloseParenLine' }],
    },
    {
      code: `t.div({
  class: 'x',
}
);`,
      output: `t.div({
  class: 'x',
});`,
      errors: [{ messageId: 'attrsMustEndOnCloseParenLine' }],
    },

    // close brace on a separate line from content
    {
      code: `t.div({ class: 'x' }
  , t.p('x'));`,
      output: `t.div({ class: 'x' }, t.p('x'));`,
      errors: [{ messageId: 'attrsMustEndOnContentLine' }],
    },
    {
      code: `t.div({
  class: 'x',
},
[
  t.p('x'),
])`,
      output: `t.div({
  class: 'x',
}, [
  t.p('x'),
])`,
      errors: [{ messageId: 'attrsMustEndOnContentLine' }],
    },

    // both open and close wrong → two reports, two fixes
    {
      code: `t.div(
  { class: 'x' }
)`,
      output: `t.div({ class: 'x' })`,
      errors: [
        { messageId: 'attrsMustStartOnCallLine' },
        { messageId: 'attrsMustEndOnCloseParenLine' },
      ],
    },

    // comment between } and ) blocks the auto-fix on close-brace side
    {
      code: `t.div({ class: 'x' }
  // trailing
)`,
      output: null,
      errors: [{ messageId: 'attrsMustEndOnCloseParenLine' }],
    },
  ],
});
