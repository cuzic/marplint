import { describe, expect, it } from 'vitest';
import { missingFontClass } from '../../src/rules/missing-font-class.js';

describe('missing-font-class', () => {
  it('should return no errors for short slides', () => {
    const content = `---
marp: true
---

# Short Slide

- Item 1
- Item 2
`;
    const errors = missingFontClass(content);
    expect(errors).toHaveLength(0);
  });

  it('should suggest font-small for dense slides', () => {
    const lines = Array(20).fill('- List item line content').join('\n');
    const content = `---
marp: true
---

# Title Slide

---

# Dense Slide

${lines}
`;
    const errors = missingFontClass(content, { thresholds: { small: 10, xsmall: 20, xxsmall: 25 } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/missing-font-class');
    expect(errors[0]?.message).toMatch(/font-(small|xsmall|xxsmall)/);
  });

  it('should suggest larger font class for very dense slides', () => {
    const lines = Array(30).fill('- List item with lots of content').join('\n');
    const content = `---
marp: true
---

# Title Slide

---

# Very Dense Slide

${lines}
`;
    const errors = missingFontClass(content, { thresholds: { small: 10, xsmall: 15, xxsmall: 20 } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toMatch(/font-(xsmall|xxsmall)/);
  });

  it('should suggest font-xxsmall for extremely dense slides', () => {
    const lines = Array(35).fill('- List item with content').join('\n');
    const content = `---
marp: true
---

# Title Slide

---

# Extremely Dense Slide

${lines}
`;
    const errors = missingFontClass(content, { thresholds: { small: 10, xsmall: 15, xxsmall: 20 } });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('font-xxsmall');
  });

  it('should return no errors when disabled', () => {
    const lines = Array(30).fill('- List item').join('\n');
    const content = `---
marp: true
---

# Dense Slide

${lines}
`;
    const errors = missingFontClass(content, { enabled: false });
    expect(errors).toHaveLength(0);
  });

  it('should skip frontmatter slide', () => {
    const lines = Array(30).fill('- List item').join('\n');
    const content = `---
marp: true
theme: default
class: lead
${lines}
---

# Normal Slide
`;
    const errors = missingFontClass(content);
    expect(errors).toHaveLength(0);
  });

  it('should respect custom thresholds', () => {
    const lines = Array(15).fill('- List item content').join('\n');
    const content = `---
marp: true
---

# Title

---

# Slide

${lines}
`;
    // With high threshold, should not trigger
    const errorsHigh = missingFontClass(content, { thresholds: { small: 25, xsmall: 30, xxsmall: 35 } });
    expect(errorsHigh).toHaveLength(0);

    // With low threshold, should trigger
    const errorsLow = missingFontClass(content, { thresholds: { small: 5, xsmall: 8, xxsmall: 10 } });
    expect(errorsLow.length).toBeGreaterThan(0);
  });
});
