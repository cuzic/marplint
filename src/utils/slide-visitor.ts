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

/** Internal state for slide visitor */
interface VisitorState {
  currentSlide: number;
  slideStartLine: number;
  inFrontmatter: boolean;
  frontmatterContent: string[];
  inCodeBlock: boolean;
  codeBlockStartLine: number;
  codeBlockLanguage: string;
  codeBlockLines: string[];
  slideHasStarted: boolean;
}

function createInitialState(): VisitorState {
  return {
    currentSlide: 1,
    slideStartLine: 1,
    inFrontmatter: false,
    frontmatterContent: [],
    inCodeBlock: false,
    codeBlockStartLine: 0,
    codeBlockLanguage: '',
    codeBlockLines: [],
    slideHasStarted: false
  };
}

function getContext(state: VisitorState, lineNumber: number): LineContext {
  return {
    slideNumber: state.currentSlide,
    lineNumber,
    inFrontmatter: state.inFrontmatter,
    inCodeBlock: state.inCodeBlock,
    codeBlockLanguage: state.codeBlockLanguage,
    codeBlockStartLine: state.codeBlockStartLine
  };
}

/** Handle --- separator (frontmatter or slide break) */
function handleSeparator(state: VisitorState, lineIndex: number, lineNumber: number, visitor: SlideVisitor): boolean {
  if (lineIndex === 0) {
    state.inFrontmatter = true;
    return true;
  }
  if (state.inFrontmatter) {
    state.inFrontmatter = false;
    visitor.onFrontmatter?.(state.frontmatterContent.join('\n'));
    state.frontmatterContent = [];
    if (!state.slideHasStarted) {
      visitor.onSlideStart?.(state.currentSlide, lineNumber + 1);
      state.slideHasStarted = true;
    }
    return true;
  }
  // Slide break
  visitor.onSlideEnd?.(state.currentSlide, lineNumber - 1);
  state.currentSlide++;
  state.slideStartLine = lineNumber + 1;
  visitor.onSlideStart?.(state.currentSlide, state.slideStartLine);
  return true;
}

/** Handle code block delimiter */
function handleCodeBlockDelimiter(
  state: VisitorState,
  match: RegExpMatchArray,
  lineNumber: number,
  visitor: SlideVisitor
): void {
  if (!state.inCodeBlock) {
    state.inCodeBlock = true;
    state.codeBlockStartLine = lineNumber;
    state.codeBlockLanguage = match[2] ?? '';
    state.codeBlockLines = [];
    visitor.onCodeBlockStart?.(state.codeBlockLanguage, getContext(state, lineNumber));
  } else {
    visitor.onCodeBlockEnd?.(
      state.codeBlockLines,
      state.codeBlockLanguage,
      state.codeBlockStartLine,
      getContext(state, lineNumber)
    );
    state.inCodeBlock = false;
    state.codeBlockLanguage = '';
    state.codeBlockLines = [];
  }
}

/** Detect and handle heading */
function detectHeading(line: string, context: LineContext, visitor: SlideVisitor): void {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  if (match) {
    visitor.onHeading?.(match[1]?.length ?? 0, match[2] ?? '', context);
  }
}

/** Detect and handle list item */
function detectListItem(line: string, context: LineContext, visitor: SlideVisitor): void {
  const match = line.match(/^(\s*)([*\-+]|\d+\.)\s+(.+)$/);
  if (match) {
    const indent = match[1]?.length ?? 0;
    const depth = Math.floor(indent / 2) + 1;
    const marker = match[2] ?? '';
    visitor.onListItem?.(match[3] ?? '', depth, /^\d+\./.test(marker), context);
  }
}

/** Ensure slide has started */
function ensureSlideStarted(state: VisitorState, visitor: SlideVisitor): void {
  if (state.slideHasStarted) return;
  visitor.onSlideStart?.(state.currentSlide, 1);
  state.slideHasStarted = true;
}

/** Handle code block content */
function handleCodeBlockContent(state: VisitorState, line: string, lineNumber: number, visitor: SlideVisitor): void {
  state.codeBlockLines.push(line);
  visitor.onCodeBlockLine?.(line, getContext(state, lineNumber));
}

/** Process regular line content */
function processLineContent(line: string, context: LineContext, visitor: SlideVisitor): void {
  visitor.onLine?.(line, context);
  if (visitor.onHeading) detectHeading(line, context, visitor);
  if (visitor.onListItem) detectListItem(line, context, visitor);
}

/**
 * Visit slides in markdown content
 * Handles frontmatter, code blocks, and slide separators
 */
export function visitSlides(content: string, visitor: SlideVisitor): void {
  const lines = content.split('\n');
  const state = createInitialState();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNumber = i + 1;

    if (line.trim() === '---' && handleSeparator(state, i, lineNumber, visitor)) continue;
    if (state.inFrontmatter) {
      state.frontmatterContent.push(line);
      continue;
    }

    ensureSlideStarted(state, visitor);

    const context = getContext(state, lineNumber);
    visitor.onLineRaw?.(line, context);

    const codeBlockMatch = line.match(/^(`{3,})(\w*)/);
    if (codeBlockMatch) {
      handleCodeBlockDelimiter(state, codeBlockMatch, lineNumber, visitor);
      continue;
    }
    if (state.inCodeBlock) {
      handleCodeBlockContent(state, line, lineNumber, visitor);
      continue;
    }

    processLineContent(line, context, visitor);
  }

  if (state.slideHasStarted) visitor.onSlideEnd?.(state.currentSlide, lines.length);
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
