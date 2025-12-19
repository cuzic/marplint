import { describe, it, expect } from 'vitest';
import {
  parseSlides,
  countContentLines,
  countCharacters,
  countListItems,
  hasFontClass,
  getFontClassLevel
} from '../../src/utils/slide-parser.js';

describe('parseSlides', () => {
  it('should parse a simple document with frontmatter', () => {
    const content = `---
marp: true
---

# Title

---

## Second Slide
`;
    const result = parseSlides(content);
    expect(result.slides).toHaveLength(2);
    expect(result.frontmatter).toBeDefined();
    expect(result.slides[0]?.hasFrontmatter).toBe(true);
    expect(result.slides[1]?.hasFrontmatter).toBe(false);
  });

  it('should correctly number slides', () => {
    const content = `---
marp: true
---

# Slide 1

---

## Slide 2

---

## Slide 3
`;
    const result = parseSlides(content);
    expect(result.slides).toHaveLength(3);
    expect(result.slides[0]?.slideNumber).toBe(1);
    expect(result.slides[1]?.slideNumber).toBe(2);
    expect(result.slides[2]?.slideNumber).toBe(3);
  });

  it('should extract content lines correctly', () => {
    const content = `---
marp: true
---

# Title

- Item 1
- Item 2
- Item 3
`;
    const result = parseSlides(content);
    expect(result.slides[0]?.contentLines.length).toBe(4); // Title + 3 items
  });
});

describe('countContentLines', () => {
  it('should count non-empty content lines', () => {
    const content = `---
marp: true
---

# Title

- Item 1
- Item 2
`;
    const result = parseSlides(content);
    const count = countContentLines(result.slides[0]!);
    expect(count).toBe(3);
  });
});

describe('countCharacters', () => {
  it('should count characters excluding whitespace', () => {
    const content = `---
marp: true
---

Hello World
`;
    const result = parseSlides(content);
    const count = countCharacters(result.slides[0]!);
    expect(count).toBe(10); // "HelloWorld" without space
  });
});

describe('countListItems', () => {
  it('should count list items', () => {
    const content = `---
marp: true
---

# Title

- Item 1
- Item 2
* Item 3
1. Item 4
`;
    const result = parseSlides(content);
    const count = countListItems(result.slides[0]!);
    expect(count).toBe(4);
  });
});

describe('hasFontClass', () => {
  it('should detect font class in directive', () => {
    const content = `---
marp: true
---

<!-- _class: font-small -->

# Title
`;
    const result = parseSlides(content);
    expect(hasFontClass(result.slides[0]!)).toBe(true);
  });

  it('should return false when no font class', () => {
    const content = `---
marp: true
---

# Title
`;
    const result = parseSlides(content);
    expect(hasFontClass(result.slides[0]!)).toBe(false);
  });
});

describe('getFontClassLevel', () => {
  it('should return correct level for font classes', () => {
    const testCases = [
      { directive: 'font-small', expected: 1 },
      { directive: 'font-xsmall', expected: 2 },
      { directive: 'font-xxsmall', expected: 3 },
      { directive: 'other', expected: 0 },
    ];

    for (const { directive, expected } of testCases) {
      const content = `---
marp: true
---

<!-- _class: ${directive} -->

# Title
`;
      const result = parseSlides(content);
      expect(getFontClassLevel(result.slides[0]!)).toBe(expected);
    }
  });
});
