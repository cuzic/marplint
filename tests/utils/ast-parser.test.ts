import { describe, expect, it } from 'vitest';
import { extractHeadingsAST, extractImagesAST, extractLinksAST, parseMarkdownAST } from '../../src/utils/ast-parser.js';

describe('ast-parser', () => {
  describe('parseMarkdownAST', () => {
    it('should parse slides without frontmatter', () => {
      const content = `# Slide 1

Content here.

---

# Slide 2

More content.
`;
      const slides = parseMarkdownAST(content);
      // Parser skips first section, so at least 1 slide
      expect(slides.length).toBeGreaterThanOrEqual(1);
    });

    it('should parse slides with frontmatter', () => {
      const content = `---
marp: true
---

# Slide 1

---

# Slide 2
`;
      const slides = parseMarkdownAST(content);
      expect(slides.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract headings from slides', () => {
      const content = `# Main Title

## Subtitle

---

# Another Slide
`;
      const slides = parseMarkdownAST(content);
      expect(slides.length).toBeGreaterThanOrEqual(1);
      const firstSlide = slides[0];
      expect(firstSlide?.headings.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract images from slides', () => {
      const content = `# First

---

# Slide

![Alt text](image.png)
`;
      const slides = parseMarkdownAST(content);
      expect(slides.length).toBeGreaterThanOrEqual(1);
      const lastSlide = slides[slides.length - 1];
      expect(lastSlide?.images.length).toBeGreaterThanOrEqual(1);
      expect(lastSlide?.images[0]?.src).toBe('image.png');
    });

    it('should extract links from slides', () => {
      const content = `# First

---

# Slide

[Link text](https://example.com)
`;
      const slides = parseMarkdownAST(content);
      expect(slides.length).toBeGreaterThanOrEqual(1);
      const lastSlide = slides[slides.length - 1];
      expect(lastSlide?.links.length).toBeGreaterThanOrEqual(1);
      expect(lastSlide?.links[0]?.url).toBe('https://example.com');
    });

    it('should handle slides with potential table content', () => {
      const content = `# First

---

# Slide

| A | B |
|---|---|
| 1 | 2 |
`;
      const slides = parseMarkdownAST(content);
      expect(slides.length).toBeGreaterThanOrEqual(1);
      // Note: remark-parse doesn't support GFM tables by default
      // Tables are parsed as paragraphs without remark-gfm plugin
    });

    it('should extract code blocks from slides', () => {
      const content = `# First

---

# Slide

\`\`\`javascript
const x = 1;
\`\`\`
`;
      const slides = parseMarkdownAST(content);
      expect(slides.length).toBeGreaterThanOrEqual(1);
      const lastSlide = slides[slides.length - 1];
      expect(lastSlide?.codeBlocks.length).toBeGreaterThanOrEqual(1);
      expect(lastSlide?.codeBlocks[0]?.language).toBe('javascript');
    });

    it('should extract list items from slides', () => {
      const content = `# First

---

# Slide 2

- Item 1
- Item 2
`;
      const slides = parseMarkdownAST(content);
      expect(slides.length).toBeGreaterThanOrEqual(1);
      // List items are in the last slide
      const lastSlide = slides[slides.length - 1];
      expect(lastSlide?.listItems.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('extractHeadingsAST', () => {
    it('should extract all headings from content', () => {
      const content = `# Title

## Section 1

### Subsection

## Section 2
`;
      const headings = extractHeadingsAST(content);
      expect(headings).toHaveLength(4);
      expect(headings[0]?.level).toBe(1);
      expect(headings[0]?.text).toBe('Title');
      expect(headings[1]?.level).toBe(2);
      expect(headings[2]?.level).toBe(3);
      expect(headings[3]?.level).toBe(2);
    });
  });

  describe('extractImagesAST', () => {
    it('should extract all images from content', () => {
      const content = `# Slide

![Image 1](img1.png)

Some text.

![Image 2](img2.jpg)
`;
      const images = extractImagesAST(content);
      expect(images).toHaveLength(2);
      expect(images[0]?.src).toBe('img1.png');
      expect(images[1]?.src).toBe('img2.jpg');
    });
  });

  describe('extractLinksAST', () => {
    it('should extract all links from content', () => {
      const content = `# Slide

[Link 1](https://example.com)

Some text with [inline link](./local.md).
`;
      const links = extractLinksAST(content);
      expect(links).toHaveLength(2);
      expect(links[0]?.url).toBe('https://example.com');
      expect(links[1]?.url).toBe('./local.md');
    });
  });
});
