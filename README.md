# AWB MATHS HUB — FINAL STEP 10 BUILD

**Tagline:** Learn the Concept. Solve the Problem. Master Mathematics.

A full-stack BCA Mathematics-I learning platform branded as **AWB MATHS HUB**, powered by AWB VERSE and taught by **AYAN** in Hinglish.

## What is included — Steps 1 → 10

### 1–5: Learning product
- Premium black / white / yellow cinematic UI
- BCA Mathematics-I Modules I–V
- Concepts + formulas + topic progress
- Formula Vault
- Practice Mode
- Quiz Mode
- 10-minute Exam Mode
- Mistake Book
- XP + streak + quiz history

### 6–8: Accounts, database, admin
- Student email/password signup and login
- bcrypt password hashing
- JWT HttpOnly cookie session
- PostgreSQL persistence
- Cross-device progress when the same database is used
- Guest Mode
- Separate AYAN Admin role
- Admin analytics
- Admin question and formula management
- Rate limiting + Helmet security headers

### 9: AI Teacher AYAN
- `ASK AYAN AI` inside the student app
- Hinglish teaching prompt
- Concept → Formula → Worked Steps → Common Mistake → Mini Practice loop
- Syllabus boundary covering Modules I–V
- OpenAI-compatible provider configuration through environment variables
- Built-in fallback response when no AI key is configured
- AI API key is never stored in frontend code

### 10: Finalization / deployment
- Production Dockerfile
- Docker Compose with PostgreSQL
- Render deployment blueprint
- GitHub Actions verification workflow
- Syntax + package/file verification script
- Windows one-click starter
- `.env` protection in Git
- Production notes and backup guidance

## Syllabus basis
The module structure follows the supplied BCA Mathematics-I syllabus: Module I differentiation, Module II partial differentiation/Jacobians, Module III integration/double integration/area, Module IV differential equations, and Module V matrix theory/eigenvalues/Cayley-Hamilton.

The built-in questions are labelled **syllabus-structured/model-created**. They are not claimed to be exact teacher/class questions. Add exact class questions through the admin panel when you have them.

## Option A — Windows + PostgreSQL (recommended for local development)

### 1. Install
- Node.js LTS
- PostgreSQL

### 2. Create database
Create a database named:
`awb_maths_hub`

Run `database/schema.sql` in pgAdmin Query Tool.

### 3. Configure backend
Copy:
`backend/.env.example` → `backend/.env`

Set:
- `DATABASE_URL`
- `JWT_SECRET` (32+ random characters)
- Optional `AI_API_URL`
- Optional `AI_API_KEY`
- Optional `AI_MODEL`

### 4. Start
Double-click:
`START-AWB-MATHS-HUB.bat`

Or manually:
```bash
cd backend
npm install
npm start
```

Open:
`http://localhost:3000`

## Admin setup
1. Create your own account normally from Sign Up.
2. In pgAdmin run:
```sql
UPDATE users SET role='admin' WHERE email='YOUR_ADMIN_EMAIL';
```
3. Log out and log in again.
4. `AYAN ADMIN` appears in the navigation.

Student passwords are never displayed by the admin API.

## Option B — Docker: easiest complete local stack
From the project root:
```bash
docker compose up --build
```

Open:
`http://localhost:3000`

The first PostgreSQL container startup runs `database/schema.sql` automatically. Change the example database password and JWT secret before using this beyond local testing.

To stop:
```bash
docker compose down
```

To remove the local database volume too:
```bash
docker compose down -v
```

## AI Teacher configuration
The backend accepts an OpenAI-compatible chat-completions endpoint.

Example environment variables:
```env
AI_API_URL=https://YOUR_PROVIDER/v1/chat/completions
AI_API_KEY=YOUR_SECRET_KEY
AI_MODEL=YOUR_MODEL
```

Do **not** put the key in `frontend/index.html`, `frontend/api.js`, GitHub, or screenshots.

If `AI_API_URL` or `AI_API_KEY` is blank, the site still runs and AYAN uses a deterministic fallback instead of pretending a live AI call happened.

## GitHub
Create a private/public repository as you prefer, then:
```bash
git init
git add .
git commit -m "AWB MATHS HUB final"
git branch -M main
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

Before pushing, verify that `backend/.env` does not exist in the staged files.

## Deployment
### Render
The repository includes `render.yaml` for a Node web service plus PostgreSQL database. Connect the repository to Render and use the blueprint. Set the AI variables only if you want live AI.

### Other hosts
Any Node host that can run Express and reach PostgreSQL can host the app. The app serves the frontend from the same Express server, so a separate frontend host is not required.

## Production checklist
- Use a strong unique `JWT_SECRET`.
- Use a managed PostgreSQL database with backups.
- Keep `AI_API_KEY` secret.
- Use HTTPS in production.
- Set `NODE_ENV=production`.
- Review rate limits for your expected traffic.
- Add your final Ayan photo/logo assets only after confirming their paths.
- Replace placeholder contact/QR assets with your final assets.

## Verification
From project root:
```bash
cd backend
npm install
npm run verify
```

The verifier checks required files and JavaScript syntax and confirms key product markers exist.

## Brand / contact placeholders
- Brand: AWB VERSE
- Teacher: AYAN
- Instagram: @aiwaalebhaiyaa
- Email: imayanmukhtar@gmail.com
- UPI support: 6206968585@superyes

## Disclaimer
AWB MATHS HUB is an independent student project and is not officially affiliated with Sarala Birla University.
