# 🚀 Production Deployment Guide

## Quick Overview

Your YouTube API needs **fresh YouTube cookies** to avoid bot detection. This guide shows you how to deploy with cookies properly configured.

---

## 📋 Prerequisites

1. ✅ SSH access to your production servers
2. ✅ Docker installed on servers
3. ✅ Fresh `youtube_cookies.txt` file (less than 7 days old recommended)

---

## 🍪 Step 1: Get Fresh YouTube Cookies

### Method 1: Browser Extension (Recommended)

1. **Install Extension:**
   - Chrome: [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - Firefox: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

2. **Export Cookies:**
   ```bash
   # On your local machine:
   # 1. Visit youtube.com and make sure you're logged in
   # 2. Click the extension icon
   # 3. Export cookies for youtube.com
   # 4. Save as: youtube_cookies.txt
   ```

3. **Verify Format:**
   ```bash
   # Should see lines like:
   head -5 youtube_cookies.txt
   # Expected output:
   # .youtube.com	TRUE	/	TRUE	1234567890	COOKIE_NAME	cookie_value
   ```

### Method 2: Using yt-dlp (Alternative)

```bash
# Extract from your browser
yt-dlp --cookies-from-browser chrome --cookies youtube_cookies.txt https://www.youtube.com
```

---

## 🚀 Step 2: Deploy to Production

### Option A: Automated Script (Recommended)

```bash
# 1. Make sure youtube_cookies.txt is in your project root
cd /Users/mehdi/Work/TubeOnAI/youtubei-api

# 2. Update server IPs in the script if needed
nano setup-production-cookies.sh
# Edit SERVERS=("YOUR_SERVER_IP_1" "YOUR_SERVER_IP_2")
# Edit APP_DIR="/home/forge/YOUR_ACTUAL_PATH"

# 3. Run the setup script
./setup-production-cookies.sh
```

**What the script does:**
- ✅ Uploads your cookies to production
- ✅ Sets correct file permissions
- ✅ Restarts Docker containers
- ✅ Verifies cookies are working
- ✅ Shows container logs

### Option B: Manual Deployment

```bash
# 1. SSH into your server
ssh forge@YOUR_SERVER_IP

# 2. Navigate to your app directory
cd /home/forge/app.tubeonai.com

# 3. Upload cookies from your local machine (in another terminal)
scp youtube_cookies.txt forge@YOUR_SERVER_IP:/home/forge/app.tubeonai.com/

# 4. Back on the server, set permissions
chmod 644 youtube_cookies.txt

# 5. Restart the container
docker-compose restart
# or
docker restart youtubei-api-prod

# 6. Verify cookies are loaded
docker logs youtubei-api-prod | grep cookie
# Should see: "✅ Found cookies file: youtube_cookies.txt"

# 7. Test the API
curl http://localhost:3000/api/hello
# Should show: "cookies_enabled": true
```

---

## ✅ Step 3: Verify Deployment

### Test on Server

```bash
# 1. Check container is running
docker ps | grep youtube

# Expected output:
# CONTAINER ID   IMAGE               STATUS                   PORTS
# abc123def456   youtubei-api-prod   Up 5 minutes (healthy)   0.0.0.0:3000->3000/tcp

# 2. Check cookies are detected
docker logs youtubei-api-prod --tail 20 | grep cookie
# Should see: "✅ Found cookies file: youtube_cookies.txt"

# 3. Test API endpoint
curl http://localhost:3000/api/hello
# Should return: {"message":"Hello from YouTube API","cookies_enabled":true}

# 4. Test actual video (the one that was failing)
curl -X POST http://localhost:3000/api/video-details \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"tMsXTxOu-GA"}'
# Should return video details without errors
```

### Test from Outside

```bash
# From your local machine
curl -X POST http://YOUR_SERVER_IP:3000/api/video-details \
  -H "api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"id":"dQw4w9WgXcQ"}'
```

---

## 🔍 Troubleshooting

### Issue 1: "Sign in to confirm you're not a bot"

**Problem:** Cookies are expired or not loaded

**Solution:**
```bash
# 1. Check if cookies file exists
ssh forge@SERVER 'ls -la /home/forge/app.tubeonai.com/youtube_cookies.txt'

# 2. Check if it's a file (not a directory)
ssh forge@SERVER 'file /home/forge/app.tubeonai.com/youtube_cookies.txt'
# Should say: "ASCII text"

# 3. Check container logs
ssh forge@SERVER 'docker logs youtubei-api-prod | grep -i cookie'

# 4. If not found, re-upload cookies
scp youtube_cookies.txt forge@SERVER:/home/forge/app.tubeonai.com/
ssh forge@SERVER 'cd /home/forge/app.tubeonai.com && docker-compose restart'
```

### Issue 2: "[Errno 21] Is a directory: 'youtube_cookies.txt'"

**Problem:** Docker created a directory instead of mounting a file

**Solution:**
```bash
# 1. Remove the directory
ssh forge@SERVER 'rm -rf /home/forge/app.tubeonai.com/youtube_cookies.txt'

# 2. Upload the actual file
scp youtube_cookies.txt forge@SERVER:/home/forge/app.tubeonai.com/

# 3. Restart container
ssh forge@SERVER 'cd /home/forge/app.tubeonai.com && docker-compose restart'
```

### Issue 3: Container not starting

**Problem:** Configuration or Docker issues

**Solution:**
```bash
# 1. Check container logs
ssh forge@SERVER 'docker logs youtubei-api-prod --tail 50'

# 2. Check if port is available
ssh forge@SERVER 'netstat -tulpn | grep 3000'

# 3. Check docker-compose.yml
ssh forge@SERVER 'cat /home/forge/app.tubeonai.com/docker-compose.yml'

# 4. Rebuild and restart
ssh forge@SERVER 'cd /home/forge/app.tubeonai.com && docker-compose down && docker-compose up -d'
```

### Issue 4: cookies_enabled: false

**Problem:** Cookie file not in expected location or wrong format

**Solution:**
```bash
# Check what the API sees
ssh forge@SERVER << 'EOF'
  cd /home/forge/app.tubeonai.com
  docker exec youtubei-api-prod ls -la /app/*.txt
  docker exec youtubei-api-prod cat /app/youtube_cookies.txt | head -5
EOF

# If empty or wrong, re-upload
scp youtube_cookies.txt forge@SERVER:/home/forge/app.tubeonai.com/
ssh forge@SERVER 'cd /home/forge/app.tubeonai.com && docker-compose restart'
```

---

## 🔄 Cookie Refresh Schedule

YouTube cookies typically expire after **7-30 days**. Set up a reminder to refresh them:

### Manual Refresh

```bash
# Every 7 days or when you see bot detection errors:
cd /path/to/youtubei-api
# 1. Export fresh cookies from your browser
# 2. Save as youtube_cookies.txt
# 3. Run deployment script
./setup-production-cookies.sh
```

### Automated Reminder (Optional)

```bash
# Add to your calendar or crontab
# Weekly reminder to refresh YouTube cookies
0 9 * * 1 echo "Time to refresh YouTube cookies!" | mail -s "YouTube API Maintenance" your@email.com
```

---

## 📊 Monitoring

### Check Cookie Status

```bash
# Create this alias for quick checking
alias youtube-api-status='ssh forge@SERVER "docker logs youtubei-api-prod --tail 20 | grep -E \"cookie|ERROR|SUCCESS\""'

# Usage
youtube-api-status
```

### Watch Live Logs

```bash
# Monitor in real-time
ssh forge@SERVER 'docker logs -f youtubei-api-prod'

# Filter for errors
ssh forge@SERVER 'docker logs -f youtubei-api-prod | grep -E "ERROR|bot"'
```

---

## ✅ Production Checklist

Before considering deployment complete:

- [ ] `youtube_cookies.txt` uploaded to server
- [ ] File permissions set (644)
- [ ] Container restarted
- [ ] Logs show: "✅ Found cookies file"
- [ ] API responds: `{"cookies_enabled": true}`
- [ ] Test video works without bot detection
- [ ] Health check returns 200 OK
- [ ] No 500 errors in logs
- [ ] All endpoints tested

---

## 🆘 Emergency Procedures

### If API is Down

```bash
# Quick recovery steps:
ssh forge@SERVER << 'EOF'
  cd /home/forge/app.tubeonai.com
  
  # 1. Check container status
  docker ps -a | grep youtube
  
  # 2. View recent logs
  docker logs youtubei-api-prod --tail 100
  
  # 3. Restart container
  docker-compose restart
  
  # 4. If still down, rebuild
  docker-compose down
  docker-compose up -d
  
  # 5. Monitor logs
  docker logs -f youtubei-api-prod
EOF
```

### If Bot Detection Persists

```bash
# Nuclear option: Complete cookie refresh
# 1. Export FRESH cookies (make sure you're logged into YouTube)
# 2. Upload to server
scp youtube_cookies.txt forge@SERVER:/home/forge/app.tubeonai.com/

# 3. Completely restart everything
ssh forge@SERVER << 'EOF'
  cd /home/forge/app.tubeonai.com
  docker-compose down
  docker system prune -f
  docker-compose build --no-cache
  docker-compose up -d
  docker logs -f youtubei-api-prod
EOF
```

---

## 📞 Support

If issues persist after following this guide:

1. **Check logs:** `docker logs youtubei-api-prod --tail 100`
2. **Test locally:** `docker-compose up` in dev environment
3. **Verify cookies:** Make sure they're from a logged-in YouTube session
4. **Update yt-dlp:** Cookies format may have changed

---

**Last Updated:** November 15, 2025  
**Status:** Production Ready ✅

