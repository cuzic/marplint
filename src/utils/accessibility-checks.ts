/**
 * Shared accessibility check functions
 * Used by both analysis module and lint rules to avoid code duplication
 */

export interface HeadingInfo {
  level: number;
  text: string;
  lineNumber?: number;
}

export interface LinkInfo {
  url: string;
  text: string;
  lineNumber?: number;
  isImage?: boolean;
}

export interface ImageInfo {
  src: string;
  alt: string;
  lineNumber?: number;
}

export interface HeadingHierarchyIssue {
  fromLevel: number;
  toLevel: number;
  lineNumber?: number;
}

export interface LinkTextIssue {
  text: string;
  lineNumber?: number;
}

export interface ImageAltIssue {
  src: string;
  lineNumber?: number;
}

/**
 * Extract headings from content
 */
export function extractHeadings(content: string): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1]?.length ?? 0,
        text: match[2] ?? '',
        lineNumber: i + 1
      });
    }
  }

  return headings;
}

/**
 * Check heading hierarchy issues
 * Returns issues where heading levels skip (e.g., H1 to H3)
 */
export function checkHeadingHierarchy(headings: HeadingInfo[]): HeadingHierarchyIssue[] {
  const issues: HeadingHierarchyIssue[] = [];
  let prevLevel = 0;

  for (const heading of headings) {
    if (prevLevel > 0 && heading.level > prevLevel + 1) {
      issues.push({
        fromLevel: prevLevel,
        toLevel: heading.level,
        lineNumber: heading.lineNumber
      });
    }
    prevLevel = heading.level;
  }

  return issues;
}

/**
 * Extract links from content (markdown format)
 */
export function extractLinks(content: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  const lines = content.split('\n');

  const linkPattern = /\[([^\]]*)\]\(([^)]+)\)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    let match;
    while ((match = linkPattern.exec(line)) !== null) {
      // Skip images (prefixed with !)
      if (match.index > 0 && line[match.index - 1] === '!') continue;

      links.push({
        text: match[1] ?? '',
        url: match[2] ?? '',
        lineNumber: i + 1
      });
    }
  }

  return links;
}

/**
 * Check for non-descriptive link text
 */
export function checkLinkTextQuality(links: LinkInfo[]): LinkTextIssue[] {
  const nonDescriptiveTexts = ['here', 'click', 'click here', 'link', 'this', 'read more'];
  const issues: LinkTextIssue[] = [];

  for (const link of links) {
    const text = link.text.toLowerCase().trim();
    if (text.length < 3 || nonDescriptiveTexts.includes(text)) {
      issues.push({
        text: link.text,
        lineNumber: link.lineNumber
      });
    }
  }

  return issues;
}

/**
 * Extract images from content (markdown format)
 */
export function extractImages(content: string): ImageInfo[] {
  const images: ImageInfo[] = [];
  const lines = content.split('\n');

  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    let match;
    while ((match = imagePattern.exec(line)) !== null) {
      images.push({
        alt: match[1] ?? '',
        src: match[2] ?? '',
        lineNumber: i + 1
      });
    }
  }

  return images;
}

/**
 * Check for images missing alt text
 */
export function checkImageAltText(images: ImageInfo[]): ImageAltIssue[] {
  return images
    .filter((img) => !img.alt.trim())
    .map((img) => ({
      src: img.src,
      lineNumber: img.lineNumber
    }));
}

/**
 * Check if table has header separator row
 */
export function hasTableHeader(content: string): boolean {
  return content.includes('|---|') || content.includes('| --- |') || /\|[\s:-]+\|/.test(content);
}

/**
 * Extract table rows from content
 */
export function extractTableRows(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Skip separator row
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) continue;

      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      rows.push(cells);
    }
  }

  return rows;
}
