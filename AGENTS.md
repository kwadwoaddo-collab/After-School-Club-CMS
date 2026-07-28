# After School Club CMS — Agent Rules

These rules apply to every AI agent working on this project. Read them before acting on any request.

---

## RULE 1 — Challenge Before You Change (The Challenger Rule)

**Before making any change that could break, alter, or have side-effects on existing functionality, STOP and challenge the user.**

This means:
- Argue WHY the change might be risky or have unintended consequences
- State clearly WHAT could break and why
- Offer an alternative approach if one exists
- Do NOT just agree and execute — push back like a senior engineer would

The user IS the critic. They will argue back. Hold your ground or concede based on evidence, not to please them. Only proceed once the debate is genuinely resolved and both sides agree.

### What triggers this rule:
- Changing shared utilities, validation schemas, or DB queries used by multiple features
- Altering navigation logic, routing, or middleware
- Modifying components used in more than one place
- Removing or replacing existing features
- Changes to auth, session, or permissions logic
- Any change touching more than 3 files simultaneously
- Refactors that are not strictly necessary to fix the stated bug

### What does NOT trigger this rule:
- Bug fixes with a clear, isolated root cause (typo, wrong variable, off-by-one)
- Pure visual/CSS changes that have zero logic impact
- Adding a net-new page/component that does not touch existing code
- User has already explicitly approved the approach in this conversation

---

## RULE 2 — Do NOT Change Business Logic

Unless explicitly instructed, never alter:
- Invoice creation or payment recording flow
- Booking submission logic
- Registration form submission
- Authentication or session handling
- Role/permission enforcement

Fix only the specific issue described. Leave everything else untouched.

---

## RULE 3 — UI Consistency Check Before Delivery

Before delivering any UI change, verify:
- Text is readable — no same-colour-on-same-colour (white on white, dark on dark)
- Design matches the dashboard's dark glassmorphism style
- Font sizes and spacing are consistent with adjacent pages
- No regressions on other pages that share the modified component

---

## RULE 4 — Clickable Names Everywhere

Any person's name appearing in a table, list, card, or badge must be a clickable link to their profile. Applies to students, parents, and staff across ALL pages.

---

## RULE 5 — Commit After Every Fix

Commit and push immediately after each fix with a clear, descriptive commit message. Do not bundle unrelated fixes into one commit.

---

## STYLE REFERENCE

| Token | Value |
|---|---|
| Background | `#05070A` |
| Cards | `bg-white/5 backdrop-blur-xl border border-white/10` |
| Gradient buttons | `bg-gradient-to-r from-[#3b82f6] to-[#6366f1]` |
| Muted text | `text-white/50` |
| Border radius (large) | `rounded-[48px]` or `rounded-3xl` |
| Glassmorphic card | `glassmorphic-card` CSS class |

All pages must match the dashboard's premium dark glassmorphism aesthetic.
