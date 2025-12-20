import { describe, expect, it } from 'vitest';
import { balancedColumns } from '../../src/rules/balanced-columns.js';

describe('balanced-columns', () => {
  it('should return no errors for balanced columns', () => {
    const content = `---
marp: true
---

<div class="columns">
<div>

- Item 1
- Item 2
- Item 3

</div>
<div>

- Item A
- Item B
- Item C

</div>
</div>
`;
    const errors = balancedColumns(content);
    expect(errors).toHaveLength(0);
  });

  it('should detect unbalanced columns', () => {
    const content = `---
marp: true
---

<div class="columns">
<div>

- Item 1

</div>
<div>

- Item A
- Item B
- Item C
- Item D
- Item E
- Item F
- Item G
- Item H

</div>
</div>
`;
    const errors = balancedColumns(content, { maxImbalance: 0.3, minColumnLines: 2 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/balanced-columns');
    expect(errors[0]?.message).toContain('unbalanced');
  });

  it('should detect short columns', () => {
    const content = `---
marp: true
---

<div class="columns">
<div>

- Short

</div>
<div>

- Item A
- Item B
- Item C
- Item D
- Item E
- Item F
- Item G
- Item H

</div>
</div>
`;
    const errors = balancedColumns(content, { minColumnLines: 3 });
    expect(errors.length).toBeGreaterThan(0);
    // Either reports as "short" or "unbalanced"
    expect(errors[0]?.message).toMatch(/short|unbalanced/);
  });

  it('should return no errors when disabled', () => {
    const content = `---
marp: true
---

<div class="columns">
<div>

- Item 1

</div>
<div>

- Item A
- Item B
- Item C
- Item D
- Item E
- Item F

</div>
</div>
`;
    const errors = balancedColumns(content, { enabled: false });
    expect(errors).toHaveLength(0);
  });

  it('should ignore slides without columns', () => {
    const content = `---
marp: true
---

# Regular Slide

- Item 1
- Item 2
`;
    const errors = balancedColumns(content);
    expect(errors).toHaveLength(0);
  });

  it('should respect custom maxImbalance', () => {
    const content = `---
marp: true
---

<div class="columns">
<div>

- Item 1
- Item 2
- Item 3

</div>
<div>

- Item A
- Item B
- Item C
- Item D
- Item E

</div>
</div>
`;
    // With high maxImbalance, should not trigger
    const errorsHigh = balancedColumns(content, { maxImbalance: 0.5, minColumnLines: 2 });
    expect(errorsHigh).toHaveLength(0);
  });
});
