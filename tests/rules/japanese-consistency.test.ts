import { describe, expect, it } from 'vitest';
import { japaneseConsistency } from '../../src/rules/japanese-consistency.js';

describe('japanese-consistency', () => {
  it('should return no errors for consistent text', () => {
    const content = `---
marp: true
---

# 日本語スライド

- これは正しい日本語です
- 半角数字を使用: 123
`;
    const errors = japaneseConsistency(content);
    expect(errors).toHaveLength(0);
  });

  it('should detect full-width numbers', () => {
    const content = `---
marp: true
---

# スライド１

- 項目１２３
`;
    const errors = japaneseConsistency(content, { preferFullWidthNumbers: false });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/japanese-consistency');
    expect(errors[0]?.message).toContain('Full-width numbers');
  });

  it('should detect full-width alphabets', () => {
    const content = `---
marp: true
---

# スライド

- ＡＢＣテスト
`;
    const errors = japaneseConsistency(content, { preferFullWidthAlphabets: false });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('Full-width alphabets');
  });

  it('should detect mixed punctuation', () => {
    const content = `---
marp: true
---

# 混在

- これは、テストです.
`;
    const errors = japaneseConsistency(content, { checkPunctuation: true });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('Mixed');
    expect(errors[0]?.message).toContain('punctuation');
  });

  it('should detect mixed parentheses', () => {
    const content = `---
marp: true
---

# 括弧

- 日本語（テスト）と(半角)
`;
    const errors = japaneseConsistency(content, { checkParentheses: true });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('parentheses');
  });

  it('should return no errors when disabled', () => {
    const content = `---
marp: true
---

# スライド１２３

- ＡＢＣテスト、です.
`;
    const errors = japaneseConsistency(content, { enabled: false });
    expect(errors).toHaveLength(0);
  });

  it('should ignore code blocks and URLs', () => {
    const content = `---
marp: true
---

# Test

- \`１２３\` in code
- https://example.com/１２３
`;
    const errors = japaneseConsistency(content);
    expect(errors).toHaveLength(0);
  });

  it('should skip comment lines', () => {
    const content = `---
marp: true
---

# Test

<!-- １２３ comment -->

- Normal text
`;
    const errors = japaneseConsistency(content);
    expect(errors).toHaveLength(0);
  });
});
