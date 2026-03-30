# Zod → Valibot Reference

## Complete API Mapping

| Zod | Valibot | Notes |
|---|---|---|
| `z.string()` | `v.string()` | |
| `z.number()` | `v.number()` | |
| `z.boolean()` | `v.boolean()` | |
| `z.bigint()` | `v.bigint()` | |
| `z.symbol()` | `v.symbol()` | |
| `z.date()` | `v.date()` | |
| `z.undefined()` | `v.undefined()` | |
| `z.null()` | `v.null()` | |
| `z.any()` | `v.any()` | |
| `z.unknown()` | `v.unknown()` | |
| `z.never()` | `v.never()` | |
| `z.void()` | `v.void()` | |
| `z.nan()` | `v.nan()` | |
| `z.literal(x)` | `v.literal(x)` | |
| `z.instanceof(C)` | `v.instance(C)` | |
| `z.string().min(n)` | `v.pipe(v.string(), v.minLength(n))` | |
| `z.string().max(n)` | `v.pipe(v.string(), v.maxLength(n))` | |
| `z.string().length(n)` | `v.pipe(v.string(), v.length(n))` | |
| `z.string().email()` | `v.pipe(v.string(), v.email())` | |
| `z.string().url()` | `v.pipe(v.string(), v.url())` | |
| `z.string().uuid()` | `v.pipe(v.string(), v.uuid())` | |
| `z.string().regex(r)` | `v.pipe(v.string(), v.regex(r))` | |
| `z.string().startsWith(s)` | `v.pipe(v.string(), v.startsWith(s))` | |
| `z.string().endsWith(s)` | `v.pipe(v.string(), v.endsWith(s))` | |
| `z.string().trim()` | `v.pipe(v.string(), v.trim())` | |
| `z.string().toLowerCase()` | `v.pipe(v.string(), v.toLowerCase())` | |
| `z.string().toUpperCase()` | `v.pipe(v.string(), v.toUpperCase())` | |
| `z.number().min(n)` / `.gte(n)` | `v.pipe(v.number(), v.minValue(n))` | |
| `z.number().max(n)` / `.lte(n)` | `v.pipe(v.number(), v.maxValue(n))` | |
| `z.number().gt(n)` | `v.pipe(v.number(), v.gtValue(n))` | |
| `z.number().lt(n)` | `v.pipe(v.number(), v.ltValue(n))` | |
| `z.number().int()` | `v.pipe(v.number(), v.integer())` | |
| `z.number().positive()` | `v.pipe(v.number(), v.minValue(1))` | |
| `z.number().multipleOf(n)` | `v.pipe(v.number(), v.multipleOf(n))` | |
| `z.number().finite()` | `v.pipe(v.number(), v.finite())` | |
| `z.number().safe()` | `v.pipe(v.number(), v.safeInteger())` | |
| `z.optional(s)` / `s.optional()` | `v.optional(s)` | |
| `z.nullable(s)` / `s.nullable()` | `v.nullable(s)` | |
| `z.nullish(s)` / `s.nullish()` | `v.nullish(s)` | |
| `s.default(val)` | `v.optional(s, val)` | |
| `s.catch(val)` | `v.fallback(s, val)` | |
| `z.array(s)` | `v.array(s)` | |
| `z.array(s).min(n)` | `v.pipe(v.array(s), v.minLength(n))` | |
| `z.array(s).max(n)` | `v.pipe(v.array(s), v.maxLength(n))` | |
| `z.array(s).length(n)` | `v.pipe(v.array(s), v.length(n))` | |
| `z.array(s).nonempty()` | `v.pipe(v.array(s), v.nonEmpty())` | |
| `z.tuple([...])` | `v.tuple([...])` | strips unknown items |
| `z.tuple([...]).rest(s)` | `v.tupleWithRest([...], s)` | |
| `z.object({})` | `v.object({})` | strips unknown keys |
| `z.object({}).passthrough()` | `v.looseObject({})` | |
| `z.object({}).strict()` | `v.strictObject({})` | |
| `z.object({}).catchall(s)` | `v.objectWithRest({}, s)` | |
| `z.object({}).extend({})` | `v.object({ ...s.entries, ... })` | |
| `z.object({}).merge(s2)` | `v.object({ ...s1.entries, ...s2.entries })` | |
| `z.object({}).pick({a:true})` | `v.pick(s, ['a'])` | |
| `z.object({}).omit({b:true})` | `v.omit(s, ['b'])` | |
| `z.object({}).partial()` | `v.partial(s)` | |
| `z.object({}).required()` | `v.required(s)` | |
| `z.record(k, v)` | `v.record(k, v)` | |
| `z.enum(['a','b'])` | `v.picklist(['a','b'])` | naming reversed! |
| `z.nativeEnum(E)` | `v.enum(E)` | naming reversed! |
| `z.union([...])` | `v.union([...])` | |
| `s.or(s2)` | `v.union([s, s2])` | |
| `z.discriminatedUnion(k,[...])` | `v.variant(k, [...])` | |
| `z.intersection(A, B)` | `v.intersect([A, B])` | |
| `s.and(s2)` | `v.intersect([s, s2])` | |
| `s.transform(fn)` | `v.pipe(s, v.transform(fn))` | |
| `s.refine(fn, msg)` | `v.pipe(s, v.check(fn, msg))` | |
| `s.superRefine(fn)` | `v.pipe(s, v.rawCheck(fn))` | |
| `z.preprocess(fn, s)` | `v.pipe(v.unknown(), v.transform(fn), s)` | |
| `z.coerce.number()` | `v.pipe(v.string(), v.toNumber())` | specify input type explicitly |
| `z.coerce.string()` | `v.pipe(v.unknown(), v.toString())` | |
| `z.coerce.boolean()` | `v.pipe(v.string(), v.toBoolean())` | |
| `z.coerce.date()` | `v.pipe(v.string(), v.toDate())` | |
| `z.coerce.bigint()` | `v.pipe(v.string(), v.toBigint())` | |
| `s.brand<'X'>()` | `v.pipe(s, v.brand('X'))` | |
| `z.keyof(s)` | `v.keyof(s)` | |
| `z.infer<typeof S>` | `v.InferOutput<typeof S>` | |
| `z.input<typeof S>` | `v.InferInput<typeof S>` | |
| `z.output<typeof S>` | `v.InferOutput<typeof S>` | |
| `S.parse(data)` | `v.parse(S, data)` | |
| `S.safeParse(data)` | `v.safeParse(S, data)` | |
| `await S.parseAsync(data)` | `await v.parseAsync(S, data)` | |
| `await S.safeParseAsync(data)` | `await v.safeParseAsync(S, data)` | |
| `result.data` (safeParse) | `result.output` | renamed! |
| `error.flatten()` | `v.flatten(error.issues)` | standalone function |
| `z.ZodError` | `ValiError` (import from valibot) | |

---

## Detailed Pattern Examples

### Objects

```ts
// Zod — four behaviors via methods
const A = z.object({ x: z.string() });              // strip
const B = z.object({ x: z.string() }).passthrough(); // keep unknown keys
const C = z.object({ x: z.string() }).strict();      // error on unknown keys
const D = z.object({ x: z.string() }).catchall(z.number()); // validate unknown keys

// Valibot — four distinct functions
const A = v.object({ x: v.string() });               // strip
const B = v.looseObject({ x: v.string() });           // keep unknown keys
const C = v.strictObject({ x: v.string() });          // error on unknown keys
const D = v.objectWithRest({ x: v.string() }, v.number()); // validate unknown keys
```

### Enums (important — naming is reversed)

```ts
// Zod
const Status = z.enum(['pending', 'active']); // string union
enum Direction { Up = 'UP', Down = 'DOWN' }
const Dir = z.nativeEnum(Direction);           // native TS enum

// Valibot — z.enum → v.picklist, z.nativeEnum → v.enum
const Status = v.picklist(['pending', 'active']);
enum Direction { Up = 'UP', Down = 'DOWN' }
const Dir = v.enum(Direction);
```

### Default values

```ts
// Zod
const schema = z.string().default('hello');
const schema = z.date().default(() => new Date());

// Valibot — second arg to optional()
const schema = v.optional(v.string(), 'hello');
const schema = v.optional(v.date(), () => new Date());
```

### Transforms

```ts
// Zod
const schema = z.string().transform((s) => s.trim().toLowerCase());
const schema = z.string().transform((s) => ({ value: s }));

// Valibot
const schema = v.pipe(v.string(), v.transform((s) => s.trim().toLowerCase()));
const schema = v.pipe(v.string(), v.transform((s) => ({ value: s })));
```

### Refinements

```ts
// Zod
const schema = z.string().refine((s) => s.includes('@'), 'Must contain @');

// Cross-field refinement with error forwarding
const schema = z.object({ pass: z.string(), confirm: z.string() })
  .superRefine((val, ctx) => {
    if (val.pass !== val.confirm) {
      ctx.addIssue({ path: ['confirm'], code: z.ZodIssueCode.custom, message: "No match" });
    }
  });

// Valibot
const schema = v.pipe(v.string(), v.check((s) => s.includes('@'), 'Must contain @'));

// Cross-field with forward()
const schema = v.pipe(
  v.object({ pass: v.string(), confirm: v.string() }),
  v.forward(
    v.check(({ pass, confirm }) => pass === confirm, 'No match'),
    ['confirm']
  )
);
```

### Error handling

```ts
// Zod
try {
  schema.parse(data);
} catch (err) {
  if (err instanceof z.ZodError) {
    err.issues;
    err.flatten(); // { formErrors, fieldErrors }
  }
}
const result = schema.safeParse(data);
if (!result.success) result.error.flatten();

// Valibot
import { ValiError } from 'valibot';

try {
  v.parse(schema, data);
} catch (err) {
  if (err instanceof ValiError) {
    err.issues;
    v.flatten(err.issues); // { root?, nested? }
  }
}
const result = v.safeParse(schema, data);
if (!result.success) v.flatten(result.issues);
```

### Async validation

```ts
// Zod — sync and async schemas are the same type
const schema = z.object({
  username: z.string().refine(async (val) => checkAvailable(val), 'Taken'),
});
await schema.parseAsync(data);

// Valibot — async must be declared explicitly (type-safe)
const schema = v.objectAsync({
  username: v.pipeAsync(v.string(), v.checkAsync(checkAvailable, 'Taken')),
  email: v.pipe(v.string(), v.email()), // sync fields stay sync
});
await v.parseAsync(schema, data);
```

### Type inference

```ts
// Zod
type User = z.infer<typeof UserSchema>;
type UserInput = z.input<typeof UserSchema>;  // before transforms

// Valibot
type User = v.InferOutput<typeof UserSchema>;
type UserInput = v.InferInput<typeof UserSchema>; // before transforms
```

### Branded types

```ts
// Zod
const UserId = z.string().brand<'UserId'>();
type UserId = z.infer<typeof UserId>;

// Valibot
const UserIdSchema = v.pipe(v.string(), v.brand('UserId'));
type UserId = v.InferOutput<typeof UserIdSchema>;
```

### Discriminated unions

```ts
// Zod
const shape = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('circle'), r: z.number() }),
  z.object({ kind: z.literal('rect'), w: z.number(), h: z.number() }),
]);

// Valibot — use variant() (better performance, targeted errors)
const shape = v.variant('kind', [
  v.object({ kind: v.literal('circle'), r: v.number() }),
  v.object({ kind: v.literal('rect'), w: v.number(), h: v.number() }),
]);
```

### Preprocess

```ts
// Zod — transform before type check
const schema = z.preprocess((val) => String(val), z.string());

// Valibot
const schema = v.pipe(v.unknown(), v.transform((val) => String(val)), v.string());
```

---

## Gotchas

1. **`z.enum` → `v.picklist`, `z.nativeEnum` → `v.enum`** — naming is reversed, the most common gotcha
2. **`result.data` → `result.output`** in `safeParse` success case
3. **No `.merge()`** — spread `.entries` instead
4. **No method chaining** — everything goes in `v.pipe()`
5. **Async propagates upward** — if any child is async, all parents must be `*Async` variants
6. **Coerce requires explicit input type** — `v.pipe(v.string(), v.toNumber())` not `v.pipe(v.unknown(), v.toNumber())`
7. **Pipe limit** — `v.pipe()` supports up to 20 items; nest pipes for complex schemas
8. **Tuple variants** — `looseTuple`, `strictTuple`, `tupleWithRest` instead of `.rest()`
9. **Custom error messages** take a plain string, not an options object: `v.string('message')` not `v.string({ invalid_type_error: 'message' })`
