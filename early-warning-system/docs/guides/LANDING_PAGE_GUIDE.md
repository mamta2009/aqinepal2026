# LANDING PAGE INTEGRATION GUIDE

## What You Get

A professional, conversion-focused landing page that:
- ✅ Introduces your Early Warning System
- ✅ Explains the problem and solution
- ✅ Showcases features and impact
- ✅ Guides visitors to the dashboard
- ✅ Mobile-responsive
- ✅ Dark theme (matches dashboard)
- ✅ Production-ready

---

## FILE LOCATION

Production landing page in this repo: **`early-warning-system/landing/landing.html`**. The FastAPI app serves it at **`/`** when that file exists (`main.py`), with the dashboard at **`/frontend/index.html`**.

Older copies that expected `landing.html` inside `frontend/` are obsolete for this tree.

---

## HOW TO USE IT

### Option 1: Local development

```bash
cd early-warning-system/backend
python -m uvicorn main:app --reload
```

Open **`http://127.0.0.1:8000/`** (landing) or **`http://127.0.0.1:8000/frontend/index.html`** (dashboard). Do not rely on **`file://`** for the SPA if you want same-origin `/api` without extra setup.

### Option 2: FastAPI Backend (already integrated)

```text
`main.py` already mounts `/frontend`, serves `landing/landing.html` at `/`,
and exposes `/guides` when those files exist. No copy step required.
```

### Option 3: Render deployment

Ensure the web service runs **`python backend/main.py`** (or **`uvicorn`** with the same app). The repository layout already includes **`landing/`** beside **`backend/`** — do not strip it if you depend on **`/`** serving `landing.html`. Adjust **`staticPublishPath`** only if your host serves the dashboard as a separate static site.

```yaml
services:
  - type: web
    name: early-warning-api
    env: python
    buildCommand: pip install -r backend/requirements.txt
    startCommand: python backend/main.py
```

---

## LANDING PAGE FLOW

```
Visitor arrives
       ↓
Landing Page (what you see)
       ├─ Hero section (problem + solution)
       ├─ Features section (why it works)
       ├─ Stats section (quick metrics)
       ├─ Impact section (real results)
       ├─ CTA section (call to action)
       └─ Footer (links + info)
       ↓
[Enter Dashboard Button]
       ↓
Dashboard (index.html)
```

---

## CUSTOMIZATION

### Change the logo/title

Find this in landing.html:
```html
<a href="#" class="logo">
    <div class="logo-icon">⚠️</div>
    Early Warning System
</a>
```

Change to your organization name.

### Change the hero text

Find:
```html
<h1>Save Lives Through Early Warning</h1>
<p>Predict respiratory health surges...</p>
```

Update with your messaging.

### Update links

All buttons point to `/frontend/index.html`. If hosting differently:
```html
<!-- Change from: -->
<a href="/frontend/index.html" class="btn-primary">Enter Dashboard</a>

<!-- To: -->
<a href="index.html" class="btn-primary">Enter Dashboard</a>
<!-- or -->
<a href="https://your-domain.com/dashboard" class="btn-primary">Enter Dashboard</a>
```

### Update footer

```html
<p>Early Warning System for Respiratory Health • Nepal • Open-Source MIT License</p>
<p style="margin-top: 1rem; color: #475569;">Funded by UNICEF • Developed for health system strengthening</p>
```

### Change colors

The landing page uses these colors:
```css
Primary: #10b981 (Emerald green)
Secondary: #06b6d4 (Cyan)
Background: #0f172a (Dark blue)
Text: #e2e8f0 (Light gray)
```

To change, find and replace:
- `#10b981` → your primary color
- `#06b6d4` → your secondary color
- `linear-gradient(135deg, #10b981, #06b6d4)` → your gradient

---

## FEATURES OF THE LANDING PAGE

### 1. Navigation Bar
- Fixed, sticky header
- Logo with icon
- Navigation links
- "Enter Dashboard" CTA button
- Glassmorphism effect with blur

### 2. Hero Section
- Large, impactful headline
- Subheading with problem statement
- Two CTA buttons (primary + secondary)
- Trust badges (open-source, blockchain, AI)
- Animated background with gradients

### 3. Features Section
- 6 feature cards in responsive grid
- Icons + descriptions
- Hover animations
- Covers: Real-time data, AI, Blockchain, Mobile, Integration, Scalability

### 4. Stats Section
- 4 key metrics
- Shows proof of concept
  - 78% accuracy
  - 3-5 day warning
  - 8 cities
  - 46 facilities

### 5. Impact Section
- Two-column layout
- Left: Real impact metrics
- Right: Visual summary
- Lists key achievements
- Shows scalability

### 6. CTA Section
- Final call-to-action
- "Enter Dashboard" button
- Encourages exploration

### 7. Footer
- Footer links
- Open-source info
- UNICEF mention

---

## RESPONSIVE DESIGN

The landing page automatically adapts to:
- Desktop (1200px+)
- Tablet (768px-1199px)
- Mobile (< 768px)

On mobile:
- Navigation links hidden (kept clean)
- Single column layouts
- Touch-friendly buttons
- Optimized text sizes
- Full-width sections

---

## SEO & META TAGS

Update these for better search engine visibility:

```html
<!-- In <head> section -->
<title>Early Warning System - Respiratory Health Nepal</title>
<meta name="description" content="AI-powered early warning system for respiratory health surges. Save lives through 3-5 day advance predictions.">
<meta name="keywords" content="respiratory health, early warning, Nepal, UNICEF, climate health">
<meta name="author" content="Your Name">
<meta property="og:title" content="Early Warning System - Respiratory Health">
<meta property="og:description" content="Predict health surges. Prepare facilities. Save lives.">
<meta property="og:image" content="your-image.jpg">
```

---

## ANIMATIONS & EFFECTS

### Fade-in Animation
All sections fade in when page loads. Set in CSS:
```css
animation: fadeInUp 0.8s ease-out;
```

### Hover Effects
- Feature cards lift up on hover
- Buttons glow on hover
- Links change color on hover

### Smooth Scrolling
Clicking navigation links smoothly scrolls to sections.

### Scroll Effects
Navigation bar adds shadow when scrolling.

---

## ANALYTICS INTEGRATION

To track visitors, add Google Analytics:

```html
<!-- Add before </head> closing tag -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

Replace `GA_MEASUREMENT_ID` with your Google Analytics ID.

---

## INTEGRATION WITH DASHBOARD

### File Structure After Integration:

```
early-warning-system/
├── frontend/
│   ├── landing.html        ← Landing page
│   ├── index.html          ← Dashboard
│   └── styles.css          (optional)
├── backend/
│   └── main.py
├── README.md
└── ...
```

### How They Connect:

1. **Visitor lands on**: `https://your-app.onrender.com/`
   → Shows landing.html

2. **Visitor clicks "Enter Dashboard"**
   → Opens index.html

3. **User can go back**
   → Click logo/nav to return to landing

---

## DEPLOYMENT TO RENDER

### Step 1: Add landing.html to GitHub

```bash
cd early-warning-system/frontend
# landing.html is already here

git add landing.html
git commit -m "Add landing page"
git push
```

### Step 2: Update render.yaml

```yaml
services:
  - type: web
    name: early-warning-api
    env: python
    buildCommand: |
      cd backend
      pip install -r requirements.txt
    startCommand: |
      cd backend
      python main.py
    staticPublishPath: frontend
```

### Step 3: Deploy

Render auto-deploys. Landing page is automatically served!

---

## TESTING CHECKLIST

Before showing to UNICEF:

```
Desktop:
  ☐ All buttons work
  ☐ Links navigate correctly
  ☐ Hover effects work
  ☐ Colors look good
  ☐ Text is readable

Mobile:
  ☐ Layout adapts properly
  ☐ Buttons are tap-friendly
  ☐ No horizontal scroll
  ☐ Text sizes are readable
  ☐ Images load correctly

Functionality:
  ☐ "Enter Dashboard" button works
  ☐ Navigation links scroll to sections
  ☐ All links are functional
  ☐ Page loads quickly
  ☐ No console errors

Cross-browser:
  ☐ Chrome
  ☐ Firefox
  ☐ Safari
  ☐ Edge
```

---

## NEXT STEPS

1. **Customize**: Update colors, text, logo to match your branding
2. **Test**: Check all links and buttons
3. **Deploy**: Push to GitHub → Render auto-deploys
4. **Monitor**: Track visitor engagement
5. **Iterate**: Update based on feedback

---

## UNICEF SUBMISSION

When you show UNICEF:

1. **Tell them**: "Visit https://your-app.onrender.com"
2. **They see**: Professional landing page
3. **They click**: "Enter Dashboard"
4. **They see**: Working system with real data
5. **They're impressed**: Professional, complete solution

---

## SUPPORT

If you need to modify the landing page:

### Add a new section:

```html
<section class="section-name">
    <h2>Section Title</h2>
    <p>Content here</p>
</section>
```

### Add custom CSS:

```html
<style>
    .custom-class {
        property: value;
    }
</style>
```

### Add interactive elements:

```html
<script>
    document.getElementById('id').addEventListener('click', function() {
        // Do something
    });
</script>
```

---

## YOU'RE ALL SET!

The landing page is:
- ✅ Professional and production-ready
- ✅ Mobile responsive
- ✅ Fully customizable
- ✅ Seamlessly integrated
- ✅ SEO optimized
- ✅ Fast and efficient

Drop it in, customize it, and you're ready to show UNICEF a complete system! 🚀
