# GitHub Pages Deployment Guide

## Quick Setup (Choose One)

### Option A: Push to Existing GitHub Repository

```bash
cd /Users/siddhesh/Downloads/Apps/My_creations/Line-Accurate-main

# Set your GitHub repository URL (replace with your repo)
git remote add origin https://github.com/YOUR_USERNAME/Line-Accurate.git

# Rename branch to main if needed
git branch -M main

# Push to GitHub
git push -u origin main
```

### Option B: Create New Repository on GitHub

1. Go to [github.com/new](https://github.com/new)
2. Create repository named `Line-Accurate`
3. Copy the URL (HTTPS or SSH)
4. Run:

```bash
cd /Users/siddhesh/Downloads/Apps/My_creations/Line-Accurate-main
git remote add origin https://github.com/YOUR_USERNAME/Line-Accurate.git
git branch -M main
git push -u origin main
```

---

## Automatic GitHub Pages Setup

Once pushed, GitHub Actions will automatically:
1. Build your project (`npm run build`)
2. Deploy to GitHub Pages on every push to `main`
3. Make it live at: `https://YOUR_USERNAME.github.io/Line-Accurate/`

### Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Under "Source", select: **GitHub Actions** (should auto-detect)
3. Click "Save"
4. Wait 2-5 minutes for first deployment
5. Check the **Deployments** tab to see live URL

---

## Deployment Flow

```
You: git push
    ↓
GitHub: Detects push to main
    ↓
Actions: Run npm install + npm run build
    ↓
Actions: Upload dist/ to github-pages
    ↓
Pages: Deploy and go live
    ↓
Result: https://YOUR_USERNAME.github.io/Line-Accurate/
```

---

## Verify Deployment

Check the **Actions** tab in your repo to see:
- ✅ Build logs
- ✅ Deployment status  
- ✅ Live URL when complete

---

## Environment Configuration

If using environment variables, add GitHub Secrets:

1. **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add any required variables (currently none needed for this app)

---

## Custom Domain (Optional)

To use a custom domain instead of `github.io`:

1. Settings → Pages → Custom domain
2. Enter your domain (e.g., `lineaccurate.com`)
3. Point DNS to GitHub's servers:
   ```
   A record: 185.199.108.153
   A record: 185.199.109.153
   A record: 185.199.110.153
   A record: 185.199.111.153
   ```

---

## Commands Reference

```bash
# Check git status
git status

# View commits
git log --oneline

# Make changes and push
git add .
git commit -m "Your commit message"
git push

# View GitHub config
git remote -v
```

---

## Troubleshooting

### "fatal: not a git repository"
```bash
cd /Users/siddhesh/Downloads/Apps/My_creations/Line-Accurate-main
git status  # Should show master/main branch
```

### Pages not deploying
1. Check **Actions** tab for errors
2. Ensure workflow file exists: `.github/workflows/deploy.yml`
3. Go to **Settings → Pages → Source** and verify it's set to "GitHub Actions"

### Branch protection
If main is protected, create a PR instead of pushing directly

### Force push (if needed)
```bash
git push -u origin main --force
```

---

## After Deployment

Your app will be available at:
- **GitHub Pages**: `https://YOUR_USERNAME.github.io/Line-Accurate/`
- **Vercel** (optional): `https://line-accurate.vercel.app` (if connected to Vercel)

Both work independently!
