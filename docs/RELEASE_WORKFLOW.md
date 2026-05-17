# 🚀 Release & Development Workflow

**Last Updated:** February 16, 2026  
**Current Version:** v1.0.0 - Production Launch  
**Production URL:** https://sprintscaleit.co.uk

---

## ✅ **Production Release - February 16, 2026**

### **Release Checklist:**
- [x] All code pushed to GitHub
- [x] Vercel auto-deployed latest changes
- [x] Database indexes applied
- [x] Input text visibility fixed
- [x] Logo upload disabled (Coming Soon)
- [x] Branding colors functional
- [x] Staff login working (JWT auth)
- [x] Local environment cleaned
- [x] Documentation complete

### **Latest Commits in Production:**
```
dc01ec77 - feat: Database indexes successfully applied! ✅
62ff5ffc - fix: Make all input text highly visible across app
803e7ee0 - feat: Add database performance indexes migration
ca40ebbf - docs: Add comprehensive scaling and action roadmaps
8d6c30b3 - perf: Add performance docs and cleanup utilities
```

---

## 🔄 **Future Development Workflow**

### **Starting Tomorrow:**

All changes follow this workflow:

```
Local Development → Testing → Git Push → Vercel Deploy → Production
     (your laptop)     (test)   (GitHub)   (automatic)   (live site)
```

---

## 📋 **Development Process (After Tonight)**

### **Step 1: Create a Feature Branch**
```bash
# Start working on new feature
cd /Users/KWADW/projects/after-school-club-cms
git checkout -b feature/your-feature-name

# Example:
git checkout -b feature/add-email-notifications
```

### **Step 2: Make Changes Locally**
- Edit code
- Test on http://localhost:3000
- Make sure it works!

### **Step 3: Test Thoroughly**
```bash
# Run dev server
npm run dev

# Test in browser:
# - Does the feature work?
# - Did you break anything else?
# - Check console for errors
# - Test on mobile if needed
```

### **Step 4: Commit Changes**
```bash
# Stage your changes
git add -A

# Commit with clear message
git commit -m "feat: Add email notifications for bookings

- Send confirmation emails
- Include booking details
- Add unsubscribe link"

# Push to feature branch
git push origin feature/your-feature-name
```

### **Step 5: Test on Vercel Preview**
Vercel automatically creates a preview URL for your branch!

1. Go to: https://vercel.com/dashboard
2. Find your deployment
3. Click on the preview URL
4. Test the feature on the preview site
5. If it works: merge to main
6. If it breaks: fix and push again

### **Step 6: Merge to Main (Go Live)**
```bash
# Only when preview testing is successful!
git checkout main
git merge feature/your-feature-name
git push origin main
```

Vercel auto-deploys to production within 2 minutes! 🚀

---

## 🧪 **Testing Checklist**

Before pushing to production, test:

### **Critical Paths:**
- [ ] Login (Google & Email)
- [ ] Dashboard loads
- [ ] Create new booking
- [ ] View student profile
- [ ] Staff management
- [ ] Settings pages

### **Performance:**
- [ ] Pages load in <2 seconds
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Forms work correctly

### **Data:**
- [ ] No data leaks between orgs
- [ ] Permissions work correctly
- [ ] Centre filtering works

---

## 🛡️ **Safety Rules**

### **DO:**
✅ Always test locally first (`npm run dev`)  
✅ Use feature branches for new features  
✅ Test on Vercel preview before merging  
✅ Write clear commit messages  
✅ Keep main branch stable  
✅ Document breaking changes  

### **DON'T:**
❌ Push directly to main without testing  
❌ Deploy late at night (can't fix if breaks!)  
❌ Skip testing on preview  
❌ Make database schema changes without migration  
❌ Delete production data  
❌ Change .env variables without backup  

---

## 📊 **Production Monitoring**

### **Daily Checks:**
- Vercel dashboard: https://vercel.com/dashboard
- Check for errors in logs
- Monitor response times
- Check uptime status

### **Weekly Checks:**
- Review error logs
- Check database size (Neon console)
- Review bandwidth usage
- Check for slow queries

### **When Issues Arise:**
1. Check Vercel logs first
2. Check Neon database status
3. Check GitHub Actions (if any)
4. Rollback if needed (see below)

---

## 🔙 **Emergency Rollback**

If something breaks in production:

```bash
# Find the last working commit
git log --oneline -10

# Rollback to that commit
git reset --hard <commit-hash>

# Force push to main (careful!)
git push origin main --force

# Example:
git reset --hard 62ff5ffc
git push origin main --force
```

**Vercel will auto-deploy the old version in ~2 minutes.**

---

## 🗂️ **File Structure**

### **Important Files (Don't Delete!):**
```
.env.local                 # Environment variables (NEVER commit!)
package.json               # Dependencies
src/db/schema.ts          # Database structure
src/lib/auth.ts           # Authentication
migrations/               # Database migrations
```

### **Safe to Modify:**
```
src/app/                  # Pages and routes
src/components/           # UI components
src/features/             # Feature logic
public/                   # Images, icons
```

### **Documentation:**
```
SCALING_ROADMAP.md        # Future optimization guide
ACTION_ITEMS.md           # Task checklist
PERFORMANCE_OPTIMIZATION.md
RELEASE_WORKFLOW.md       # This file!
```

---

## 🎯 **Common Tasks**

### **Add a New Page:**
```bash
# Create new page
touch src/app/dashboard/my-new-page/page.tsx

# Test locally
npm run dev

# Navigate to:
http://localhost:3000/dashboard/my-new-page
```

### **Add a New API Endpoint:**
```bash
# Create API route
touch src/app/api/my-endpoint/route.ts

# Test with curl:
curl http://localhost:3000/api/my-endpoint
```

### **Update Dependencies:**
```bash
# Check for updates
npm outdated

# Update all (careful!)
npm update

# Test thoroughly before deploying!
```

### **Clean Build:**
```bash
# If weird errors occur
./scripts/cleanup.sh

# Or manually:
rm -rf .next
npm run dev
```

---

## 📝 **Git Best Practices**

### **Commit Message Format:**
```
<type>: <short description>

<detailed description>

<list of changes>
```

### **Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code formatting
- `refactor:` - Code restructure
- `perf:` - Performance improvement
- `test:` - Adding tests
- `chore:` - Maintenance

### **Examples:**
```bash
git commit -m "feat: Add email notifications"
git commit -m "fix: Login redirect loop"
git commit -m "perf: Optimize dashboard queries"
git commit -m "docs: Update README"
```

---

## 🔐 **Environment Variables**

### **Production (.env.local on Vercel):**
```bash
DATABASE_URL=<Neon connection string>
NEXTAUTH_SECRET=<secret>
NEXTAUTH_URL=https://sprintscaleit.co.uk
GOOGLE_CLIENT_ID=<google-id>
GOOGLE_CLIENT_SECRET=<google-secret>
```

### **Never commit `.env.local` to git!**

Already in `.gitignore` ✅

---

## 📦 **Deployment Process**

### **How Vercel Auto-Deploy Works:**

1. You push to GitHub
2. Vercel detects the push
3. Vercel builds the app
4. Vercel runs tests (if any)
5. Vercel deploys to production
6. Takes ~2 minutes

### **Manual Deploy (if needed):**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

---

## 🎉 **Launch Checklist (Tonight!)**

### **Pre-Launch:**
- [x] All code synced
- [x] Database optimized
- [x] UI polished
- [x] Documentation ready
- [ ] Final production test
- [ ] Announce launch!

### **Post-Launch:**
- [ ] Monitor for errors (first 24 hours)
- [ ] Check performance
- [ ] Gather user feedback
- [ ] Plan next features

---

## 📞 **Support**

### **If Something Breaks:**
1. Don't panic!
2. Check Vercel logs
3. Check Neon database
4. Rollback if needed
5. Fix locally, test, redeploy

### **Useful Links:**
- **Production:** https://sprintscaleit.co.uk
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Neon Console:** https://console.neon.tech
- **GitHub Repo:** https://github.com/kwadwoaddo-collab/After-School-Club-CMS

---

## ✅ **Current Production State**

**Version:** v1.0.0  
**Last Deploy:** February 16, 2026  
**Status:** ✅ Stable & Ready  
**Database:** Optimized with indexes  
**Performance:** Fast & scalable  

**Features Live:**
- ✅ Authentication (Google + Email)
- ✅ Dashboard
- ✅ Booking management
- ✅ Student management
- ✅ Staff management
- ✅ Centre management
- ✅ Data isolation
- ✅ Settings & branding
- ✅ Public booking page

**Known Limitations:**
- Logo upload: Coming Soon
- Email notifications: TBD
- Advanced reporting: TBD

---

**Ready for launch! 🚀**

**Starting tomorrow: Use feature branches for all new work!**
