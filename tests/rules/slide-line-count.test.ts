import { describe, expect, it } from 'vitest';
import { slideLineCount } from '../../src/rules/slide-line-count.js';

describe('slide-line-count', () => {
  it('should return no errors for valid slide', () => {
    const content = `---
marp: true
---

# Title

- Point 1
- Point 2
- Point 3
- Point 4
- Point 5
- Point 6
`;
    const errors = slideLineCount(content);
    expect(errors).toHaveLength(0);
  });

  it('should warn when slide has too many lines', () => {
    const lines = Array.from({ length: 35 }, (_, i) => `- Line ${i + 1}`).join('\n');
    const content = `---
marp: true
---

# Title

---

## Second Slide

${lines}
`;
    const errors = slideLineCount(content);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/slide-line-count');
    expect(errors[0]?.severity).toBe('error');
  });

  it('should warn when slide has too few lines', () => {
    const content = `---
marp: true
---

# Title

---

## Short Slide

One line only
`;
    const errors = slideLineCount(content);
    const fewLineErrors = errors.filter((e) => e.message.includes('only'));
    expect(fewLineErrors.length).toBeGreaterThan(0);
    expect(fewLineErrors[0]?.severity).toBe('warning');
  });

  it('should respect custom maxLines config', () => {
    const lines = Array.from({ length: 15 }, (_, i) => `- Line ${i + 1}`).join('\n');
    const content = `---
marp: true
---

# Title

---

## Second Slide

${lines}
`;
    const errors = slideLineCount(content, { maxLines: 10 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should return no errors when disabled', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `- Line ${i + 1}`).join('\n');
    const content = `---
marp: true
---

# Title

${lines}
`;
    const errors = slideLineCount(content, { enabled: false });
    expect(errors).toHaveLength(0);
  });
});
