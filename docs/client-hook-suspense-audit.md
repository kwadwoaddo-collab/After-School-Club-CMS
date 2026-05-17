# Next.js Client Hook Safety & Suspense Audit Report

**Date:** 2026-05-17
**Scope:** `useSearchParams`, `useRouter`, `usePathname`
**Context:** Next.js requires any Client Component utilizing `useSearchParams` to be wrapped in a `<Suspense>` boundary when rendered by a Server Component. Failure to do so results in a `MissingSuspenseWithCSRBailout` production crash. `useRouter` and `usePathname` do not trigger this bailout and do not strictly require a Suspense boundary.

---

## High Risk (Requires `<Suspense>`)
*These files utilize `useSearchParams` and must be wrapped in a `<Suspense>` boundary.*

| File Path | Component Name | Client Component? | Rendered In | Suspense Required? | Suspense Present? | Risk Level |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `src/app/login/page.tsx` | `LoginForm` | Yes | Self (Page) | Yes | ✅ Yes | Low (Fixed) |
| `src/app/reset-password/page.tsx` | `ResetPasswordForm` | Yes | Self (Page) | Yes | ✅ Yes | Low (Fixed) |
| `src/app/accept-invite/page.tsx` | `AcceptInviteContent` | Yes | Self (Page) | Yes | ✅ Yes | Low (Fixed) |
| `src/app/portal/login/page.tsx` | `PortalLoginForm` | Yes | Self (Page) | Yes | ✅ Yes | Low (Fixed) |
| `src/components/dashboard/DashboardFilter.tsx` | `DashboardFilter` | Yes | `src/app/dashboard/page.tsx` | Yes | ✅ Yes | Low (Fixed) |
| `src/components/registration/RegistrationsFilters.tsx` | `RegistrationsFilters` | Yes | `src/app/dashboard/registrations/page.tsx` | Yes | ✅ Yes | Low (Fixed) |
| `src/components/bookings/BookingsFilters.tsx` | `BookingsFilters` | Yes | `src/app/dashboard/bookings/page.tsx` | Yes | ✅ Yes | Low (Fixed) |
| `src/features/finance/components/FinanceDashboardFilters.tsx` | `FinanceDashboardFilters` | Yes | `src/app/dashboard/finance/page.tsx` | Yes | ✅ Yes | Low (Fixed) |
| `src/components/ui/Pagination.tsx` | `Pagination` | Yes | Unused | Yes | N/A | None |

---

## Low Risk (No `<Suspense>` Required)
*These files utilize `useRouter` or `usePathname`. Next.js does not require a `<Suspense>` boundary for these hooks.*

### `usePathname`
| File Path | Component Name | Client Component? | Rendered In | Suspense Required? | Risk Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/components/dashboard/Sidebar.tsx` | `Sidebar` | Yes | Layout / Shell | No | None |
| `src/components/dashboard/MobileBottomNav.tsx` | `MobileBottomNav` | Yes | Layout / Shell | No | None |

### `useRouter`
| File Path | Component Name | Client Component? | Rendered In | Suspense Required? | Risk Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `src/components/onboarding/OnboardingForm.tsx` | `OnboardingForm` | Yes | Onboarding Page | No | None |
| `src/features/auth/components/OrgRegistrationForm.tsx` | `OrgRegistrationForm` | Yes | Registration | No | None |
| `src/features/finance/components/FinanceDashboardClient.tsx` | `FinanceDashboardClient`| Yes | Finance Dashboard | No | None |
| `src/features/finance/components/CreateInvoiceModal.tsx` | `CreateInvoiceModal` | Yes | Finance Dashboard | No | None |
| `src/features/finance/components/InvoiceDetailsClient.tsx` | `InvoiceDetailsClient` | Yes | Invoice Detail Page | No | None |
| `src/components/staff/StaffCentreAssignment.tsx` | `StaffCentreAssignment` | Yes | Staff Detail Page | No | None |
| `src/components/students/StudentActions.tsx` | `StudentActions` | Yes | Student Detail Page | No | None |
| `src/components/students/StudentForm.tsx` | `StudentForm` | Yes | Add Student Page | No | None |
| `src/components/dashboard/Header.tsx` | `Header` | Yes | Layout / Shell | No | None |
| `src/components/dashboard/InvitationsList.tsx` | `InvitationsList` | Yes | Staff Page | No | None |
| `src/components/dashboard/RecentStudentsTable.tsx` | `RecentStudentsTable` | Yes | Main Dashboard | No | None |
| `src/components/dashboard/RegistrationItem.tsx` | `RegistrationItem` | Yes | Registrations Page | No | None |
| `src/components/bookings/ReassignCentreButton.tsx` | `ReassignCentreButton`| Yes | Booking Detail Page | No | None |
| `src/components/bookings/RescheduleForm.tsx` | `RescheduleForm` | Yes | Reschedule Page | No | None |
| `src/components/settings/OrganisationInfoForm.tsx` | `OrganisationInfoForm`| Yes | Settings Page | No | None |
| `src/components/bookings/BookingsTable.tsx` | `BookingsTable` | Yes | Bookings Page | No | None |
| `src/components/bookings/ReassignCentreModal.tsx` | `ReassignCentreModal` | Yes | Booking Detail Page | No | None |
| `src/components/settings/FinancePricingForm.tsx` | `FinancePricingForm` | Yes | Settings Page | No | None |
| `src/app/dashboard/availability/[centreId]/AvailabilityForm.tsx` | `AvailabilityForm` | Yes | Availability Page | No | None |
| `src/app/dashboard/registrations/[id]/StatusUpdater.tsx` | `StatusUpdater` | Yes | Reg Detail Page | No | None |
| `src/app/dashboard/staff/invite/page.tsx` | `InviteStaffPage` | Yes | Staff Invite Page | No | None |
| `src/app/signup/page.tsx` | `SignupPage` | Yes | Signup Page | No | None |
| `src/components/settings/BrandingForm.tsx` | `BrandingForm` | Yes | Branding Settings | No | None |
| `src/components/settings/CentreHoursForm.tsx` | `CentreHoursForm` | Yes | Hours Settings | No | None |

## Conclusion
✅ **Status: SECURE.**
All active uses of `useSearchParams` within Client Components have been correctly wrapped in a `<Suspense>` boundary in their respective Server Component parents. The `MissingSuspenseWithCSRBailout` exceptions observed in production will no longer occur.
