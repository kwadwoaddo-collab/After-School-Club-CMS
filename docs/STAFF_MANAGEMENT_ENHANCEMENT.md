# Staff Management Enhancement Plan

## Features to Implement

### 1. Direct Staff Creation (No Email Required)
**Purpose**: Admin can create staff accounts directly without waiting for email delivery

**Flow**:
- Admin fills form: email, name, role
- System creates account with temporary password
- Shows temporary password to admin (to share manually)
- Staff must change password on first login
- No email dependency

### 2. Pending Invitations List
**Purpose**: Admin can see all pending invitation links

**Display**:
- Table showing: Email, Role, Sent Date, Expires Date, Status
- Copy invite link button
- Resend invitation button
- Cancel/Delete invitation button

### 3. Remove Staff Access
**Purpose**: Admin can revoke staff access

**Options**:
- **Soft Delete**: Deactivate account (keeps data, prevents login)
- **Hard Delete**: Permanently remove user
- Confirmation dialog before removal
- Shows staff activity before removal (last login, booking count, etc.)

### 4. Enhanced Team Management Page
**Layout**:
```
┌─────────────────────────────────────────┐
│  Team Management                         │
│  ┌──────────┐  ┌──────────────────┐    │
│  │ + Invite │  │ + Create Directly │    │
│  └──────────┘  └──────────────────┘    │
├─────────────────────────────────────────┤
│  Active Staff (3)                        │
│  ┌─────────────────────────────────────┐│
│  │ Name | Email | Role | Actions       ││
│  │ John | j@... | MGR  | [Edit][Remove]││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  Pending Invitations (2)                 │
│  ┌─────────────────────────────────────┐│
│  │ Email | Role | Expires | Actions    ││
│  │ a@... | TUTOR| 5 days | [Copy][Del] ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

## Implementation Files

### Database Schema Changes
- Add `requirePasswordChange` boolean to users table
- Add `isActive` boolean to users table
- Add `lastLoginAt` timestamp to users table

### New API Endpoints
- `POST /api/staff/create-direct` - Create staff without email
- `DELETE /api/staff/[userId]` - Remove staff access
- `PATCH /api/staff/[userId]/deactivate` - Soft delete
- `GET /api/staff/invites` - List pending invitations
- `DELETE /api/staff/invites/[inviteId]` - Cancel invitation

### UI Components
- `CreateStaffDirectForm.tsx` - Direct creation form
- `PendingInvitationsTable.tsx` - Show pending invites
- `StaffMemberCard.tsx` - Display staff with remove button
- `RemoveStaffDialog.tsx` - Confirmation dialog

### Auth Changes
- Middleware to check `requirePasswordChange` flag
- Redirect to `/change-password` on first login
- Force password change page

## Security Considerations
- Temporary passwords: Generated securely (16 chars, random)
- Password change: Must be different from temp password
- Permissions: Only ORG_OWNER can create/remove staff
- Audit log: Track staff creation/removal events
