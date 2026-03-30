# Purchasing Power Parity (PPP)

PPP adjusts course pricing based on the learner's country, making courses more affordable in lower-income regions. Instructors can toggle PPP on/off per course.

## Tier System

All pricing logic lives in `app/lib/ppp.ts`. There are four hardcoded tiers:

| Tier | Discount | Countries |
|------|----------|-----------|
| **Tier 1** — Full Price | 0% | US, CA, GB, AU, DE, FR, NL, SE, NO, CH, JP, SG |
| **Tier 2** — Moderate | 30% | PL, MX, BR, TR, TH, MY, CZ, CL |
| **Tier 3** — High | 50% | IN, CO, AR, ZA, PH, VN, UA, ID |
| **Tier 4** — Maximum | 70% | NG, PK, BD, EG, KE, ET |

33 countries are supported. Unlisted countries default to Tier 1 (full price).

### Key functions in `app/lib/ppp.ts`

- `getTierForCountry(countryCode)` — maps a country code to its tier
- `getDiscountForCountry(countryCode)` — returns the discount percentage (0–70)
- `calculatePppPrice(priceInCents, countryCode)` — returns the adjusted price in cents
- `getCountryTierInfo(countryCode)` — returns tier info with a human-readable label
- `checkPppAccess(coursePrice, coursePppEnabled, purchaseCountry, currentCountry)` — validates whether a user can access content based on where they bought it vs where they are now

## Country Detection

Defined in `app/lib/country.server.ts`. Uses a layered fallback approach:

1. **Dev session override** — a `devCountry` value stored in the session (development only)
2. **Cloudflare header** — reads `CF-IPCountry` (production)
3. **ip-api.com fallback** — HTTP lookup using the `X-Forwarded-For` IP
4. **Null** — if all methods fail, the user is treated as Tier 1

## Database

In `app/db/schema.ts`:

- **Courses table**: `pppEnabled` (boolean, default true) and `price` (integer, cents)
- **Purchases table**: `pricePaid` (integer, cents after discount) and `country` (text, 2-letter code recorded at purchase time)

The purchase country is stored at checkout so the access guard can compare it later.

## Purchase Flow

Route: `app/routes/courses.$slug.purchase.tsx`

**Loader:**
1. Resolves the user's country
2. Calculates PPP-adjusted price
3. Returns `pppPrice`, `tierInfo`, and `country` to the UI
4. UI shows a green badge ("PPP discount applied for [Country] — [Tier Label]") and a strikethrough on the original price

**Action:**
1. Re-resolves the country at purchase time (not trusting the client)
2. Calculates the PPP price server-side
3. Calls `createPurchase(userId, courseId, pppPrice, country)` — storing both the discounted price and the country

## Access Guard (Geographic Restriction)

Route: `app/routes/courses.$slug.lessons.$lessonId.tsx` (lines 175–192)

When a user accesses a lesson:

1. The loader retrieves the purchase record (including the stored country)
2. Calls `checkPppAccess()` comparing purchase country vs current country
3. If blocked, returns `pppBlocked: true` to the component

**Rules:**
- Tier 1 purchases (full price) have **no geographic restriction**
- Tier 2–4 purchases are **restricted to the purchase country** — if the user is accessing from a different country, they see a warning screen explaining the restriction

The UI shows a `ShieldAlert` icon with the message: *"You purchased this course with a Purchasing Power Parity discount while in [original country], but you're currently accessing from [current country]."*

## Coupon / Team Purchase Restrictions

In `app/services/couponService.ts` (lines 88–101):

When redeeming a team coupon, the system verifies `userCountry` matches `purchase.country`. If there's a mismatch, redemption is blocked with: *"This coupon can only be redeemed from the same country as the purchaser."*

The redeem route (`app/routes/redeem.$code.tsx`) checks for this upfront and shows a "Region restriction" message.

## Instructor Controls

Route: `app/routes/instructor.$courseId.tsx`

Instructors can toggle PPP on/off per course via the `"update-ppp-enabled"` intent, which calls `updateCoursePppEnabled(courseId, pppEnabled)` in `app/services/courseService.ts`.

## Dev UI Country Override

Component: `app/components/dev-ui.tsx` (lines 134–168)

A development-only dropdown that lets you simulate being in any supported country. Submits to `app/routes/api.set-dev-country.ts`, which stores the override in the session cookie via `app/lib/session.ts`.

## PPP on Listing Pages

- **Course index** (`app/routes/courses.tsx`): calculates and displays PPP prices for each course card
- **Course detail** (`app/routes/courses.$slug.tsx`): shows the PPP badge and price comparison on the enrollment page
