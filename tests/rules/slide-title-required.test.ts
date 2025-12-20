import { describe, expect, it } from 'vitest';
import { slideTitleRequired } from '../../src/rules/slide-title-required.js';

describe('slide-title-required', () => {
  it('should return no errors when all slides have titles', () => {
    const content = `---
marp: true
---

# First Slide

Content here.

---

## Second Slide

More content.

---

### Third Slide

Even more content.
`;
    const errors = slideTitleRequired(content);
    expect(errors).toHaveLength(0);
  });

  it('should detect slides without titles', () => {
    const content = `---
marp: true
---

# First Slide

Content here.

---

Content without a title.

---

## Third Slide

More content.
`;
    const errors = slideTitleRequired(content);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/slide-title-required');
    expect(errors[0]?.slideNumber).toBe(2);
    expect(errors[0]?.message).toContain('No title');
  });

  it('should return no errors when disabled', () => {
    const content = `---
marp: true
---

# First Slide

---

No title here.
`;
    const errors = slideTitleRequired(content, { enabled: false });
    expect(errors).toHaveLength(0);
  });

  it('should respect allowedLevels config', () => {
    const content = `---
marp: true
---

# First Slide

---

#### Only H4 heading

Content.
`;
    // H4 not in allowed levels
    const errorsStrict = slideTitleRequired(content, { allowedLevels: [1, 2, 3] });
    expect(errorsStrict.length).toBeGreaterThan(0);

    // H4 in allowed levels
    const errorsRelaxed = slideTitleRequired(content, { allowedLevels: [1, 2, 3, 4] });
    expect(errorsRelaxed).toHaveLength(0);
  });

  it('should skip specified slides', () => {
    const content = `---
marp: true
---

# First Slide

---

No title (divider slide).

---

## Third Slide
`;
    const errors = slideTitleRequired(content, { skipSlides: [2] });
    expect(errors).toHaveLength(0);
  });

  it('should always skip first slide', () => {
    const content = `---
marp: true
---

Content without heading on first slide.

---

## Second Slide
`;
    const errors = slideTitleRequired(content);
    expect(errors).toHaveLength(0);
  });

  it('should detect multiple slides without titles', () => {
    const content = `---
marp: true
---

# First Slide

---

No title.

---

Also no title.

---

## Last Slide
`;
    const errors = slideTitleRequired(content);
    expect(errors).toHaveLength(2);
    expect(errors[0]?.slideNumber).toBe(2);
    expect(errors[1]?.slideNumber).toBe(3);
  });
});
