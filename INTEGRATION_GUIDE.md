# White-Label Booking Integration Guide

This guide provides multiple integration options for organizations to add their booking page to their website.

## Current Booking URL Structure

Your system already supports organization-specific booking URLs:
- **Single Centre**: `https://after-school-club-live.vercel.app/book/{org-slug}/{centre-slug}`
- **Multi-Centre Selector**: `https://after-school-club-live.vercel.app/book/{org-slug}`

## Integration Options (Ranked by Ease)

### Option 1: Direct Link (Easiest) ⭐

**Best for**: Quick setup, minimal technical requirements

Organizations simply link to their booking page from their website.

#### Implementation:
1. Provide the organization with their unique booking URL
2. They add a button/link on their website:

```html
<a href="https://after-school-club-live.vercel.app/book/sunshine-academy" 
   class="book-now-btn" 
   target="_blank">
  Book an Assessment
</a>
```

#### Pros:
- ✅ No technical integration needed
- ✅ Works immediately
- ✅ No CORS or security issues
- ✅ Easy to track with analytics

#### Cons:
- ❌ Takes users away from organization's site
- ❌ Less seamless experience

---

### Option 2: iFrame Embedding (Recommended) ⭐⭐⭐

**Best for**: Seamless integration, branded experience

Organizations embed the booking page directly into their website using an iframe.

#### Implementation:

**1. Add to organization's website:**

```html
<!-- Simple iframe -->
<iframe 
  src="https://after-school-club-live.vercel.app/book/sunshine-academy"
  width="100%"
  height="800px"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  allow="payment"
></iframe>

<!-- Responsive iframe (recommended) -->
<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
  <iframe 
    src="https://after-school-club-live.vercel.app/book/sunshine-academy"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
    allow="payment"
  ></iframe>
</div>
```

**2. Configuration needed in your app:**

Enable iframe embedding by configuring CSP headers and frame options.

#### Pros:
- ✅ Keeps users on organization's website
- ✅ Seamless branded experience
- ✅ Organization controls page layout
- ✅ Can customize iframe size/styling

#### Cons:
- ⚠️ Requires CSP header configuration
- ⚠️ Some UX limitations (scrolling, mobile)

---

### Option 3: JavaScript Widget (Advanced) ⭐⭐

**Best for**: Maximum flexibility and customization

Provide a JavaScript snippet that organizations can embed, similar to Calendly or Typeform.

#### Implementation:

**1. Organization adds to their website:**

```html
<!-- Load the widget script -->
<script src="https://after-school-club-live.vercel.app/widget.js"></script>

<!-- Initialize widget -->
<div id="booking-widget" data-org="sunshine-academy"></div>
<script>
  AfterSchoolBooking.init({
    element: '#booking-widget',
    organization: 'sunshine-academy',
    theme: 'light',
    primaryColor: '#6366f1'
  });
</script>
```

**OR as a popup/modal:**

```html
<button onclick="AfterSchoolBooking.open('sunshine-academy')">
  Book Now
</button>
```

#### Pros:
- ✅ Maximum flexibility
- ✅ Can be embedded or popup
- ✅ Customizable appearance
- ✅ Better mobile experience

#### Cons:
- ❌ Requires significant development
- ❌ More maintenance overhead

---

### Option 4: Custom Domain/Subdomain (Premium) ⭐⭐⭐⭐

**Best for**: Enterprise clients, fully white-labeled experience

Each organization gets their own subdomain or can use their own custom domain.

#### Examples:
- `booking.sunshine-academy.com` → Your booking system
- `sunshine-academy.yourbookingplatform.com` → Subdomain on your platform

#### Implementation:

**For Subdomains on your platform:**
1. Configure DNS wildcard: `*.yourbookingplatform.com`
2. Update Next.js config to handle subdomains
3. Route based on subdomain to organization

**For Custom Domains:**
1. Organization adds CNAME record
2. Configure SSL certificates (Vercel handles this automatically)
3. Verify domain ownership

#### Pros:
- ✅ Fully branded experience
- ✅ Complete control over URL
- ✅ Professional appearance
- ✅ Better SEO for organization

#### Cons:
- ❌ Complex setup
- ❌ DNS configuration required
- ❌ SSL certificate management

---

## Recommended Approach: Multi-Tier Strategy

Offer different integration options based on organization tier:

### Free/Basic Tier
- **Option 1**: Direct Link
- Simple, works immediately
- Perfect for getting started

### Professional Tier
- **Option 2**: iFrame Embedding
- Seamless integration
- Branded appearance
- Requires CSP configuration (we'll set this up)

### Enterprise Tier
- **Option 4**: Custom Domain
- Fully white-labeled
- Premium experience
- Full DNS and SSL support

---

## Next Steps

1. **Immediate**: Enable iFrame embedding (Option 2)
   - Configure CSP headers
   - Test iframe on sample organization site
   - Create embedding documentation

2. **Short-term**: Create embedding code generator
   - Add "Booking Link" section to organization settings
   - Provide copy-paste HTML/iframe code
   - Include customization options (color, size)

3. **Long-term**: Build JavaScript Widget (Option 3)
   - Develop embeddable widget
   - Add customization API
   - Create widget documentation

Would you like me to start with Option 2 (iFrame embedding) by configuring the necessary headers and creating an embedding code generator in the dashboard?
