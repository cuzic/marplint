/**
 * Rule: marp/code-block-length
 * Checks code block length to prevent overflow
 */

import type { LintError } from './slide-line-count.js';

export interface CodeBlockLengthConfig {
  enabled?: boolean;
  maxLines?: number;
  maxLineLength?: number;
}

const DEFAULT_CONFIG: Required<CodeBlockLengthConfig> = {
  enabled: true,
  maxLines: 15,
  maxLineLength: 80
};

interface CodeBlock {
  startLine: number;
  endLine: number;
  lines: string[];
  language: string;
  slideNumber: number;
}

export function codeBlockLength(
  content: string,
  config: CodeBlockLengthConfig = {}
): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return [];
  }

  const lines = content.split('\n');
  const errors: LintError[] = [];
  let currentSlide = 1;
  let inFrontmatter = false;
  let inCodeBlock = false;
  let codeBlockStart = 0;
  let codeBlockLanguage = '';
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNumber = i + 1;

    // Track frontmatter
    if (line.trim() === '---') {
      if (i === 0) {
        inFrontmatter = true;
        continue;
      } else if (inFrontmatter) {
        inFrontmatter = false;
        continue;
      } else {
        currentSlide++;
        continue;
      }
    }

    if (inFrontmatter) continue;

    // Track code blocks
    const codeBlockMatch = line.match(/^```(\w*)/);
    if (codeBlockMatch) {
      if (!inCodeBlock) {
        // Start of code block
        inCodeBlock = true;
        codeBlockStart = lineNumber;
        codeBlockLanguage = codeBlockMatch[1] ?? '';
        codeBlockLines = [];
      } else {
        // End of code block
        inCodeBlock = false;

        // Validate code block
        validateCodeBlock({
          startLine: codeBlockStart,
          endLine: lineNumber,
          lines: codeBlockLines,
          language: codeBlockLanguage,
          slideNumber: currentSlide
        }, errors, mergedConfig);
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
    }
  }

  return errors;
}

function validateCodeBlock(
  block: CodeBlock,
  errors: LintError[],
  config: Required<CodeBlockLengthConfig>
): void {
  // Check line count
  if (block.lines.length > config.maxLines) {
    errors.push({
      ruleId: 'marp/code-block-length',
      slideNumber: block.slideNumber,
      lineNumber: block.startLine,
      message: `Slide ${block.slideNumber}: Code block has ${block.lines.length} lines (max: ${config.maxLines}). Consider splitting or using a smaller font.`,
      severity: 'warning'
    });
  }

  // Check line length
  for (let i = 0; i < block.lines.length; i++) {
    const line = block.lines[i] ?? '';
    if (line.length > config.maxLineLength) {
      errors.push({
        ruleId: 'marp/code-block-length',
        slideNumber: block.slideNumber,
        lineNumber: block.startLine + i + 1,
        message: `Slide ${block.slideNumber}: Code line ${i + 1} has ${line.length} characters (max: ${config.maxLineLength}). Line may be truncated.`,
        severity: 'warning'
      });
      break; // Only report first occurrence per block
    }
  }
}
