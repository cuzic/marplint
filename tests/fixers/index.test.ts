import { describe, expect, it } from 'vitest';
import { applyFixes, getFixableRules } from '../../src/fixers/index.js';
import type { LintError } from '../../src/rules/slide-line-count.js';

describe('fixers', () => {
  describe('getFixableRules', () => {
    it('should return list of fixable rules', () => {
      const rules = getFixableRules();
      expect(rules).toContain('marp/html-blank-lines');
      expect(rules).toContain('marp/missing-font-class');
      expect(rules).toContain('marp/heading-hierarchy');
    });
  });

  describe('applyFixes', () => {
    it('should return original content when no errors', () => {
      const content = '# Hello World';
      const { fixedContent, results } = applyFixes(content, []);
      expect(fixedContent).toBe(content);
      expect(results).toHaveLength(0);
    });

    it('should ignore non-fixable errors', () => {
      const content = '# Hello World';
      const errors: LintError[] = [
        {
          ruleId: 'marp/slide-line-count',
          slideNumber: 1,
          lineNumber: 1,
          message: 'Too many lines',
          severity: 'warning'
        }
      ];
      const { fixedContent, results } = applyFixes(content, errors);
      expect(fixedContent).toBe(content);
      expect(results).toHaveLength(0);
    });
  });

  describe('fixHtmlBlankLines', () => {
    it('should add blank line after HTML tag', () => {
      // The fixer checks if the next line is markdown content and not empty
      const content = `---
marp: true
---

<div class="container">
- List item
</div>
`;
      const errors: LintError[] = [
        {
          ruleId: 'marp/html-blank-lines',
          slideNumber: 1,
          lineNumber: 5,
          message: 'Missing blank line after HTML tag "<div class="container"..." before Markdown content',
          severity: 'error'
        }
      ];
      const { results } = applyFixes(content, errors);
      // The fixer adds a blank line after the HTML tag
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.description).toContain('Added blank line');
    });

    it('should handle content without needing fixes gracefully', () => {
      // Test content where the previous line is empty (no fix needed)
      const content = `---
marp: true
---

<div>

- List item
</div>
`;
      const errors: LintError[] = [
        {
          ruleId: 'marp/html-blank-lines',
          slideNumber: 1,
          lineNumber: 7,
          message: 'Missing blank line before closing HTML tag "</div>" after Markdown content',
          severity: 'error'
        }
      ];
      const { fixedContent } = applyFixes(content, errors);
      // The fixer checks if prevLine is not empty and not HTML
      // In this case, line 6 (before line 7) is empty, so no fix is applied
      expect(fixedContent).toBeDefined();
    });
  });

  describe('fixHeadingHierarchy', () => {
    it('should convert H1 to H2 in non-title slides', () => {
      const content = `---
marp: true
---

# Title

---

# Should be H2
`;
      const errors: LintError[] = [
        {
          ruleId: 'marp/heading-hierarchy',
          slideNumber: 2,
          lineNumber: 9,
          message: 'H1 should only be used on the title slide',
          severity: 'error'
        }
      ];
      const { fixedContent, results } = applyFixes(content, errors);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.description).toBe('Converted H1 to H2');
      expect(fixedContent).toContain('## Should be H2');
    });
  });

  describe('fixMissingFontClass', () => {
    it('should add font-small directive', () => {
      const content = `---
marp: true
---

# Slide with many lines
`;
      const errors: LintError[] = [
        {
          ruleId: 'marp/missing-font-class',
          slideNumber: 1,
          lineNumber: 5,
          message: 'Slide 1 has 20 lines. Consider using "font-small" class.',
          severity: 'warning'
        }
      ];
      const { fixedContent, results } = applyFixes(content, errors);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.description).toContain('font-small');
      expect(fixedContent).toContain('<!-- _class: font-small -->');
    });

    it('should add font-xsmall directive when suggested', () => {
      const errors: LintError[] = [
        {
          ruleId: 'marp/missing-font-class',
          slideNumber: 1,
          lineNumber: 5,
          message: 'Slide 1 has 25 lines. Consider using "font-xsmall" class.',
          severity: 'warning'
        }
      ];
      const content = `---
marp: true
---

# Dense slide
`;
      const { fixedContent, results } = applyFixes(content, errors);
      expect(results.length).toBeGreaterThan(0);
      expect(fixedContent).toContain('<!-- _class: font-xsmall -->');
    });
  });
});
