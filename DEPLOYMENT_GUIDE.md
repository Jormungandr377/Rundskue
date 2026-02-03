# 🚀 Finance Tracker Deployment Guide

This guide will help you deploy your Finance Tracker to Railway for web access.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app) (free tier available)
2. **Plaid Account**: Get your API keys from [dashboard.plaid.com](https://dashboard.plaid.com/)
3. **Git Repository**: Your code should be in a GitHub repository

## Step 1: Prepare Your Repository

Ensure your repository is pushed to GitHub with all the new deployment files:
- `railway.toml` - Railway configuration
- `nixpacks.toml` - Build configuration
- `package.json` - Root package file for builds
- Updated `backend/app/main.py` - Now serves frontend static files

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click "Start a New Project"
3. Choose "Deploy from GitHub repo"
4. Select your finance tracker repository

## Step 3: Configure Environment Variables

In Railway's project dashboard, add these environment variables:

### Required Variables:
```bash
# Database (Railway will provide this automatically with PostgreSQL addon)
DATABASE_URL=postgresql://postgres:password@hostname:5432/database

# Application Security
SECRET_KEY=your-super-secret-key-change-this-now
ENCRYPTION_KEY=your-32-character-encryption-key

# Plaid API Credentials
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret_key
PLAID_ENV=sandbox  # Use "development" or "production" for real banks

# Production Configuration
DEBUG=false
FRONTEND_URL=https://your-app-name.up.railway.app

# Optional
SYNC_HOUR=3  # Daily sync time (3 AM)
```

### Getting Plaid Credentials:
1. Sign up at [dashboard.plaid.com](https://dashboard.plaid.com/)
2. Get your `client_id` and secret from the dashboard
3. For testing: use `PLAID_ENV=sandbox`
4. For production: use `PLAID_ENV=production` (requires verification)

## Step 4: Add PostgreSQL Database

1. In Railway dashboard, click "Add Service"
2. Choose "Database" → "PostgreSQL"
3. Railway will automatically create a `DATABASE_URL` environment variable

## Step 5: Deploy

1. Railway will automatically deploy when you push to your main branch
2. The build process will:
   - Install Python dependencies
   - Install Node.js dependencies
   - Build the React frontend
   - Start the FastAPI backend

## Step 6: Access Your App

1. Railway will provide a URL like `https://your-app-name.up.railway.app`
2. Update the `FRONTEND_URL` environment variable with this URL
3. Your app will be live and accessible!

## Security Notes for Production

### For Plaid Production Environment:
- Set `PLAID_ENV=production`
- Your app MUST use HTTPS (Railway provides this automatically)
- You may need to verify your application with Plaid

### Environment Variables:
- Generate strong random values for `SECRET_KEY` and `ENCRYPTION_KEY`
- Never commit these to your repository
- Use Railway's environment variable interface

## Troubleshooting

### Build Issues:
- Check Railway's build logs in the dashboard
- Ensure all dependencies are listed in `requirements.txt` and `package.json`

### Database Issues:
- Verify `DATABASE_URL` is set correctly
- Check PostgreSQL service is running in Railway

### Plaid Issues:
- Verify credentials are correct
- Check Plaid environment setting
- Ensure webhook URLs (if used) point to your Railway domain

### Frontend Issues:
- Ensure React build completed successfully
- Check that static files are being served correctly

## Local Development vs Production

- **Local**: Frontend runs on port 3000, backend on 8000
- **Production**: Everything served from one Railway domain
- **API**: In production, frontend makes requests to `/api/*` (same domain)

## Cost Information

- Railway offers a free tier with limited usage
- PostgreSQL database is included in free tier
- Monitor usage in Railway dashboard
- Consider paid tier for production use

## Updates and Maintenance

- Push changes to GitHub to automatically redeploy
- Monitor application health via Railway dashboard
- Set up database backups for production data
- Monitor Plaid API usage and limits

## Next Steps After Deployment

1. **Set up monitoring**: Use Railway's metrics dashboard
2. **Configure backups**: Set up database backup schedule
3. **Custom domain**: Add your own domain in Railway settings
4. **SSL/TLS**: Already handled by Railway
5. **Environment promotion**: Create separate dev/staging environments

Your Finance Tracker is now live on the web! 🎉