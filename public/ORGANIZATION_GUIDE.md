# Adding Your Booking System to Your Website
## Quick Start Guide for Organizations

This guide will help you add your AfterSchool booking system to your organization's website in just a few minutes.

---

## 📍 Step 1: Access Your Booking Link

1. **Log into your dashboard** at [after-school-club-live.vercel.app](https://after-school-club-live.vercel.app/login)
2. In the left sidebar under **Quick Actions**, click the **"Booking Link"** button
3. You'll see your Booking Link & Embed Code page

---

## 🎯 Choose Your Integration Method

You have **two main options** for adding bookings to your website:

### Option A: Direct Link (Easiest - 2 minutes)
Best for: Quick setup, social media, emails

### Option B: Embed Code (Recommended - 5 minutes)  
Best for: Seamless website integration, professional look

---

## 🔗 Option A: Using the Direct Link

### What You'll Get
A simple URL that you can add to any button, link, or share anywhere.

**Example:** `https://after-school-club-live.vercel.app/book/your-school/main-campus`

### How to Use It

#### On Your Website (HTML)
```html
<a href="YOUR_BOOKING_LINK_HERE" class="btn">
  Book an Assessment
</a>
```

#### WordPress (Button Block)
1. Add a **Button** block
2. Set the button text to "Book an Assessment"
3. Paste your booking link in the URL field
4. Save your page

#### Squarespace
1. Add a **Button** block
2. Enter "Book an Assessment" as text
3. Click the link icon and paste your booking URL
4. Publish

#### Wix
1. Add a **Button** element
2. Click to edit button text: "Book an Assessment"
3. Click "Link" → Paste your booking URL
4. Publish your site

---

## 📦 Option B: Using the Embed Code (Recommended)

### What You'll Get
The booking form appears **directly on your website** - customers never leave your site!

### Step-by-Step Instructions

#### 1. Choose Your Embed Size
On the Booking Link page, select one of:
- **Small** (600px) - For sidebar or footer
- **Medium** (800px) - Recommended for most pages
- **Large** (1000px) - For main booking pages
- **Custom** - Set your own height

#### 2. Copy the Code
You'll see two code options:
- **Standard Embed** - Fixed height
- **Responsive Embed** - Automatically adjusts (recommended)

Click the **"Copy Code"** button next to your preferred option.

#### 3. Add to Your Website

##### WordPress (HTML Block)
1. Edit the page where you want the booking form
2. Click the **+** button to add a block
3. Search for "Custom HTML" or "HTML" block
4. **Paste the embed code** you copied
5. Click **"Preview"** to see it working
6. **Publish** your page

##### Squarespace (Code Block)
1. Edit your page
2. Click where you want to add the form
3. Click **+** → **Code**
4. **Paste the embed code**
5. Click **"Apply"**
6. **Save** and publish

##### Wix (HTML iframe)
1. Click **+** → **Embed** → **HTML iframe**
2. **Paste the embed code** into the code box
3. Adjust the size if needed
4. **Update** and publish

##### Shopify (Page or Blog Post)
1. Navigate to **Online Store** → **Pages**
2. Create or edit a page
3. Click **Show HTML** (bottom left)
4. **Paste the embed code** where you want it
5. Click **Show HTML** again to return to editor
6. **Save** the page

##### Custom HTML Site
Simply **paste the code** where you want the form to appear:
```html
<div class="booking-container">
  <!-- PASTE YOUR EMBED CODE HERE -->
</div>
```

---

## 🎨 Customization Tips

### Making the Embed Look Better

#### Add Padding Around the Form
```html
<div style="padding: 20px;">
  <!-- Your embed code here -->
</div>
```

#### Center the Form
```html
<div style="max-width: 1200px; margin: 0 auto;">
  <!-- Your embed code here -->
</div>
```

#### Add a Shadow
```html
<div style="box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
  <!-- Your embed code here -->
</div>
```

---

## 🧪 Testing Your Integration

After adding the booking form to your website:

1. ✅ **Visit your website** and navigate to the booking page
2. ✅ **Check the form loads** - You should see "Book an Assessment"
3. ✅ **Test on mobile** - Ensure it displays correctly on phones
4. ✅ **Try making a test booking** - Go through the entire process
5. ✅ **Check your dashboard** - Verify the booking appears

---

## 🔧 Troubleshooting

### The form doesn't appear
- **Check you pasted the complete code** - Make sure nothing was cut off
- **Look for an HTML or Code block** - Some platforms don't allow code in regular text blocks
- **Try the responsive embed** instead of standard
- **Clear your browser cache** and refresh

### The form is cut off
- **Increase the height** - Use a larger size or custom height
- **Use responsive embed** - This automatically adjusts
- **Check mobile view** - May need different sizing for mobile

### Form appears but looks strange
- **Remove extra styling** from your page that might interfere
- **Use the responsive embed** for better compatibility
- **Contact support** if issues persist

---

## 📱 Mobile Optimization

The booking form is **automatically mobile-responsive**, but here are some tips:

### For Best Mobile Experience:
1. Use the **Responsive Embed Code** (not the Standard one)
2. Give the embed **full width** on mobile screens
3. Test on actual mobile devices, not just browser tools
4. Consider placing the form on a **dedicated booking page** rather than homepage

---

## 💡 Best Practices

### ✅ DO:
- Place booking form on an **easy-to-find page** ("Book Now", "Assessments", "Contact")
- Add a clear **"Book Assessment"** button in your main navigation
- Test the complete booking flow yourself
- Check bookings appear in your dashboard
- Promote the booking page on social media

### ❌ DON'T:
- Hide the booking form on a hard-to-find page
- Forget to test on mobile devices
- Use multiple embed codes on the same page
- Modify the embed code (unless you know what you're doing)

---

## 🎯 Recommended Page Setup

Create a dedicated "**Book an Assessment**" page on your website:

### Sample Page Structure:
```
📄 Book an Assessment

[Brief welcome text about your assessment process]

[Your booking form embedded here]

[FAQ section below, if needed]
```

### Example Welcome Text:
> "Book your child's assessment at [Your School Name]. Our team will 
> evaluate your child's needs and recommend the best program. 
> Choose a convenient time below."

---

## 🆘 Need Help?

If you encounter any issues:

1. **Check this guide** - Most common issues are covered above
2. **Contact support** - support@afterschool.com
3. **In your dashboard** - Click "Contact Support" in the sidebar

---

## 📊 Tracking Success

After integrating the booking system:

- Monitor your **Dashboard** for new bookings
- Check booking confirmation emails
- Review analytics (if you use Google Analytics, bookings will be tracked)
- Ask customers for feedback on the booking experience

---

## 🚀 Advanced Options

### Multiple Centres
If you have multiple locations:
- Create a **separate booking page** for each centre
- Or use the **"All Centres"** option to show a centre selector

### Custom Domain (Enterprise)
Want to use your own domain like `booking.yourschool.com`?
Contact support about enterprise options.

---

## ✅ Quick Checklist

Before going live, make sure you:

- [ ] Copied your booking link or embed code
- [ ] Added it to your website
- [ ] Tested the form loads correctly
- [ ] Checked mobile display
- [ ] Completed a test booking
- [ ] Verified booking appears in dashboard
- [ ] Added "Book Now" to your navigation menu
- [ ] Promoted your booking page

---

## 📞 Support

**Email:** support@afterschool.com  
**Dashboard Link:** [after-school-club-live.vercel.app](https://after-school-club-live.vercel.app)

---

*Last Updated: February 2026*
