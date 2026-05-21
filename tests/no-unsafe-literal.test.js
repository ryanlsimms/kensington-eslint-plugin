import { RuleTester } from 'eslint';
import rule from '../rules/no-unsafe-literal.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('no-unsafe-literal', rule, {
  valid: [
    // .literal() is the safe alternative — allowed
    `import { t } from 'kensington';
     t.literal('<p>hello</p>');`,

    // unrelated method call
    `import { t } from 'kensington';
     t.div({ class: 'foo' });`,
  ],

  invalid: [
    // .unsafeLiteral() on the default t instance
    {
      code: `import { t } from 'kensington';
             t.unsafeLiteral('<script>alert(1)</script>');`,
      errors: [{ messageId: 'noUnsafeLiteral' }],
    },

    // .unsafeLiteral() on a custom Kensington instance
    {
      code: `import Kensington from 'kensington';
             const k = new Kensington();
             k.unsafeLiteral(userInput);`,
      errors: [{ messageId: 'noUnsafeLiteral' }],
    },

    // .unsafeLiteral() on any object — method name is unique to kensington
    {
      code: `renderer.unsafeLiteral(html);`,
      errors: [{ messageId: 'noUnsafeLiteral' }],
    },
  ],
});
