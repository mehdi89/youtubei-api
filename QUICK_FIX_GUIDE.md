# 🔧 Quick Fix Guide for Production Deployment Issues

## Issues Found in Your Terminal Output

### 1. ❌ **Syntax Error in SERVERS Array**
```bash
# WRONG (has comma after second IP)
SERVERS=("121.200.63.141" "103.204.80.53", "121.200.63.197")

# CORRECT
SERVERS=("121.200.63.141" "103.204.80.53" "121.200.63.197")
```

### 2. ❌ **Permission Denied Errors**
```
scp: dest open "/var/www/html/youtubei-api//youtube_cookies.txt": Permission denied
```

**Cause:** User `oisl` doesn't have write permission to `/var/www/html/youtubei-api/`

### 3. ❌ **SSH Authentication Failed**
```
oisl@121.200.63.141: Permission denied (publickey,password)
```

**Cause:** No SSH key set up, and password authentication is failing

### 4. ❌ **Container Not Found**
```
✗ YouTube API container not found
```

**Cause:** Container might not be running, or has a different name

---

## 🚀 Step-by-Step Fix

### Step 1: Set Up SSH Keys (REQUIRED)

```bash
# On your local machine
ssh-keygen -t ed25519 -C "your_email@example.com"  # If you don't have a key yet

# Copy key to each server
ssh-copy-id oisl@121.200.63.141
ssh-copy-id oisl@103.204.80.53
ssh-copy-id oisl@121.200.63.197

# Test connection (should NOT ask for password)
ssh oisl@121.200.63.141 "echo 'SSH works!'"
```

### Step 2: Fix Directory Permissions

```bash
# On EACH server, run:
ssh oisl@121.200.63.141

# Once logged in:
sudo chown -R oisl:oisl /var/www/html/youtubei-api
sudo chmod 755 /var/www/html/youtubei-api

# Verify
ls -la /var/www/html/youtubei-api
# Should show: drwxr-xr-x ... oisl oisl ...

# Exit
exit
```

### Step 3: Verify Docker Container is Running

```bash
# Check on each server
ssh oisl@121.200.63.141 'docker ps'

# Should see something like:
# CONTAINER ID   IMAGE               NAMES
# abc123...      youtubei-api-prod   youtubei-api-prod

# If NOT running:
ssh oisl@121.200.63.141 'cd /var/www/html/youtubei-api && docker-compose up -d'
```

### Step 4: Use the Fixed Script

```bash
cd /Users/mehdi/Work/TubeOnAI/youtubei-api

# Use the FIXED version
./setup-production-cookies-fixed.sh
```

---

## 🔍 Manual Deployment (If Script Still Fails)

Do this for EACH server:

```bash
SERVER="121.200.63.141"  # Change for each server
USER="oisl"
APP_DIR="/var/www/html/youtubei-api"

# 1. Upload cookies
scp youtube_cookies.txt ${USER}@${SERVER}:${APP_DIR}/

# 2. SSH into server
ssh ${USER}@${SERVER}

# 3. Go to app directory
cd ${APP_DIR}

# 4. Check if file uploaded
ls -la youtube_cookies.txt
# Should show: -rw-r--r-- 1 oisl oisl 1356 ... youtube_cookies.txt

# 5. Find your container name
docker ps

# 6. Restart container (use your actual container name)
docker restart CONTAINER_NAME
# or
docker-compose restart

# 7. Verify cookies loaded
docker logs CONTAINER_NAME --tail 20 | grep cookie
# Should see: "✅ Found cookies file: youtube_cookies.txt"

# 8. Test API
curl http://localhost:3000/api/hello
# Should return: {"message":"Hello from YouTube API","cookies_enabled":true}

# 9. Exit server
exit
```

Repeat for all 3 servers.

---

## ✅ Verification Checklist

After running on each server, verify:

- [ ] SSH key authentication works (no password prompt)
- [ ] Directory permissions are correct (`ls -la /var/www/html/youtubei-api`)
- [ ] Container is running (`docker ps`)
- [ ] Cookie file uploaded (`ls -la /var/www/html/youtubei-api/youtube_cookies.txt`)
- [ ] Logs show cookies loaded (`docker logs CONTAINER_NAME | grep cookie`)
- [ ] API responds (`curl http://localhost:3000/api/hello`)
- [ ] cookies_enabled is true

---

## 🆘 Troubleshooting Commands

```bash
# Check SSH connection
ssh oisl@121.200.63.141 "echo 'Connected!'"

# Check directory exists
ssh oisl@121.200.63.141 "ls -la /var/www/html/youtubei-api"

# Check Docker is running
ssh oisl@121.200.63.141 "docker ps"

# Check what containers are running
ssh oisl@121.200.63.141 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

# Check app directory path
ssh oisl@121.200.63.141 "find /var/www -name docker-compose.yml"

# View container logs
ssh oisl@121.200.63.141 "docker logs CONTAINER_NAME --tail 50"

# Test API from server
ssh oisl@121.200.63.141 "curl http://localhost:3000/api/hello"
```

---

## 📝 Summary of Changes Needed

1. **Fix script syntax:** Remove comma from SERVERS array ✅ (already done in fixed script)
2. **Set up SSH keys:** Run `ssh-copy-id oisl@SERVER` for each server
3. **Fix permissions:** Run `sudo chown -R oisl:oisl /var/www/html/youtubei-api` on each server
4. **Verify containers running:** Make sure Docker containers are started
5. **Use fixed script:** Run `./setup-production-cookies-fixed.sh`

---

## 🎯 Quick One-Liner for Each Server

```bash
# Server 1
ssh-copy-id oisl@121.200.63.141 && \
ssh oisl@121.200.63.141 'sudo chown -R oisl:oisl /var/www/html/youtubei-api && docker ps'

# Server 2
ssh-copy-id oisl@103.204.80.53 && \
ssh oisl@103.204.80.53 'sudo chown -R oisl:oisl /var/www/html/youtubei-api && docker ps'

# Server 3
ssh-copy-id oisl@121.200.63.197 && \
ssh oisl@121.200.63.197 'sudo chown -R oisl:oisl /var/www/html/youtubei-api && docker ps'
```

Then run:
```bash
./setup-production-cookies-fixed.sh
```

---

**Need help?** Run the troubleshooting commands above to diagnose which step is failing.

