/**
 * AST-based Markdown parser using remark/unified
 * Provides more accurate parsing than regex-based approach
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { visit } from 'unist-util-visit';
import type { Root, Heading, Image, Link, Table, List, ListItem, Code, Text } from 'mdast';

export interface ParsedHeading {
  level: number;
  text: string;
  lineNumber: number;
}

export interface ParsedImage {
  src: string;
  alt: string;
  lineNumber: number;
}

export interface ParsedLink {
  url: string;
  text: string;
  lineNumber: number;
}

export interface ParsedTable {
  rows: string[][];
  hasHeader: boolean;
  lineNumber: number;
}

export interface ParsedCodeBlock {
  language: string;
  lines: string[];
  lineNumber: number;
}

export interface ParsedListItem {
  text: string;
  depth: number;
  ordered: boolean;
  lineNumber: number;
}

export interface ParsedSlide {
  slideNumber: number;
  startLine: number;
  endLine: number;
  headings: ParsedHeading[];
  images: ParsedImage[];
  links: ParsedLink[];
  tables: ParsedTable[];
  codeBlocks: ParsedCodeBlock[];
  listItems: ParsedListItem[];
}

/**
 * Parse a Marp document into slides using AST
 */
export function parseMarkdownAST(content: string): ParsedSlide[] {
  const slides: ParsedSlide[] = [];
  const lines = content.split('\n');

  // Find slide boundaries (--- separators)
  const slideBoundaries: number[] = [0];
  let inFrontmatter = false;
  let frontmatterEnd = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trim() === '---') {
      if (i === 0) {
        inFrontmatter = true;
      } else if (inFrontmatter) {
        inFrontmatter = false;
        frontmatterEnd = i;
      } else {
        slideBoundaries.push(i);
      }
    }
  }
  slideBoundaries.push(lines.length);

  // Parse each slide
  for (let s = 0; s < slideBoundaries.length - 1; s++) {
    const startLine = slideBoundaries[s] ?? 0;
    const endLine = slideBoundaries[s + 1] ?? lines.length;

    // Skip frontmatter
    if (startLine <= frontmatterEnd && s === 0) {
      continue;
    }

    const slideContent = lines.slice(startLine, endLine).join('\n');
    const tree = unified().use(remarkParse).parse(slideContent) as Root;

    const slide: ParsedSlide = {
      slideNumber: slides.length + 1,
      startLine: startLine + 1,
      endLine,
      headings: [],
      images: [],
      links: [],
      tables: [],
      codeBlocks: [],
      listItems: []
    };

    // Extract headings
    visit(tree, 'heading', (node: Heading) => {
      const text = extractText(node);
      slide.headings.push({
        level: node.depth,
        text,
        lineNumber: startLine + (node.position?.start.line ?? 0)
      });
    });

    // Extract images
    visit(tree, 'image', (node: Image) => {
      slide.images.push({
        src: node.url,
        alt: node.alt ?? '',
        lineNumber: startLine + (node.position?.start.line ?? 0)
      });
    });

    // Extract links
    visit(tree, 'link', (node: Link) => {
      const text = extractText(node);
      slide.links.push({
        url: node.url,
        text,
        lineNumber: startLine + (node.position?.start.line ?? 0)
      });
    });

    // Extract tables
    visit(tree, 'table', (node: Table) => {
      const rows: string[][] = [];
      for (const row of node.children) {
        const cells: string[] = [];
        for (const cell of row.children) {
          cells.push(extractText(cell));
        }
        rows.push(cells);
      }
      slide.tables.push({
        rows,
        hasHeader: rows.length > 0, // Markdown tables always have header in AST
        lineNumber: startLine + (node.position?.start.line ?? 0)
      });
    });

    // Extract code blocks
    visit(tree, 'code', (node: Code) => {
      slide.codeBlocks.push({
        language: node.lang ?? '',
        lines: (node.value ?? '').split('\n'),
        lineNumber: startLine + (node.position?.start.line ?? 0)
      });
    });

    // Extract list items with depth
    visit(tree, 'list', (node: List, _index, parent) => {
      const depth = getListDepth(parent);
      visitListItems(node, depth, node.ordered ?? false, startLine, slide.listItems);
    });

    slides.push(slide);
  }

  return slides;
}

/**
 * Extract text content from a node
 */
function extractText(node: unknown): string {
  const n = node as { type: string; value?: string; children?: unknown[] };
  if (n.type === 'text') {
    return n.value ?? '';
  }
  if (Array.isArray(n.children)) {
    return n.children.map(extractText).join('');
  }
  return '';
}

/**
 * Get the depth of a list (how nested it is)
 */
function getListDepth(parent: unknown): number {
  if (!parent) return 0;
  const p = parent as { type: string; parent?: unknown };
  if (p.type === 'listItem') {
    return 1 + getListDepth(p.parent);
  }
  return 0;
}

/**
 * Visit list items recursively
 */
function visitListItems(
  list: List,
  depth: number,
  ordered: boolean,
  startLine: number,
  items: ParsedListItem[]
): void {
  for (const item of list.children) {
    const text = extractText(item);
    items.push({
      text,
      depth,
      ordered,
      lineNumber: startLine + (item.position?.start.line ?? 0)
    });

    // Check for nested lists
    for (const child of item.children) {
      if ((child as { type: string }).type === 'list') {
        visitListItems(
          child as List,
          depth + 1,
          (child as List).ordered ?? false,
          startLine,
          items
        );
      }
    }
  }
}

/**
 * Quick check: Extract all headings from content
 */
export function extractHeadingsAST(content: string): ParsedHeading[] {
  const tree = unified().use(remarkParse).parse(content) as Root;
  const headings: ParsedHeading[] = [];

  visit(tree, 'heading', (node: Heading) => {
    headings.push({
      level: node.depth,
      text: extractText(node),
      lineNumber: node.position?.start.line ?? 0
    });
  });

  return headings;
}

/**
 * Quick check: Extract all images from content
 */
export function extractImagesAST(content: string): ParsedImage[] {
  const tree = unified().use(remarkParse).parse(content) as Root;
  const images: ParsedImage[] = [];

  visit(tree, 'image', (node: Image) => {
    images.push({
      src: node.url,
      alt: node.alt ?? '',
      lineNumber: node.position?.start.line ?? 0
    });
  });

  return images;
}

/**
 * Quick check: Extract all links from content
 */
export function extractLinksAST(content: string): ParsedLink[] {
  const tree = unified().use(remarkParse).parse(content) as Root;
  const links: ParsedLink[] = [];

  visit(tree, 'link', (node: Link) => {
    links.push({
      url: node.url,
      text: extractText(node),
      lineNumber: node.position?.start.line ?? 0
    });
  });

  return links;
}
