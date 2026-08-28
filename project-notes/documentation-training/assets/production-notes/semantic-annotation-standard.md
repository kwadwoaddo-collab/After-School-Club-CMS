# SprintScale CMS — Visual Asset Production Standard
## Semantic Annotation & Visual Quality Standard (Milestone D6B.R1)

**Document Version:** `1.0.0-frozen`  
**Applicability:** All screenshot production batches (`SS-D6-S001` → `SS-D6-S046`), micro-videos (`VID-D6-*`), and visual documentation assets.  
**Audience:** Visual Production Engineers, Technical Writers, QA Reviewers.

---

## 1. Core Principle: Semantic Integrity Over Superficial Compliance

Visual training assets in SprintScale CMS exist to **teach real workflows to human operators**. A visual asset that is technically well-formed (correct PNG dimensions, non-zero file size, valid bounding coordinates) but fails to visually demonstrate the claimed concept or targets irrelevant/empty DOM space is classified as a **FAIL**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SEMANTIC ANNOTATION QUALITY TRIAD                    │
├──────────────────────────┬──────────────────────────┬───────────────────┤
│    1. RELEVANT TARGET    │    2. VISIBLE CONTENT    │ 3. PERSONA TRUTH  │
│ Callout box MUST enclose │ Element MUST contain     │ Role MUST possess │
│ the exact UI element     │ real synthetic data, not │ server-side auth  │
│ performing the function. │ empty space or nulls.    │ for the view.     │
└──────────────────────────┴──────────────────────────┴───────────────────┘
```

---

## 2. Mandatory Annotation Rules

### Rule 1: No Ghost Annotations (Strict Non-Empty Rule)
- Every annotation bounding box (`①`, `②`, `③`) MUST enclose genuine, rendered, visible UI components (buttons, badges, table cells, form cards, or metric widgets).
- **Prohibited:** Bounding boxes over empty whitespace, decorative margins, background grid gutters, or unpopulated form placeholders.

### Rule 2: Dynamic DOM Bounding Over Hardcoded Coordinates
- All capture scripts MUST compute bounding boxes dynamically from the browser DOM:
  ```typescript
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout: 3000 });
  const box = await loc.boundingBox();
  ```
- Hardcoded fallback coordinates are permitted ONLY as defensive fallbacks when an element has a deterministic static viewport position, but any fallback that bounds empty space will fail Visual QA.

### Rule 3: Coordinate Clamping and Viewport Bounds
- All annotation coordinates MUST be clamped within the desktop viewport:
  ```typescript
  const bx = Math.max(2, Math.min(viewportW - 10, target.x));
  const by = Math.max(2, Math.min(viewportH - 10, target.y));
  const bw = Math.min(viewportW - bx - 2, Math.max(10, target.width));
  const bh = Math.min(viewportH - by - 2, Math.max(10, target.height));
  ```
- Annotation badges and dashed borders MUST NEVER bleed beyond the `1440×900` canvas.

### Rule 4: Synthetic Fixture Integrity
- When capturing a specialised feature (e.g. *Medical Alert Flags*, *Digital Signature*, *Approval Matching*, *Recovery Bin Countdowns*), the synthetic test database MUST contain the exact data required to make the UI render the full feature.
- **Rule:** If a feature renders conditionally (e.g. `student.notes` for allergy alerts), populate the fixture data rather than moving the callout to an unrelated element.

### Rule 5: Persona Authenticity
- Screenshots MUST be captured under the exact role required by the functional manual:
  - **Owner (`ORG_OWNER`):** Executive KPIs, centre settings, permanent purges.
  - **Manager (`MANAGER`):** Registrations triage, parent bin restoration, student rosters.
  - **Front Desk / Tutor (`FRONT_DESK` / `TUTOR`):** Daily registers, student medical profiles, pickup verification.
  - **Parent (`PUBLIC` / `PORTAL`):** Public registration intake, digital signature pad, consent confirmations.

---

## 3. Visual Styling Specifications

| Property | Standard Value | Description |
|---|---|---|
| **Canvas Viewport** | `1440 × 900` | Standard 16:10 desktop widescreen resolution |
| **Dashed Stroke** | `#2563EB` (Primary Blue) | 3px stroke width, `stroke-dasharray="8,4"`, 95% opacity |
| **Box Tint** | `fill-opacity="0.04"` | Subtle 4% tinted fill to enhance target recognition |
| **Corner Radius** | `rx="6" ry="6"` | Soft rounded rectangular highlight |
| **Badge Size** | `r="14"` (28px diameter) | Solid circular badge, `#2563EB` fill with 2px `#FFFFFF` stroke |
| **Badge Typography** | `14px system-ui bold` | Centered white numeral (`①`, `②`, `③`) |
| **Padding Margin** | `+10px` / `-20px` | Outer padding around small interactive elements |

---

## 4. Visual QA Adversarial Audit Checklist

Before any screenshot batch is certified, each asset MUST pass the three-question audit:

1. **Title Alignment:** Does the rendered screenshot visibly and clearly demonstrate what the Asset Registry title states?
2. **Target Precision:** Does every numbered badge point directly to an active, identifiable UI control or data container?
3. **Zero PII & Zero Leakage:** Are all names, emails, addresses, and phone numbers strictly synthetic Oakridge test data?

---

*Authorised by Antigravity IDE Visual Engineering Team for SprintScale CMS Phase D6.*
