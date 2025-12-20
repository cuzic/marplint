import { describe, expect, it } from 'vitest';
import { headingHierarchy } from '../../src/rules/heading-hierarchy.js';

describe('heading-hierarchy', () => {
  it('should return no errors for proper hierarchy', () => {
    const content = `---
marp: true
---

# Title

---

## Section 1

### Subsection 1.1

---

## Section 2
`;
    const errors = headingHierarchy(content);
    expect(errors).toHaveLength(0);
  });

  it('should detect skipped heading levels', () => {
    const content = `---
marp: true
---

# Title

---

## Section

#### Skipped H3

This goes directly from H2 to H4.
`;
    const errors = headingHierarchy(content);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/heading-hierarchy');
    expect(errors[0]?.message).toContain('jumped');
  });

  it('should warn about H1 in non-title slides', () => {
    const content = `---
marp: true
---

# Title

---

# Another H1 in second slide
`;
    const errors = headingHierarchy(content, { allowH1InSlides: false });
    const h1Errors = errors.filter((e) => e.message.includes('H1 should only'));
    expect(h1Errors.length).toBeGreaterThan(0);
  });

  it('should allow H1 in slides when configured', () => {
    const content = `---
marp: true
---

# Title

---

# Another H1 in second slide
`;
    const errors = headingHierarchy(content, { allowH1InSlides: true });
    const h1Errors = errors.filter((e) => e.message.includes('H1 should only'));
    expect(h1Errors).toHaveLength(0);
  });

  it('should ignore headings in code blocks', () => {
    const content = `---
marp: true
---

# Title

\`\`\`markdown
### This is in a code block
\`\`\`
`;
    const errors = headingHierarchy(content);
    expect(errors).toHaveLength(0);
  });

  it('should return no errors when disabled', () => {
    const content = `---
marp: true
---

# Title

---

### Skipped H2
`;
    const errors = headingHierarchy(content, { enabled: false });
    expect(errors).toHaveLength(0);
  });
});
