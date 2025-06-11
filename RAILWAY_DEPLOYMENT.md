# Railway Deployment Guide for Playlist Wrapped

## 🚂 Why Railway is Perfect for This Project

- ✅ **Full persistent storage** - Your cache files will persist between deployments
- ✅ **Simple GitHub integration** - Deploy directly from your repository
- ✅ **Environment variables** - Easy setup in the dashboard
- ✅ **Affordable pricing** - Free $5 credit, then $5/month
- ✅ **No configuration files needed** - Railway auto-detects Node.js

## 🚀 Quick Deployment Steps

### 1. Prepare Your Repository
```powershell
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit your code
git commit -m "Initial commit - Ready for Railway deployment"

# Push to GitHub (create repo first on github.com)
git remote add origin https://github.com/yourusername/playlist-wrapped.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Railway

1. **Go to Railway:**
   - Visit [railway.app](https://railway.app)
   - Sign up/login with GitHub

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `playlist-wrapped` repository

3. **Railway Auto-Detection:**
   - Railway will automatically detect Node.js
   - It will use `npm start` command
   - No additional configuration needed!

### 3. Set Environment Variables

In your Railway project dashboard, go to **Variables** tab and add:

```
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
REDIRECT_URI=https://your-railway-app.railway.app/auth/callback
ADMIN_PASSWORD=your_secure_admin_password
DEFAULT_PLAYLIST_ID=1BZY7mhShLhc2fIlI6uIa4
NODE_ENV=production
```

### 4. Update Spotify App Settings

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Open your Spotify app
3. Add your Railway URL to **Redirect URIs:**
   ```
   https://your-railway-app.railway.app/auth/callback
   ```

### 5. Deploy and Test

1. **Automatic Deployment:**
   - Railway deploys automatically after connecting GitHub
   - Monitor deployment in Railway dashboard

2. **Get Your URL:**
   - Railway provides a unique URL like `https://your-app.railway.app`
   - You can also set up a custom domain

3. **Test Your App:**
   - Visit your Railway URL
   - Click "Dive In" to view cached data
   - Test admin panel at `/admin.html`

## 📁 Storage Benefits on Railway

Your current file-based caching will work perfectly:

- **Cache persistence**: Files in `backend/cache/` persist between deployments
- **No data loss**: Unlike Heroku's ephemeral storage
- **Fast access**: Direct file system access
- **No migration needed**: Your current code works as-is

## 🔄 Updating Your App

Railway supports automatic deployments:

```powershell
# Make changes to your code
git add .
git commit -m "Update features"
git push origin main
# Railway automatically redeploys!
```

## 🛠 Troubleshooting

### Port Configuration
Railway automatically sets the PORT environment variable. Your current code handles this:
```javascript
const PORT = process.env.PORT || 3000;
```

### Cache Directory
Ensure your cache directory exists. Railway preserves the directory structure from your repository.

### Logs
View real-time logs in Railway dashboard under the **Deploy** tab.

## 💰 Pricing

- **Free tier**: $5 credit (lasts ~1 month for small apps)
- **Pro plan**: $5/month for unlimited usage
- **No hidden fees**: Predictable pricing

## 🎯 Post-Deployment Checklist

- [ ] App loads at Railway URL
- [ ] Spotify OAuth works with new redirect URI
- [ ] Admin panel accessible at `/admin.html`
- [ ] Cache files persist after redeployment
- [ ] All badges and analytics display correctly

Your app is perfectly suited for Railway deployment! 🚀
