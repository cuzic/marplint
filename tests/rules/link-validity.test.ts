import { describe, expect, it } from 'vitest';
import { linkValidity } from '../../src/rules/link-validity.js';

describe('link-validity', () => {
  it('should return no errors for valid external links', () => {
    const content = `---
marp: true
---

# Links

- [Valid Link](https://example.com)
- [Email](mailto:test@example.com)
`;
    const errors = linkValidity(content, '/tmp/test.md');
    expect(errors).toHaveLength(0);
  });

  it('should detect missing local files', () => {
    const content = `---
marp: true
---

# Links

- [Local Link](./nonexistent.md)
`;
    const errors = linkValidity(content, '/tmp/test.md', { checkLocalFiles: true });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/link-validity');
    expect(errors[0]?.message).toContain('not found');
    expect(errors[0]?.severity).toBe('error');
  });

  it('should detect missing local images', () => {
    const content = `---
marp: true
---

# Images

![Image](./missing.png)
`;
    const errors = linkValidity(content, '/tmp/test.md', { checkImages: true, checkLocalFiles: true });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('not found');
  });

  it('should detect unknown protocols', () => {
    const content = `---
marp: true
---

# Links

- [FTP Link](ftp://example.com/file.txt)
`;
    const errors = linkValidity(content, '/tmp/test.md', { allowedProtocols: ['http', 'https'] });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('Unknown protocol');
    expect(errors[0]?.message).toContain('ftp');
  });

  it('should detect missing files with different path', () => {
    const content = `---
marp: true
---

# Links

- [Missing](./another-nonexistent.md)
`;
    const errors = linkValidity(content, '/tmp/test.md', { checkLocalFiles: true });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('not found');
    expect(errors[0]?.severity).toBe('error');
  });

  it('should detect missing images with different path', () => {
    const content = `---
marp: true
---

# Images

![Alt text](./another-missing.png)
`;
    const errors = linkValidity(content, '/tmp/test.md', { checkImages: true, checkLocalFiles: true });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('Image');
    expect(errors[0]?.message).toContain('not found');
  });

  it('should return no errors when disabled', () => {
    const content = `---
marp: true
---

# Links

- [Empty]()
- [Missing](./nonexistent.md)
`;
    const errors = linkValidity(content, '/tmp/test.md', { enabled: false });
    expect(errors).toHaveLength(0);
  });

  it('should handle HTML links with missing files', () => {
    const content = `---
marp: true
---

# Links

<a href="./missing-html.md">HTML link</a>
`;
    const errors = linkValidity(content, '/tmp/test.md', { checkLocalFiles: true });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('not found');
  });

  it('should handle HTML images with missing files', () => {
    const content = `---
marp: true
---

# Images

<img src="./missing-html.png" alt="Missing">
`;
    const errors = linkValidity(content, '/tmp/test.md', { checkImages: true, checkLocalFiles: true });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('not found');
  });

  it('should ignore anchor-only links', () => {
    const content = `---
marp: true
---

# Links

- [Internal Link](#section)
`;
    const errors = linkValidity(content, '/tmp/test.md', { checkLocalFiles: true });
    expect(errors).toHaveLength(0);
  });
});
