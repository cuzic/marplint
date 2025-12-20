/**
 * Auto-fix functionality for marplint
 */

import type { LintError } from '../rules/slide-line-count.js';

export interface FixResult {
  ruleId: string;
  slideNumber: number;
  lineNumber: number;
  description: string;
  applied: boolean;
}

export interface FixerContext {
  content: string;
  lines: string[];
  errors: LintError[];
}

/**
 * Apply all available fixes to content
 */
export function applyFixes(
  content: string,
  errors: LintError[]
): {
  fixedContent: string;
  results: FixResult[];
} {
  let fixedContent = content;
  const results: FixResult[] = [];

  // Group errors by type
  const errorsByRule = new Map<string, LintError[]>();
  for (const error of errors) {
    const existing = errorsByRule.get(error.ruleId) ?? [];
    existing.push(error);
    errorsByRule.set(error.ruleId, existing);
  }

  // Apply fixes in order (some fixes depend on line positions)
  const fixers: Array<{
    ruleId: string;
    fix: (content: string, errors: LintError[]) => { content: string; results: FixResult[] };
  }> = [
    { ruleId: 'marp/html-blank-lines', fix: fixHtmlBlankLines },
    { ruleId: 'marp/missing-font-class', fix: fixMissingFontClass },
    { ruleId: 'marp/heading-hierarchy', fix: fixHeadingHierarchy }
  ];

  for (const fixer of fixers) {
    const ruleErrors = errorsByRule.get(fixer.ruleId);
    if (ruleErrors && ruleErrors.length > 0) {
      const { content: newContent, results: fixResults } = fixer.fix(fixedContent, ruleErrors);
      fixedContent = newContent;
      results.push(...fixResults);
    }
  }

  return { fixedContent, results };
}

/**
 * Fix: Add blank lines around HTML tags
 */
function fixHtmlBlankLines(
  content: string,
  errors: LintError[]
): {
  content: string;
  results: FixResult[];
} {
  const lines = content.split('\n');
  const results: FixResult[] = [];
  const insertions: Array<{ lineIndex: number; type: 'before' | 'after' }> = [];

  for (const error of errors) {
    const lineIndex = error.lineNumber - 1;
    const _line = lines[lineIndex] ?? '';
    const prevLine = lines[lineIndex - 1] ?? '';
    const nextLine = lines[lineIndex + 1] ?? '';

    // Check if we need to add blank line before
    if (error.message.includes('before closing HTML')) {
      if (prevLine.trim() !== '' && !prevLine.trim().startsWith('<') && !prevLine.trim().startsWith('<!--')) {
        insertions.push({ lineIndex, type: 'before' });
      }
    }

    // Check if we need to add blank line after
    if (error.message.includes('after HTML tag')) {
      if (nextLine.trim() !== '' && !nextLine.trim().startsWith('<') && !nextLine.trim().startsWith('<!--')) {
        insertions.push({ lineIndex: lineIndex + 1, type: 'before' });
      }
    }
  }

  // Sort insertions in reverse order to maintain line numbers
  insertions.sort((a, b) => b.lineIndex - a.lineIndex);

  for (const insertion of insertions) {
    lines.splice(insertion.lineIndex, 0, '');
    results.push({
      ruleId: 'marp/html-blank-lines',
      slideNumber: 0,
      lineNumber: insertion.lineIndex + 1,
      description: `Added blank line ${insertion.type} HTML tag`,
      applied: true
    });
  }

  return { content: lines.join('\n'), results };
}

/**
 * Fix: Add font-class directive to dense slides
 */
function fixMissingFontClass(
  content: string,
  errors: LintError[]
): {
  content: string;
  results: FixResult[];
} {
  const lines = content.split('\n');
  const results: FixResult[] = [];

  // Find slide boundaries
  const slideStarts: number[] = [0];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.trim() === '---' && i > 0) {
      slideStarts.push(i + 1);
    }
  }

  for (const error of errors) {
    const slideIndex = error.slideNumber - 1;
    const slideStart = slideStarts[slideIndex];
    if (slideStart === undefined) continue;

    // Determine which font class to add based on error message
    let fontClass = 'font-small';
    if (error.message.includes('font-xxsmall')) {
      fontClass = 'font-xxsmall';
    } else if (error.message.includes('font-xsmall')) {
      fontClass = 'font-xsmall';
    }

    // Check if there's already a directive comment
    let directiveLine = -1;
    for (let i = slideStart; i < (slideStarts[slideIndex + 1] ?? lines.length); i++) {
      const line = lines[i] ?? '';
      if (line.trim().startsWith('<!-- _class:')) {
        directiveLine = i;
        break;
      }
      // Stop at first non-empty, non-comment line
      if (line.trim() && !line.trim().startsWith('<!--') && line.trim() !== '---') {
        break;
      }
    }

    if (directiveLine >= 0) {
      // Update existing directive
      const existingLine = lines[directiveLine] ?? '';
      if (!existingLine.includes(fontClass)) {
        const classMatch = existingLine.match(/_class:\s*([^>]+)/);
        if (classMatch) {
          const existingClasses = classMatch[1]?.trim() ?? '';
          const newClasses = `${existingClasses} ${fontClass}`.trim();
          lines[directiveLine] = `<!-- _class: ${newClasses} -->`;
          results.push({
            ruleId: 'marp/missing-font-class',
            slideNumber: error.slideNumber,
            lineNumber: directiveLine + 1,
            description: `Added ${fontClass} to existing directive`,
            applied: true
          });
        }
      }
    } else {
      // Add new directive after slide separator or at start
      const insertLine = slideStart;
      lines.splice(insertLine, 0, '', `<!-- _class: ${fontClass} -->`);
      results.push({
        ruleId: 'marp/missing-font-class',
        slideNumber: error.slideNumber,
        lineNumber: insertLine + 1,
        description: `Added <!-- _class: ${fontClass} --> directive`,
        applied: true
      });
      // Update subsequent slide starts
      for (let j = slideIndex + 1; j < slideStarts.length; j++) {
        slideStarts[j] = (slideStarts[j] ?? 0) + 2;
      }
    }
  }

  return { content: lines.join('\n'), results };
}

/**
 * Fix: Convert H1 to H2 in non-title slides
 */
function fixHeadingHierarchy(
  content: string,
  errors: LintError[]
): {
  content: string;
  results: FixResult[];
} {
  const lines = content.split('\n');
  const results: FixResult[] = [];

  for (const error of errors) {
    if (error.message.includes('H1 should only be used on the title slide')) {
      const lineIndex = error.lineNumber - 1;
      const line = lines[lineIndex] ?? '';
      if (line.startsWith('# ')) {
        lines[lineIndex] = `#${line}`; // Convert # to ##
        results.push({
          ruleId: 'marp/heading-hierarchy',
          slideNumber: error.slideNumber,
          lineNumber: error.lineNumber,
          description: 'Converted H1 to H2',
          applied: true
        });
      }
    }
  }

  return { content: lines.join('\n'), results };
}

/**
 * Get list of fixable rule IDs
 */
export function getFixableRules(): string[] {
  return ['marp/html-blank-lines', 'marp/missing-font-class', 'marp/heading-hierarchy'];
}
