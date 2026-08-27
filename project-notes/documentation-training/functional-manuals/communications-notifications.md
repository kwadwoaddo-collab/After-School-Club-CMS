# SprintScale CMS — Functional Manual: Communications & Notifications
## Parent Broadcasts, Communications Consent, Resend Email Delivery & In-App Notifications

---

## 1. What the Communications Module Does

The **Communications Module** (`/dashboard/communications`) allows club operators to broadcast announcements, newsletters, and operational updates to registered families across their centres.

Key Capabilities:
- **Targeted Broadcasts:** Comms can be sent organisation-wide or scoped to a specific venue.
- **Server-Side Consent Enforcement:** The system automatically filters recipient lists to parents who have provided active communications consent.
- **Background Email Queue:** Asynchronous email dispatch powered by Resend with HTML body sanitization.
- **Broadcast History & Metrics:** Central log tracking sent messages, recipient counts, and delivery success/failure tallies.
- **In-App Header Notification Bell:** Real-time dashboard alerts for new bookings, cancellations, and administrative events.

---

## 2. Who Can Send Broadcasts

| Role | Access Level | Description |
|---|---|---|
| **Organisation Owner (`ORG_OWNER`)** | **FULL ACCESS** | Can broadcast to all parents across all organisation centres. |
| **Centre Manager (`MANAGER`)** | **CENTRE-SCOPED** | Can broadcast to parents attending their assigned centres. |
| **Front Desk (`FRONT_DESK`)** | **NO ACCESS** | Blocked server-side (`sendBroadcast` throws Unauthorized). |
| **Tutor (`TUTOR`)** | **NO ACCESS** | Blocked server-side. |
| **Parent (`PARENT`)** | **RECIPIENT ONLY** | Receives broadcasts in their email inbox; views announcements. |

---

## 3. Communications Consent: How the Software Filters Recipients

SprintScale enforces communications preferences directly at the server level:

```
┌─────────────────────────────────────────────────────────────┐
│                 COMMUNICATIONS CONSENT PIPELINE             │
├─────────────────────────────────────────────────────────────┤
│  1. Parent provides consent during registration/booking     │
│     stored on `bookings.communicationsConsent`.             │
│                                                             │
│  2. When a broadcast is sent, `sendBroadcast` queries:      │
│     `COALESCE(bool_or(bookings.communications_consent), false)`│
│                                                             │
│  3. Any parent whose aggregated consent is `false` is       │
│     automatically stripped from the recipient queue.        │
│                                                             │
│  4. Broadcast emails are dispatched ONLY to parents with     │
│     verified `true` consent.                                │
└─────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> **Operational vs. Broadcast Messages:**
> Essential transactional messages (e.g. invoice notifications, booking confirmations, emergency incident reports, and passwordless magic links) are operational notices and do not require promotional communications consent.

---

## 4. Step-by-Step Procedures

### Procedure 1: Sending an Email Broadcast to Parents
**Who Can Do This:** Organisation Owner (`ORG_OWNER`), Centre Manager (`MANAGER`)

**Steps:**
1. Navigate to: `Sidebar → Communications` (`/dashboard/communications`).
2. Select the **Target Centre:** Choose `All Centres` (Owner only) or select a specific assigned venue.
3. Select the **Audience:** Choose all consented parents or select specific parent recipients from the table.
4. Enter the **Email Subject Line:** (e.g. "Important: Autumn Half-Term Holiday Club Booking Open").
5. Enter the **Message Body:** Compose your announcement.
6. Review the **Recipient Count** displayed in the summary.
7. Click **Send Broadcast**.

**What Happens in the System:**
- The system re-derives consent server-side, verifying that every recipient is in this organisation and has `communicationsConsent === true`.
- A row is created in the `broadcasts` table with `recipientCount`.
- An asynchronous task dispatches emails via Resend.
- The broadcast appears in the **Broadcast History** table with live success and failure counters.

---

### Procedure 2: Reviewing In-App Header Notifications
**Who Can Do This:** Organisation Owners, Centre Managers

**Steps:**
1. In the top navigation header, locate the **Notification Bell** icon (`NotificationBell.tsx`).
2. If unread activity exists, a blue notification badge displays the count.
3. Click the bell to open the notifications dropdown.
4. Review recent alerts (e.g. "New Booking Created", "Booking Cancelled", "Payment Recorded").
5. Click **Mark all as read** to clear the unread counter.

---

## 5. External Delivery Providers & Fallbacks

- **Resend (Email):** Live in production. Handles all broadcast emails and transactional notices. If an individual email address fails (e.g. invalid domain), Resend logs the rejection and increments the broadcast's `failureCount`.
- **Twilio (SMS):** Currently deferred/unconfigured in production. If SMS broadcasts are triggered while unconfigured, the system fails closed gracefully without crashing.
