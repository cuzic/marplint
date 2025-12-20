/**
 * Marp Slide Parser
 * Parses Marp markdown files into individual slides
 */

export interface Slide {
  /** 1-indexed slide number */
  slideNumber: number;
  /** Starting line number (1-indexed) */
  startLine: number;
  /** Ending line number (1-indexed, inclusive) */
  endLine: number;
  /** Raw content lines */
  lines: string[];
  /** Content without frontmatter/comments */
  contentLines: string[];
  /** Directive comment if present (e.g., "<!-- _class: font-small -->") */
  directive?: string;
  /** Whether this slide has the frontmatter (first slide) */
  hasFrontmatter: boolean;
}

export interface ParseResult {
  /** All slides in the document */
  slides: Slide[];
  /** Frontmatter content if present */
  frontmatter?: string;
  /** Total line count */
  totalLines: number;
}

/**
 * Split markdown content into slides by --- separator
 */
export function parseSlides(content: string): ParseResult {
  const lines = content.split('\n');
  const slides: Slide[] = [];

  let currentSlideStart = 0;
  let currentSlideLines: string[] = [];
  let slideNumber = 0;
  let frontmatter: string | undefined;
  let _inFrontmatter = false;
  let frontmatterEnd = 0;

  // Check for frontmatter
  if (lines[0]?.trim() === '---') {
    _inFrontmatter = true;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        frontmatter = lines.slice(0, i + 1).join('\n');
        frontmatterEnd = i;
        break;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isSlideBreak = line?.trim() === '---' && i > frontmatterEnd;

    if (isSlideBreak && currentSlideLines.length > 0) {
      slideNumber++;
      slides.push(
        createSlide(
          slideNumber,
          currentSlideStart + 1, // 1-indexed
          i, // line before the ---
          currentSlideLines,
          slideNumber === 1
        )
      );
      currentSlideLines = [];
      currentSlideStart = i + 1;
    } else if (!isSlideBreak || i <= frontmatterEnd) {
      currentSlideLines.push(line ?? '');
    }
  }

  // Add the last slide
  if (currentSlideLines.length > 0 || currentSlideLines.some((l) => l.trim())) {
    slideNumber++;
    slides.push(createSlide(slideNumber, currentSlideStart + 1, lines.length, currentSlideLines, slideNumber === 1));
  }

  return {
    slides,
    frontmatter,
    totalLines: lines.length
  };
}

function createSlide(
  slideNumber: number,
  startLine: number,
  endLine: number,
  lines: string[],
  hasFrontmatter: boolean
): Slide {
  const directive = extractDirective(lines);
  const contentLines = extractContentLines(lines);

  return {
    slideNumber,
    startLine,
    endLine,
    lines,
    contentLines,
    directive,
    hasFrontmatter
  };
}

/**
 * Extract directive comment like <!-- _class: font-small -->
 */
function extractDirective(lines: string[]): string | undefined {
  for (const line of lines) {
    const match = line.match(/<!--\s*_class:\s*([^>]+)\s*-->/);
    if (match) {
      return match[1]?.trim();
    }
  }
  return undefined;
}

/**
 * Extract content lines (excluding frontmatter, empty lines, comments, HTML tags)
 */
function extractContentLines(lines: string[]): string[] {
  const content: string[] = [];
  let inFrontmatter = false;
  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip frontmatter
    if (trimmed === '---') {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) continue;

    // Track code blocks
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      content.push(line);
      continue;
    }

    // Include code block content
    if (inCodeBlock) {
      content.push(line);
      continue;
    }

    // Skip empty lines
    if (!trimmed) continue;

    // Skip pure HTML comments
    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) continue;

    // Include everything else (including HTML tags with content)
    content.push(line);
  }

  return content;
}

/**
 * Count effective content lines (for density calculation)
 */
export function countContentLines(slide: Slide): number {
  return slide.contentLines.length;
}

/**
 * Count characters in slide content
 */
export function countCharacters(slide: Slide): number {
  return slide.contentLines.join('').replace(/\s/g, '').length;
}

/**
 * Count list items in slide
 */
export function countListItems(slide: Slide): number {
  return slide.contentLines.filter((line) => line.trim().match(/^[-*+]\s/) || line.trim().match(/^\d+\.\s/)).length;
}

/**
 * Check if slide has font-size directive
 */
export function hasFontClass(slide: Slide): boolean {
  const directive = slide.directive?.toLowerCase() ?? '';
  return (
    directive.includes('font-small') ||
    directive.includes('font-xsmall') ||
    directive.includes('font-xxsmall') ||
    directive.includes('font-large')
  );
}

/**
 * Get font class level (0 = none, 1 = small, 2 = xsmall, 3 = xxsmall)
 */
export function getFontClassLevel(slide: Slide): number {
  const directive = slide.directive?.toLowerCase() ?? '';
  if (directive.includes('font-xxsmall')) return 3;
  if (directive.includes('font-xsmall')) return 2;
  if (directive.includes('font-small')) return 1;
  return 0;
}

/**
 * Find columns in slide
 */
export function findColumns(slide: Slide): { left: string[]; right: string[] } | null {
  const content = slide.lines.join('\n');
  const columnsMatch = content.match(/<div class="columns">([\s\S]*?)<\/div>\s*<\/div>/);

  if (!columnsMatch) return null;

  const columnsContent = columnsMatch[1] ?? '';
  const divSections = columnsContent.split(/<div>/g).filter((s) => s.trim());

  if (divSections.length < 2) return null;

  const leftContent =
    divSections[0]
      ?.replace(/<\/div>[\s\S]*$/, '')
      .split('\n')
      .filter((l) => l.trim()) ?? [];
  const rightContent =
    divSections[1]
      ?.replace(/<\/div>[\s\S]*$/, '')
      .split('\n')
      .filter((l) => l.trim()) ?? [];

  return { left: leftContent, right: rightContent };
}
