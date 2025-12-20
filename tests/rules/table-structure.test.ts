import { describe, expect, it } from 'vitest';
import { tableStructure } from '../../src/rules/table-structure.js';

describe('table-structure', () => {
  it('should return no errors for valid tables', () => {
    const content = `---
marp: true
---

# Table

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
`;
    const errors = tableStructure(content);
    expect(errors).toHaveLength(0);
  });

  it('should detect tables with too many columns', () => {
    const content = `---
marp: true
---

# Wide Table

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
`;
    const errors = tableStructure(content, { maxColumns: 6 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.ruleId).toBe('marp/table-structure');
    expect(errors[0]?.message).toContain('8 columns');
    expect(errors[0]?.message).toContain('max: 6');
  });

  it('should detect tables with too many rows', () => {
    const rows = Array(12).fill('| Cell | Cell |').join('\n');
    const content = `---
marp: true
---

# Tall Table

| Header 1 | Header 2 |
|----------|----------|
${rows}
`;
    const errors = tableStructure(content, { maxRows: 10 });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('rows');
    expect(errors[0]?.message).toContain('max: 10');
  });

  it('should detect tables without header separator', () => {
    const content = `---
marp: true
---

# No Header Table

| Cell 1 | Cell 2 |
| Cell 3 | Cell 4 |
`;
    const errors = tableStructure(content, { requireHeader: true });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('header separator');
  });

  it('should detect inconsistent column counts', () => {
    const content = `---
marp: true
---

# Inconsistent Table

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   | Cell 5   |
`;
    const errors = tableStructure(content);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('2 columns');
    expect(errors[0]?.message).toContain('expected 3');
    expect(errors[0]?.severity).toBe('error');
  });

  it('should return no errors when disabled', () => {
    const content = `---
marp: true
---

# Bad Table

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 2 | 3 |
`;
    const errors = tableStructure(content, { enabled: false });
    expect(errors).toHaveLength(0);
  });

  it('should handle multiple tables in one slide', () => {
    const content = `---
marp: true
---

# Multiple Tables

| A | B |
|---|---|
| 1 | 2 |

Some text between tables.

| C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|
| 1 | 2 | 3 | 4 | 5 | 6 | 7 |
`;
    const errors = tableStructure(content, { maxColumns: 5 });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain('7 columns');
  });

  it('should handle tables across multiple slides', () => {
    const content = `---
marp: true
---

# Slide 1

| A | B |
|---|---|
| 1 | 2 |

---

# Slide 2

| C | D | E | F | G | H |
|---|---|---|---|---|---|
| 1 | 2 | 3 | 4 | 5 | 6 |
`;
    const errors = tableStructure(content, { maxColumns: 5 });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.slideNumber).toBe(2);
  });

  it('should respect all config options', () => {
    const content = `---
marp: true
---

# Table

| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
`;
    const errors = tableStructure(content, {
      maxColumns: 10,
      maxRows: 20,
      requireHeader: true,
      checkAlignment: true
    });
    expect(errors).toHaveLength(0);
  });
});
