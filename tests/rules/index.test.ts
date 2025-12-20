import { describe, expect, it } from 'vitest';
import { runStaticRules } from '../../src/rules/index.js';
import type { MarplintConfig } from '../../src/utils/config.js';

describe('runStaticRules', () => {
  const defaultConfig = {
    rules: {
      'marp/slide-line-count': { enabled: true },
      'marp/slide-content-density': { enabled: true },
      'marp/html-blank-lines': { enabled: true },
      'marp/missing-font-class': { enabled: true },
      'marp/balanced-columns': { enabled: true },
      'marp/heading-hierarchy': { enabled: true },
      'marp/code-block-length': { enabled: true },
      'marp/link-validity': { enabled: true },
      'marp/japanese-consistency': { enabled: true },
      'marp/slide-title-required': { enabled: true },
      'marp/table-structure': { enabled: true },
      'marp/duplicate-content': { enabled: true },
      'marp/max-nested-list': { enabled: true }
    }
  } as MarplintConfig;

  it('should run all enabled rules', () => {
    const content = `---
marp: true
---

# Slide 1

- Item 1
- Item 2

---

# Slide 2

- Item A
- Item B
`;
    const result = runStaticRules(content, '/tmp/test.md', defaultConfig);
    expect(result.fileInfo.path).toBe('/tmp/test.md');
    expect(result.fileInfo.slideCount).toBeGreaterThan(0);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('should count slides correctly', () => {
    const content = `---
marp: true
---

# Slide 1

---

# Slide 2

---

# Slide 3
`;
    const result = runStaticRules(content, '/tmp/test.md', defaultConfig);
    // Count is based on --- separators, including frontmatter
    expect(result.fileInfo.slideCount).toBeGreaterThanOrEqual(3);
  });

  it('should separate errors and warnings', () => {
    const content = `---
marp: true
---

# Slide 1

[Valid link](./missing-file.md)

---

# Very Long Slide
${'- Item\n'.repeat(40)}
`;
    const result = runStaticRules(content, '/tmp/test.md', defaultConfig);
    // Missing file should be an error
    expect(result.errors.some((e) => e.ruleId === 'marp/link-validity')).toBe(true);
  });

  it('should skip disabled rules', () => {
    const content = `---
marp: true
---

# Slide

[Empty link]()
`;
    const config = {
      rules: {
        'marp/link-validity': false
      }
    } as MarplintConfig;
    const result = runStaticRules(content, '/tmp/test.md', config);
    expect(result.errors.filter((e) => e.ruleId === 'marp/link-validity')).toHaveLength(0);
  });

  it('should handle empty rules config', () => {
    const content = `---
marp: true
---

# Slide

Content here.
`;
    const config = {
      rules: {}
    } as MarplintConfig;
    const result = runStaticRules(content, '/tmp/test.md', config);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('should pass config options to individual rules', () => {
    const content = `---
marp: true
---

# Slide

\`\`\`javascript
${'const x = 1;\n'.repeat(20)}
\`\`\`
`;
    const configStrict = {
      rules: {
        'marp/code-block-length': { enabled: true, maxLines: 10 }
      }
    } as MarplintConfig;
    const configRelaxed = {
      rules: {
        'marp/code-block-length': { enabled: true, maxLines: 30 }
      }
    } as MarplintConfig;

    const resultStrict = runStaticRules(content, '/tmp/test.md', configStrict);
    const resultRelaxed = runStaticRules(content, '/tmp/test.md', configRelaxed);

    expect(resultStrict.warnings.some((w) => w.ruleId === 'marp/code-block-length')).toBe(true);
    expect(resultRelaxed.warnings.filter((w) => w.ruleId === 'marp/code-block-length')).toHaveLength(0);
  });

  it('should handle null rule config', () => {
    const content = `---
marp: true
---

# Slide
`;
    const config = {
      rules: {
        'marp/slide-line-count': null
      }
    } as unknown as MarplintConfig;
    const result = runStaticRules(content, '/tmp/test.md', config);
    expect(result).toBeDefined();
  });

  it('should handle true as rule config', () => {
    const content = `---
marp: true
---

# Slide

- Item 1
`;
    const config = {
      rules: {
        'marp/slide-line-count': true
      }
    } as unknown as MarplintConfig;
    const result = runStaticRules(content, '/tmp/test.md', config);
    expect(result).toBeDefined();
  });
});
