import { describe, expect, it } from 'vitest';
import { codeBlockLength } from '../../src/rules/code-block-length.js';

describe('code-block-length', () => {
  it('should return no errors for short code blocks', () => {
    const content = `---
marp: true
---

\`\`\`javascript
const x = 1;
const y = 2;
\`\`\`
`;
    const errors = codeBlockLength(content);
    expect(errors).toHaveLength(0);
  });

  it('should detect code blocks exceeding max lines', () => {
    const lines = Array(20).fill('const x = 1;').join('\n');
    const content = `---
marp: true
---

\`\`\`javascript
${lines}
\`\`\`
`;
    const errors = codeBlockLength(content, { maxLines: 15 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/code-block-length');
    expect(errors[0]?.message).toContain('20 lines');
    expect(errors[0]?.message).toContain('max: 15');
  });

  it('should detect lines exceeding max length', () => {
    const longLine = 'x'.repeat(100);
    const content = `---
marp: true
---

\`\`\`javascript
const short = 1;
const veryLongVariableName = "${longLine}";
\`\`\`
`;
    const errors = codeBlockLength(content, { maxLineLength: 80 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('characters');
    expect(errors[0]?.message).toContain('max: 80');
  });

  it('should return no errors when rule is disabled', () => {
    const lines = Array(50).fill('const x = 1;').join('\n');
    const content = `---
marp: true
---

\`\`\`javascript
${lines}
\`\`\`
`;
    const errors = codeBlockLength(content, { enabled: false });
    expect(errors).toHaveLength(0);
  });

  it('should respect custom config values', () => {
    const lines = Array(25).fill('const x = 1;').join('\n');
    const content = `---
marp: true
---

\`\`\`javascript
${lines}
\`\`\`
`;
    // With maxLines: 30, 25 lines should be OK
    const errorsWithHighLimit = codeBlockLength(content, { maxLines: 30 });
    expect(errorsWithHighLimit).toHaveLength(0);

    // With maxLines: 20, 25 lines should trigger error
    const errorsWithLowLimit = codeBlockLength(content, { maxLines: 20 });
    expect(errorsWithLowLimit.length).toBeGreaterThan(0);
  });
});
