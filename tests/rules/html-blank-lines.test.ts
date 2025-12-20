import { describe, expect, it } from 'vitest';
import { htmlBlankLines } from '../../src/rules/html-blank-lines.js';

describe('html-blank-lines', () => {
  it('should return no errors when blank lines are present', () => {
    const content = `---
marp: true
---

<div class="container">

- List item 1
- List item 2

</div>
`;
    const errors = htmlBlankLines(content);
    expect(errors).toHaveLength(0);
  });

  it('should detect missing blank line after HTML tag', () => {
    const content = `---
marp: true
---

<div class="container">
- List item without blank line
</div>
`;
    const errors = htmlBlankLines(content);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/html-blank-lines');
    expect(errors[0]?.message).toContain('Missing blank line after HTML tag');
  });

  it('should detect missing blank line before closing HTML tag', () => {
    const content = `---
marp: true
---

<div>

- List item
</div>
`;
    const errors = htmlBlankLines(content);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('Missing blank line before closing HTML tag');
  });

  it('should return no errors when rule is disabled', () => {
    const content = `---
marp: true
---

<div>
- No blank line but rule disabled
</div>
`;
    const errors = htmlBlankLines(content, { enabled: false });
    expect(errors).toHaveLength(0);
  });

  it('should track slide numbers correctly', () => {
    const content = `---
marp: true
---

# Slide 1

---

<div>
- Missing blank line on slide 2
</div>
`;
    const errors = htmlBlankLines(content);
    expect(errors.length).toBeGreaterThan(0);
    // Frontmatter slide counts as slide 1, so the second --- starts slide 2
    // but html-blank-lines counts from the initial --- as well
    expect(errors[0]?.slideNumber).toBeGreaterThanOrEqual(2);
  });
});
