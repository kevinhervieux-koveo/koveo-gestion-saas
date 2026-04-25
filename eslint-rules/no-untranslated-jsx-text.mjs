/**
 * Custom ESLint rule: flag JSX text literals >30 chars that are not wrapped in t().
 *
 * Detects:
 *   1. Direct JSXText whose trimmed content exceeds 30 chars and contains letters.
 *   2. JSXExpressionContainer whose expression is a string Literal exceeding 30 chars.
 *
 * Skips:
 *   - Whitespace / numeric-only / punctuation-only content.
 *   - Text inside <code> or <pre> elements.
 */
const noUntranslatedJsxText = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow JSX text literals over 30 characters that are not wrapped in t()',
    },
    messages: {
      untranslated:
        'JSX text "{{ text }}" exceeds 30 characters and must be wrapped in t() for i18n.',
    },
    schema: [],
  },
  create(context) {
    const isTextElement = (node) => {
      let current = node?.parent;
      while (current) {
        if (current.type === 'JSXElement') {
          const opening = current.openingElement?.name;
          if (opening && opening.type === 'JSXIdentifier') {
            const name = opening.name.toLowerCase();
            if (name === 'code' || name === 'pre') return true;
          }
        }
        current = current.parent;
      }
      return false;
    };

    const shouldFlag = (raw) => {
      if (typeof raw !== 'string') return false;
      const trimmed = raw.replace(/\s+/g, ' ').trim();
      if (trimmed.length <= 30) return false;
      if (!/[A-Za-zÀ-ÿ]/.test(trimmed)) return false;
      return true;
    };

    const preview = (raw) => raw.replace(/\s+/g, ' ').trim().slice(0, 60);

    return {
      JSXText(node) {
        if (!shouldFlag(node.value)) return;
        if (isTextElement(node)) return;
        context.report({
          node,
          messageId: 'untranslated',
          data: { text: preview(node.value) },
        });
      },
      JSXExpressionContainer(node) {
        const parentType = node.parent?.type;
        if (parentType !== 'JSXElement' && parentType !== 'JSXFragment') return;
        const expr = node.expression;
        if (
          expr &&
          expr.type === 'Literal' &&
          typeof expr.value === 'string' &&
          shouldFlag(expr.value)
        ) {
          if (isTextElement(node)) return;
          context.report({
            node,
            messageId: 'untranslated',
            data: { text: preview(expr.value) },
          });
        }
      },
    };
  },
};

export default {
  rules: {
    'no-untranslated-jsx-text': noUntranslatedJsxText,
  },
};
