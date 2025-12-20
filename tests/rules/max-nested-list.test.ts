import { describe, expect, it } from 'vitest';
import { maxNestedList } from '../../src/rules/max-nested-list.js';

describe('max-nested-list', () => {
  it('should return no errors for shallow nesting', () => {
    const content = `---
marp: true
---

- Level 1
  - Level 2
    - Level 3
`;
    const errors = maxNestedList(content);
    expect(errors).toHaveLength(0);
  });

  it('should detect deeply nested lists', () => {
    const content = `---
marp: true
---

- Level 1
  - Level 2
    - Level 3
      - Level 4 (too deep)
`;
    const errors = maxNestedList(content, { maxDepth: 3 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/max-nested-list');
    expect(errors[0]?.message).toContain('nesting depth');
  });

  it('should return no errors when rule is disabled', () => {
    const content = `---
marp: true
---

- Level 1
  - Level 2
    - Level 3
      - Level 4
        - Level 5
`;
    const errors = maxNestedList(content, { enabled: false });
    expect(errors).toHaveLength(0);
  });

  it('should respect custom maxDepth', () => {
    const content = `---
marp: true
---

- Level 1
  - Level 2
`;
    // With maxDepth: 2, this should be OK
    const errorsOk = maxNestedList(content, { maxDepth: 2 });
    expect(errorsOk).toHaveLength(0);

    // With maxDepth: 1, level 2 should trigger error
    const errorsError = maxNestedList(content, { maxDepth: 1 });
    expect(errorsError.length).toBeGreaterThan(0);
  });

  it('should report only once per slide', () => {
    const content = `---
marp: true
---

- Level 1
  - Level 2
    - Level 3
      - Level 4
        - Level 5
`;
    const errors = maxNestedList(content, { maxDepth: 3 });
    // Should only report once per slide even with multiple deep items
    expect(errors).toHaveLength(1);
  });
});
