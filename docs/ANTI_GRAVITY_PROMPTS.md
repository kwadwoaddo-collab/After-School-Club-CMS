# AntiGravity Prompt Templates

This file is for HUMAN USE ONLY.
Do not let AntiGravity edit this file.

---

## Safe UI / UX Change Template

HOW TO USE:
1. Copy the template below.
2. Replace the Task line with ONE specific change.
3. Replace <feature-name> with the owning feature.
4. Paste into AntiGravity IDE.

---

Obey PROJECT_ROOT.lock.

Task: <describe ONE specific UI/UX change in 1–2 lines>

You may ONLY edit:
- src/features/<feature-name>/**
- src/components/ui/** (if needed)

Rules:
- List “Touched files” first (full paths).
- Edit ONLY the listed files.
- Do not touch any other folders.
- No refactors.
- No config changes.
- Ignore .next completely.

---

## Examples

Task: On the onboarding step 1 screen, make the logo upload optional and add helper text “You can add this later”.

Task: On the bookings page, show an empty-state message when no sessions exist.

Task: Extract a shared Button component used by onboarding and bookings.

---

## cleanup test email
#npm run db:cleanup -- kwadwoaddo@gmail.com #
