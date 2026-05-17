# Testing Guide for After School Club CMS

This guide outlines how to perform end-to-end testing of the application in both Development and Production environments.

## 1. Environment Selection

### A. Production Environment (Final Release Test)
Use this to test the final "optimized" version of the app.
```bash
# 1. Build the app (required after any code changes)
npm run build

# 2. Start the production server
npm run start
```

### B. Development Environment (Active Working)
Use this if you are making changes and want to see them instantly.
```bash
npm run dev
```

---

## 2. Test Profiles

| Scenario | Email | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Email/Password** | `i want ` | `TestPass123!` | Test core forms, validation, and dashboard. |
| **Google Auth** | *Use your real Gmail* | *Your Google Pass* | Test the Google Social Login integration. |

---

## 3. End-to-End Test Scenarios

### Scenario A: Email & Password Flow
1. **Signup**: Visit `/signup` and use the `tester@example.com` profile.
2. **Onboarding**: Complete the 3-step setup (logo, brand color, centre name).
3. **Verify**: Ensure the dashboard displays your "Test Academy" name.
4. **Cleanup**:
   ```bash
   npm run db:cleanup -- tester@example.com
   ```

### Scenario B: Google Login Flow
1. **Signup**: Visit `/signup` and click **"Sign up with Google"**.
2. **Onboarding**: Finish the setup screens.
3. **Login**: Log out, go to `/login`, and click **"Sign in with Google"**.
4. **Cleanup**: Replace `[EMAIL]` with your actual Google email:
   ```bash
   npm run db:cleanup -- [EMAIL]
   ```

---

## 4. Troubleshooting

**"It says 'Nothing Happened' after Google Login":**
* Check the URL for `?error=...`.
* Ensure you have added `http://localhost:3000/api/auth/callback/google` to your **Google Cloud Console** redirect URIs.

**"Production server won't start":**
* Always run `npm run build` first. If it crashes with a "Memory" error, don't worry—the project is configured to auto-fix this by using more RAM during the build.

**"Data already exists":**
* If you get a "Duplicate Key" error, run the `db:cleanup` command for that email and try again.

---

## 5. How to Update & Fix Bugs

It is important to remember that **Production does not update automatically** when you save a file.

### The "Update Workflow"
If you find a bug during testing and need to fix it, follow this circle:

1. **FIX (Dev Mode)**: 
   Stop production (`Ctrl+C`), run `npm run dev`, and fix the bug.
2. **FREEZE (Build)**: 
   Once the fix is ready, stop dev and run:
   ```bash
   npm run build
   ```
   *This takes your new code and "prints" a fresh production version.*
3. **DEPLOY (Start)**: 
   Run the production command again to see the fix:
   ```bash
   npm run start
   ```

**Analogy**: Dev is like a **Whiteboard** (updates instantly). Production is like a **Printed Book** (you must "re-print" it using the Build command to see changes).
