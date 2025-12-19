/**
 * Slide Visitor Pattern
 * Eliminates code duplication in static rule parsing loops
 */

export interface LineContext {
  /** Current slide number (1-based) */
  slideNumber: number;
  /** Current line number (1-based) */
  lineNumber: number;
  /** Whether currently inside frontmatter */
  inFrontmatter: boolean;
  /** Whether currently inside a code block */
  inCodeBlock: boolean;
  /** Language of current code block (if any) */
  codeBlockLanguage: string;
  /** Start line of current code block (if any) */
  codeBlockStartLine: number;
}

export interface SlideVisitor {
  /** Called when a slide starts (after frontmatter on first slide) */
  onSlideStart?(slideNumber: number, startLine: number): void;

  /** Called when a slide ends (on --- or end of file) */
  onSlideEnd?(slideNumber: number, endLine: number): void;

  /** Called for each line (outside frontmatter and code blocks) */
  onLine?(line: string, context: LineContext): void;

  /** Called for each line (including inside code blocks, but not frontmatter) */
  onLineRaw?(line: string, context: LineContext): void;

  /** Called when a heading is found */
  onHeading?(level: number, text: string, context: LineContext): void;

  /** Called when a code block starts */
  onCodeBlockStart?(language: string, context: LineContext): void;

  /** Called for each line inside a code block */
  onCodeBlockLine?(line: string, context: LineContext): void;

  /** Called when a code block ends */
  onCodeBlockEnd?(lines: string[], language: string, startLine: number, context: LineContext): void;

  /** Called when a list item is found */
  onListItem?(text: string, depth: number, ordered: boolean, context: LineContext): void;

  /** Called when frontmatter content is found */
  onFrontmatter?(content: string): void;
}

/**
 * Visit slides in markdown content
 * Handles frontmatter, code blocks, and slide separators
 */
export function visitSlides(content: string, visitor: SlideVisitor): void {
  const lines = content.split('\n');

  let currentSlide = 1;
  let slideStartLine = 1;
  let inFrontmatter = false;
  let frontmatterContent: string[] = [];
  let inCodeBlock = false;
  let codeBlockStartLine = 0;
  let codeBlockLanguage = '';
  let codeBlockLines: string[] = [];
  let slideHasStarted = false;

  const getContext = (lineNumber: number): LineContext => ({
    slideNumber: currentSlide,
    lineNumber,
    inFrontmatter,
    inCodeBlock,
    codeBlockLanguage,
    codeBlockStartLine
  });

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
        if (visitor.onFrontmatter) {
          visitor.onFrontmatter(frontmatterContent.join('\n'));
        }
        frontmatterContent = [];
        // Start first slide after frontmatter
        if (!slideHasStarted && visitor.onSlideStart) {
          visitor.onSlideStart(currentSlide, lineNumber + 1);
          slideHasStarted = true;
        }
        continue;
      } else {
        // Slide break
        if (visitor.onSlideEnd) {
          visitor.onSlideEnd(currentSlide, lineNumber - 1);
        }
        currentSlide++;
        slideStartLine = lineNumber + 1;

        if (visitor.onSlideStart) {
          visitor.onSlideStart(currentSlide, slideStartLine);
        }
        continue;
      }
    }

    // Collect frontmatter content
    if (inFrontmatter) {
      frontmatterContent.push(line);
      continue;
    }

    // Start first slide if no frontmatter
    if (!slideHasStarted) {
      if (visitor.onSlideStart) {
        visitor.onSlideStart(currentSlide, 1);
      }
      slideHasStarted = true;
    }

    const context = getContext(lineNumber);

    // Call raw line handler (includes code block content)
    if (visitor.onLineRaw) {
      visitor.onLineRaw(line, context);
    }

    // Track code blocks
    const codeBlockMatch = line.match(/^(`{3,})(\w*)/);
    if (codeBlockMatch) {
      if (!inCodeBlock) {
        // Start of code block
        inCodeBlock = true;
        codeBlockStartLine = lineNumber;
        codeBlockLanguage = codeBlockMatch[2] ?? '';
        codeBlockLines = [];

        if (visitor.onCodeBlockStart) {
          visitor.onCodeBlockStart(codeBlockLanguage, getContext(lineNumber));
        }
      } else {
        // End of code block
        if (visitor.onCodeBlockEnd) {
          visitor.onCodeBlockEnd(
            codeBlockLines,
            codeBlockLanguage,
            codeBlockStartLine,
            getContext(lineNumber)
          );
        }
        inCodeBlock = false;
        codeBlockLanguage = '';
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      if (visitor.onCodeBlockLine) {
        visitor.onCodeBlockLine(line, getContext(lineNumber));
      }
      continue;
    }

    // Call line handler (outside code blocks)
    if (visitor.onLine) {
      visitor.onLine(line, context);
    }

    // Detect headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch && visitor.onHeading) {
      const level = headingMatch[1]?.length ?? 0;
      const text = headingMatch[2] ?? '';
      visitor.onHeading(level, text, context);
    }

    // Detect list items
    const listMatch = line.match(/^(\s*)([*\-+]|\d+\.)\s+(.+)$/);
    if (listMatch && visitor.onListItem) {
      const indent = listMatch[1]?.length ?? 0;
      const depth = Math.floor(indent / 2) + 1;
      const marker = listMatch[2] ?? '';
      const ordered = /^\d+\./.test(marker);
      const text = listMatch[3] ?? '';
      visitor.onListItem(text, depth, ordered, context);
    }
  }

  // Handle last slide
  if (slideHasStarted && visitor.onSlideEnd) {
    visitor.onSlideEnd(currentSlide, lines.length);
  }
}

/**
 * Create a simple visitor that collects all headings
 */
export function collectHeadings(content: string): Array<{
  level: number;
  text: string;
  slideNumber: number;
  lineNumber: number;
}> {
  const headings: Array<{
    level: number;
    text: string;
    slideNumber: number;
    lineNumber: number;
  }> = [];

  visitSlides(content, {
    onHeading(level, text, context) {
      headings.push({
        level,
        text,
        slideNumber: context.slideNumber,
        lineNumber: context.lineNumber
      });
    }
  });

  return headings;
}

/**
 * Create a simple visitor that collects all code blocks
 */
export function collectCodeBlocks(content: string): Array<{
  language: string;
  lines: string[];
  startLine: number;
  endLine: number;
  slideNumber: number;
}> {
  const blocks: Array<{
    language: string;
    lines: string[];
    startLine: number;
    endLine: number;
    slideNumber: number;
  }> = [];

  visitSlides(content, {
    onCodeBlockEnd(lines, language, startLine, context) {
      blocks.push({
        language,
        lines: [...lines],
        startLine,
        endLine: context.lineNumber,
        slideNumber: context.slideNumber
      });
    }
  });

  return blocks;
}
