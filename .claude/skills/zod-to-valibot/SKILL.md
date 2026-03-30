---
name: zod-to-valibot
description: Migrates TypeScript validation schemas from Zod to Valibot. Handles all common patterns: primitives, objects, arrays, unions, transforms, refinements, enums, async validation, error handling, and type inference. Use when asked to migrate or convert Zod schemas to Valibot, replace zod with valibot, or when files contain `import { z } from 'zod'` / `import * as z from 'zod'` and need to be updated. Works across any repository.
---

# Zod → Valibot Migration

## Quick start

```ts
// Before
import { z } from 'zod';
const schema = z.object({ name: z.string().min(1), age: z.number().int() });
type Input = z.infer<typeof schema>;
const result = schema.safeParse(data);
if (result.success) console.log(result.data);

// After
import * as v from 'valibot';
const schema = v.object({ name: v.pipe(v.string(), v.minLength(1)), age: v.pipe(v.number(), v.integer()) });
type Input = v.InferOutput<typeof schema>;
const result = v.safeParse(schema, data);
if (result.success) console.log(result.output); // .data → .output
```

## Workflow

- [ ] **1. Run the official codemod first** (handles bulk renames):
  ```sh
  npx @valibot/zod-to-valibot 'src/**/*.ts'
  ```
- [ ] **2. Fix what the codemod misses** — review [REFERENCE.md](REFERENCE.md) for every pattern
- [ ] **3. Update imports** — replace `import { z } from 'zod'` with `import * as v from 'valibot'`
- [ ] **4. Update `package.json`** — remove `zod`, add `valibot`
- [ ] **5. Fix TypeScript errors** — common sources listed below
- [ ] **6. Run tests** to verify behavior is unchanged

## The three most important mental shifts

**1. Method chaining → `pipe()`**
Zod: `z.string().email().min(5)`
Valibot: `v.pipe(v.string(), v.email(), v.minLength(5))`

**2. Parse is a standalone function**
Zod: `schema.parse(data)` / `schema.safeParse(data)`
Valibot: `v.parse(schema, data)` / `v.safeParse(schema, data)`

**3. `safeParse` result uses `.output` not `.data`**
Zod: `result.data`
Valibot: `result.output`

## Common TypeScript errors after migration

| Error | Fix |
|---|---|
| `result.data` doesn't exist | Change to `result.output` |
| `z.ZodError` type | Change to `ValiError` from valibot |
| `error.flatten()` method missing | Change to `v.flatten(error.issues)` |
| Object schema has no `.extend()` | Use `v.object({ ...schema.entries, newField: ... })` |
| Object schema has no `.merge()` | Use `v.object({ ...schemaA.entries, ...schemaB.entries })` |
| Async schema inside sync | Rename `v.object` → `v.objectAsync`, `v.pipe` → `v.pipeAsync` |

## Key naming differences

| Zod | Valibot |
|---|---|
| `z.enum(['a','b'])` | `v.picklist(['a','b'])` |
| `z.nativeEnum(MyEnum)` | `v.enum(MyEnum)` |
| `z.discriminatedUnion(k, [...])` | `v.variant(k, [...])` |
| `z.intersection(A, B)` | `v.intersect([A, B])` |
| `.default(val)` | `v.optional(schema, val)` |
| `.catch(val)` | `v.fallback(schema, val)` |
| `z.infer<typeof S>` | `v.InferOutput<typeof S>` |

See [REFERENCE.md](REFERENCE.md) for the complete API mapping with code examples.
