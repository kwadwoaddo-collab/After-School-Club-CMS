# SprintScale — Tester Guide

## 🔐 Login Credentials

| Field | Value |
|---|---|
| **URL** | https://www.sprintscaleit.co.uk |
| **Email** | sprintscaletester@gmail.com |
| **Password** | *(provided separately by Kwadwo)* |
| **Login method** | Click **"Sign in with Google"** on the login page |
| **Role** | Organisation Owner (full access) |
| **Organisation** | Test Academy |

---

## 🗺️ What to Test

### 1. Login & Dashboard
- [ ] Go to https://www.sprintscaleit.co.uk
- [ ] Click **"Sign in with Google"** — log in with the Gmail credentials above
- [ ] You should land on the **Dashboard** showing "Test Academy" in the sidebar
- [ ] Confirm the sidebar shows: Dashboard, Centres, Students, Team, Settings

---

### 2. Centres
- [ ] Go to **Centres** in the sidebar
- [ ] Click **"Add Centre"** — create a test centre (e.g. "Main Branch")
- [ ] Fill in name, address, capacity
- [ ] Save and confirm it appears in the list

---

### 3. Public Booking Page
- [ ] Go to https://www.sprintscaleit.co.uk/book/test-academy
- [ ] This is the public-facing page parents use to book assessments
- [ ] Try booking a slot as a parent (use any name/email)
- [ ] Confirm a booking confirmation email is received

---

### 4. Assessments (Dashboard)
- [ ] Click **"+ New Assessment"** in the top right
- [ ] Create a test booking manually
- [ ] Check it appears in the **Recent Assessments** table on the dashboard
- [ ] Click into the booking — check the detail page loads correctly
- [ ] Try changing the status (Confirm / Complete / Cancel)
- [ ] Try rescheduling the booking

---

### 5. Students
- [ ] Go to **Students** in the sidebar
- [ ] Confirm booked students appear here
- [ ] Click a student to view their profile and booking history

---

### 6. Staff / Team Management
- [ ] Go to **Team** in the sidebar
- [ ] Click **"Invite Staff"**
- [ ] Invite a test email address with role **Tutor**
- [ ] Invite another with role **Manager**
- [ ] Check that the invite email arrives (check the inbox of the invited email)
- [ ] Click the magic link in the invite email → confirm it logs in correctly
- [ ] As the invited staff member, confirm they see a restricted dashboard (no Team/Settings)
- [ ] Back as owner: try **removing** a staff member and confirm they lose access

---

### 7. Export Report
- [ ] On the Dashboard, click **"Export Report"**
- [ ] Try "All History", "Last 30 Days", "Last 7 Days"
- [ ] Try a custom date range
- [ ] Confirm a CSV file downloads correctly

---

### 8. Settings
- [ ] Go to **Settings** in the sidebar
- [ ] Try updating the organisation name, contact email, phone
- [ ] Try uploading a logo (if available)
- [ ] Save and confirm changes persist after a page refresh

---

### 9. Mobile Responsiveness
- [ ] Open the site on a mobile device (or use Chrome DevTools → mobile view)
- [ ] Confirm the hamburger menu opens/closes the sidebar
- [ ] Confirm the dashboard is usable on a small screen
- [ ] Confirm the public booking page works on mobile

---

### 10. Staff Login (Magic Link)
- [ ] Go to https://www.sprintscaleit.co.uk/staff-login
- [ ] Enter the email address of an invited staff member
- [ ] Confirm the magic link email arrives
- [ ] Click the link → confirm it logs in and shows the correct restricted dashboard

---

## 🐛 How to Report Issues

For each bug found, please note:
1. **What you were doing** (which step above)
2. **What you expected to happen**
3. **What actually happened**
4. **Screenshot** if possible

Send findings to: **kwadwoaddo@gmail.com**

---

## ⚠️ Notes

- This is a **test organisation** — feel free to create/delete anything
- Do **not** use real parent/student data — use fake names and emails
- The magic link login expires after **15 minutes** — request a new one if it expires
- If you get stuck on any step, skip it and note it as a blocker
