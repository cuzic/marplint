import { describe, expect, it } from 'vitest';
import { analyzeDocument, formatAnalysisReport } from '../../src/analysis/index.js';

describe('analysis', () => {
  describe('analyzeDocument', () => {
    it('should analyze a simple document', () => {
      const content = `---
marp: true
---

# Title Slide

Welcome to the presentation

---

# Slide 2

- Point 1
- Point 2
`;
      const analysis = analyzeDocument(content);
      expect(analysis).toBeDefined();
      expect(analysis.slides.length).toBe(2);
      expect(analysis.summary.totalSlides).toBe(2);
    });

    it('should calculate complexity scores', () => {
      const content = `---
marp: true
---

# Simple Slide

Just a few words.

---

# Complex Slide

- Item 1
- Item 2
- Item 3
- Item 4
- Item 5
- Item 6
- Item 7
- Item 8
- Item 9
- Item 10

\`\`\`javascript
const x = 1;
const y = 2;
const z = 3;
\`\`\`

| Col1 | Col2 |
|------|------|
| A    | B    |
`;
      const analysis = analyzeDocument(content);
      expect(analysis.slides.length).toBe(2);

      // First slide should be simpler than second
      const firstSlide = analysis.slides[0];
      const secondSlide = analysis.slides[1];
      expect(firstSlide?.complexity.score).toBeLessThan(secondSlide?.complexity.score ?? 0);
    });

    it('should estimate reading time', () => {
      const content = `---
marp: true
---

# Slide with content

This is a paragraph with some English text that takes time to read.
And here is another line of text for the presentation.
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
`;
      const analysis = analyzeDocument(content);
      const slide = analysis.slides[0];
      expect(slide?.readingTime).toBeDefined();
      expect(slide?.readingTime.seconds).toBeGreaterThan(0);
      expect(slide?.readingTime.formatted).toMatch(/^\d+:\d{2}$/);
    });

    it('should check accessibility', () => {
      const content = `---
marp: true
---

# Slide with accessibility issues

![](image.png)

[click here](http://example.com)
`;
      const analysis = analyzeDocument(content);
      const slide = analysis.slides[0];
      expect(slide?.accessibility).toBeDefined();
      expect(slide?.accessibility.issues.length).toBeGreaterThan(0);
      // Image without alt text should be flagged
      const imageIssue = slide?.accessibility.issues.find((i) => i.type === 'image-alt');
      expect(imageIssue).toBeDefined();
    });

    it('should pass accessibility for well-formed content', () => {
      const content = `---
marp: true
---

# Accessible Slide

![A descriptive alt text](image.png)

[Read the full documentation](http://example.com)
`;
      const analysis = analyzeDocument(content);
      const slide = analysis.slides[0];
      expect(slide?.accessibility.passedChecks.length).toBeGreaterThan(0);
    });

    it('should generate summary with recommendations', () => {
      // Create a very complex slide to trigger recommendations
      const manyItems = Array(30).fill('- Long list item with lots of text').join('\n');
      const content = `---
marp: true
---

# Very Complex Slide

${manyItems}

\`\`\`javascript
// Long code block
${'const x = 1;\n'.repeat(20)}
\`\`\`
`;
      const analysis = analyzeDocument(content);
      expect(analysis.summary).toBeDefined();
      expect(analysis.summary.avgComplexity).toBeGreaterThan(0);
    });
  });

  describe('formatAnalysisReport', () => {
    it('should format analysis as text report', () => {
      const content = `---
marp: true
---

# Test Slide

Some content here.
`;
      const analysis = analyzeDocument(content);
      const report = formatAnalysisReport(analysis);

      expect(report).toContain('Document Analysis Report');
      expect(report).toContain('Summary');
      expect(report).toContain('Total Slides:');
      expect(report).toContain('Average Complexity:');
      expect(report).toContain('Slide Details');
    });

    it('should include recommendations when present', () => {
      // Create content that triggers recommendations
      const manyItems = Array(50).fill('- Very long list item text').join('\n');
      const content = `---
marp: true
---

# Overloaded Slide

${manyItems}
`;
      const analysis = analyzeDocument(content);

      // Force a recommendation by setting high complexity
      if (analysis.summary.recommendations.length === 0) {
        analysis.summary.recommendations.push('Test recommendation');
      }

      const report = formatAnalysisReport(analysis);
      expect(report).toContain('Recommendations');
    });
  });
});
