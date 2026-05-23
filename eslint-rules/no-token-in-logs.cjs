/**
 * ESLint Rule: no-token-in-logs
 *
 * Blocks `console.{log,info,warn,error,debug,trace}` calls that pass
 * arguments whose identifier (or member-access chain) names a credential.
 *
 * Sensitive identifier substrings (case-insensitive): token, jwt, password,
 * secret, credential.
 *
 * ❌ Bad:
 *   console.log('login', accessToken);
 *   console.info('refresh', { jwt });
 *   console.debug('length', accessToken.length);
 *   console.log(`session: ${refreshToken}`);
 *   console.log('user', user.password);
 *
 * ✅ Good:
 *   console.log('login flow started');
 *   console.info('refresh result', { ok: true });
 *   console.log('user', user.id);
 *
 * If you genuinely need to log a credential-looking name for a non-credential
 * value (e.g., `csrfToken` that is intentionally public), use
 * `// eslint-disable-next-line local-rules/no-token-in-logs` with a comment
 * explaining why.
 */

'use strict';

const SENSITIVE = /token|jwt|password|secret|credential/i;
const CONSOLE_METHODS = new Set(['log', 'info', 'warn', 'error', 'debug', 'trace']);

/**
 * Walks down a MemberExpression / Identifier and returns every name segment
 * encountered. Used to catch both `accessToken` and `accessToken.length`.
 */
function collectNames(node) {
  const names = [];
  let current = node;
  while (current) {
    if (current.type === 'Identifier') {
      names.push(current.name);
      break;
    } else if (current.type === 'MemberExpression') {
      if (current.property && current.property.type === 'Identifier') {
        names.push(current.property.name);
      }
      current = current.object;
    } else {
      break;
    }
  }
  return names;
}

function nodeMentionsCredential(node) {
  if (!node) {
    return false;
  }

  // Identifier or chain like x.y.z
  if (node.type === 'Identifier' || node.type === 'MemberExpression') {
    return collectNames(node).some((name) => SENSITIVE.test(name));
  }

  // Object literal: { jwt, ... } / { token: foo }
  // A property is considered safe even if its key matches the pattern, as
  // long as the value is an obvious boolean-presence check (`!!x`,
  // `Boolean(x)`, or a literal boolean). That lets callers log structured
  // "has-credential" diagnostics without leaking the credential itself.
  if (node.type === 'ObjectExpression') {
    return node.properties.some((prop) => {
      if (prop.type !== 'Property') {
        return false;
      }

      const valueIsBoolean =
        (prop.value.type === 'UnaryExpression' && prop.value.operator === '!' && prop.value.argument.type === 'UnaryExpression' && prop.value.argument.operator === '!') ||
        (prop.value.type === 'CallExpression' && prop.value.callee.type === 'Identifier' && prop.value.callee.name === 'Boolean') ||
        (prop.value.type === 'Literal' && typeof prop.value.value === 'boolean');

      const keyMatches =
        (prop.key.type === 'Identifier' && SENSITIVE.test(prop.key.name)) ||
        (prop.key.type === 'Literal' && typeof prop.key.value === 'string' && SENSITIVE.test(prop.key.value));

      if (keyMatches && !valueIsBoolean) {
        return true;
      }
      if (prop.shorthand && prop.value.type === 'Identifier' && SENSITIVE.test(prop.value.name)) {
        return true;
      }
      if (!valueIsBoolean) {
        return nodeMentionsCredential(prop.value);
      }
      return false;
    });
  }

  // Template literal: `... ${token}`
  if (node.type === 'TemplateLiteral') {
    return node.expressions.some((expr) => nodeMentionsCredential(expr));
  }

  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow logging of identifiers whose names look like credentials',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noTokenInLogs:
        "Avoid logging the identifier '{{ name }}' via console.{{ method }} — names matching /token|jwt|password|secret|credential/i may carry credential values. Either rename the value or use a sanitised log.",
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression') {
          return;
        }
        const callee = node.callee;
        if (callee.object.type !== 'Identifier' || callee.object.name !== 'console') {
          return;
        }
        if (callee.property.type !== 'Identifier' || !CONSOLE_METHODS.has(callee.property.name)) {
          return;
        }

        for (const arg of node.arguments) {
          if (nodeMentionsCredential(arg)) {
            const names = collectNames(arg);
            const offending = names.find((name) => SENSITIVE.test(name)) ?? 'token';
            context.report({
              node: arg,
              messageId: 'noTokenInLogs',
              data: { name: offending, method: callee.property.name },
            });
            // One report per argument — but check all args.
          }
        }
      },
    };
  },
};
