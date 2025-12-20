import { describe, expect, it } from 'vitest';
import { duplicateContent } from '../../src/rules/duplicate-content.js';

describe('duplicate-content', () => {
  it('should return no errors for unique slides', () => {
    const content = `---
marp: true
---

# Slide 1

This is unique content for slide one.

---

# Slide 2

This is different content for slide two.
`;
    const errors = duplicateContent(content);
    expect(errors).toHaveLength(0);
  });

  it('should detect duplicate slides', () => {
    const content = `---
marp: true
---

# Slide 1

This is the content that will be duplicated in another slide later.

---

# Slide 2

This is the content that will be duplicated in another slide later.
`;
    const errors = duplicateContent(content, { similarityThreshold: 0.8, minContentLength: 20 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/duplicate-content');
    expect(errors[0]?.message).toContain('similar');
  });

  it('should detect similar slides above threshold', () => {
    const content = `---
marp: true
---

# Introduction

- Point A about the topic
- Point B about the topic
- Point C about the topic

---

# Summary

- Point A about the topic
- Point B about the topic
- Point C about the topic
`;
    const errors = duplicateContent(content, { similarityThreshold: 0.7, minContentLength: 30 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('%');
  });

  it('should return no errors when disabled', () => {
    const content = `---
marp: true
---

# Slide 1

Duplicate content here.

---

# Slide 2

Duplicate content here.
`;
    const errors = duplicateContent(content, { enabled: false });
    expect(errors).toHaveLength(0);
  });

  it('should ignore short content', () => {
    const content = `---
marp: true
---

# A

Hi

---

# B

Hi
`;
    const errors = duplicateContent(content, { minContentLength: 50 });
    expect(errors).toHaveLength(0);
  });

  it('should respect custom similarity threshold', () => {
    const content = `---
marp: true
---

# Slide 1

The quick brown fox jumps over the lazy dog.

---

# Slide 2

The quick brown fox jumps over the lazy cat.
`;
    // High threshold should not trigger
    const errorsHigh = duplicateContent(content, { similarityThreshold: 0.95, minContentLength: 20 });
    expect(errorsHigh).toHaveLength(0);

    // Low threshold should trigger
    const errorsLow = duplicateContent(content, { similarityThreshold: 0.5, minContentLength: 20 });
    expect(errorsLow.length).toBeGreaterThan(0);
  });
});
