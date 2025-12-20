import { describe, expect, it } from 'vitest';
import { slideContentDensity } from '../../src/rules/slide-content-density.js';

describe('slide-content-density', () => {
  it('should return no errors for slides with low density', () => {
    const content = `---
marp: true
---

# Simple Slide

- Item 1
- Item 2
`;
    const errors = slideContentDensity(content);
    expect(errors).toHaveLength(0);
  });

  it('should detect slides with too many characters', () => {
    const longText = 'x'.repeat(1000);
    const content = `---
marp: true
---

# Slide 1

---

# Dense Slide

${longText}
`;
    const errors = slideContentDensity(content, { maxCharacters: 800 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/slide-content-density');
    expect(errors[0]?.message).toContain('characters');
  });

  it('should detect slides with too many list items', () => {
    const items = Array(20).fill('- List item').join('\n');
    const content = `---
marp: true
---

# Slide 1

---

# Many Items

${items}
`;
    const errors = slideContentDensity(content, { maxListItems: 15 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('list items');
  });

  it('should return no errors when rule is disabled', () => {
    const longText = 'x'.repeat(2000);
    const content = `---
marp: true
---

${longText}
`;
    const errors = slideContentDensity(content, { enabled: false });
    expect(errors).toHaveLength(0);
  });

  it('should skip frontmatter slide', () => {
    const longText = 'x'.repeat(1000);
    const content = `---
marp: true
theme: default
class: lead
${longText}
---

# Normal slide
`;
    // First slide with frontmatter should be skipped
    const errors = slideContentDensity(content, { maxCharacters: 100 });
    expect(errors).toHaveLength(0);
  });
});
