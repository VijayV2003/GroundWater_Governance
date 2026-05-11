# 🚀 Deployment Guide — Groundwater Intelligence Platform

This project is now divided into two self-contained applications to make hosting easy.

---

## 1. 🏗️ Backend (FastAPI + ML Models)
Located in `/backend`.

### **Hosting Options:** [Render](https://render.com), [Railway](https://railway.app), or [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform).

**Steps for Render:**
1. Create a new **Web Service**.
2. Connect your GitHub repository.
3. Set the Root Directory to `backend`.
4. **Environment:** Python
5. **Build Command:** `pip install -r requirements.txt`
6. **Start Command:** `gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000`
7. **Environment Variables:** Add all variables from `backend/.env` (SendGrid key, etc.) in the dashboard.

---

## 2. 🎨 Frontend (React)
Located in `/frontend`.

### **Hosting Options:** [Vercel](https://vercel.com), [Netlify](https://netlify.com), or [GitHub Pages](https://pages.github.com).

**Steps for Vercel:**
1. Create a new project and import your repository.
2. Set the Root Directory to `frontend`.
3. Vercel will automatically detect the build settings (`npm run build`).
4. **Environment Variables (CRITICAL):** 
   - Add `REACT_APP_API_BASE_URL` = (Your Backend URL).
   - Add `CI` = `false` (This prevents the build from failing due to minor linting warnings).
5. **Conflict Fix:** I have deleted the `yarn.lock` file from your project. Vercel was trying to use Yarn, but your project is built for NPM. Deleting it forces Vercel to use NPM correctly.
6. Click **Deploy**.

---

## 3. 🔥 Firebase (Database & Auth)
Your Firebase setup is already "cloud-hosted." 

**Crucial Step:**
In the [Firebase Console](https://console.firebase.google.com/):
1. Go to **Authentication** > **Settings** > **Authorized Domains**.
2. Add your new Vercel/Netlify frontend URL to the list so that logins work on the live site.

---

## Local Development (New Structure)
If you want to run it locally now:
- **Backend**: `cd backend && uvicorn main:app --reload`
- **Frontend**: `cd frontend && npm start`
