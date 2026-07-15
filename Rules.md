# Rules.md

## Coding Standards
- **PEP‑8** compliance throughout the codebase. Use `black` or `ruff` for automatic formatting.
- **Type hints** for public functions, model methods, and view signatures where feasible.
- Keep **secret credentials** out of source control – all secrets (`SECRET_KEY`, Cloudinary keys, Northflank token) reside in `.env` and are loaded with `python‑dotenv`.
- Follow **singular model naming** (`Blog`, `Category`, `Comment`) and use `verbose_name_plural` where needed.
- Use **Crispy Forms** (`crispy‑bootstrap4`) for consistent UI rendering.

## Security Rules
- `DEBUG=False` in production; controlled via the `DEBUG` env variable.
- Add `CSRF_TRUSTED_ORIGINS` for Northflank sub‑domains to avoid CSRF errors.
- Enable Django’s built‑in **password validators** (minimum length, similarity, common password, numeric). 
- Force HTTPS on Northflank (`SECURE_SSL_REDIRECT=True` if required).
- All database connections use environment‑provided `DATABASE_URL`; fallback to SQLite locally.

## Permission Rules
- **Staff users (`is_staff`)** have unrestricted admin access and can manage all objects, including users.
- **Regular users** can only create, read, update, and delete **their own** `Blog`, `Category`, and `Comment` objects.
  - This is enforced in `dashboards/views.py` via `PermissionDenied` checks.
  - Custom admin classes (`CategoryAdmin`, `blogAdmin`, `CommentAdmin`) filter the queryset to the logged‑in user when `is_superuser` is `False`.
- Attempting to access or modify another user’s resources results in a **403 Forbidden** response.

## Deployment Rules
- **Dockerfile** must expose port `8000` and run `gunicorn blog_main.wsgi:application`.
- `start.sh` runs `collectstatic --noinput` and `python manage.py migrate` before starting the server.
- The CI pipeline (`.github/workflows/deploy.yml`) runs unit tests on every push; on success it triggers a Northflank build via API token.
- Do **not** commit `staticfiles/`, `media/`, or `.env` – they are listed in `.gitignore`.

---

# phases.md

| Phase | Goal | Main Tasks | Deliverable |
|-------|------|------------|------------|
| **1️⃣ Discovery** | Define product scope and requirements | Write PRD, sketch data model | `PRD.md` |
| **2️⃣ Setup** | Scaffold project, CI/CD, Docker | `django-admin startproject`, create `Dockerfile`, CI workflow | Repository skeleton |
| **3️⃣ Core Development** | Implement models, CRUD, auth, permissions | `blogs` app, `dashboards` UI, custom admin filters | Functional application |
| **4️⃣ Media Integration** | External media storage | Configure `django‑cloudinary‑storage`, add `ImageField` to `Blog` | Cloudinary‑backed images |
| **5️⃣ Security Harden** | Protect against CSRF, enforce password policy | Update `settings.py`, add `CSRF_TRUSTED_ORIGINS` | Secure configuration |
| **6️⃣ Testing** | Verify correctness, CI green | Write unit tests, run `python manage.py test` locally & via GitHub Actions | Passed CI badge |
| **7️⃣ Deployment** | Containerised production rollout | Build Docker image, push to Northflank, monitor logs | Live URL on Northflank |
| **8️⃣ Documentation** | Prepare interview artefacts | Write Architecture, Rules, Design, Memory docs | `Architecture.md`, `Rules.md`, `design.md`, `memory.md` |

---

# design.md

## UI / UX Overview
- **Bootstrap 4** + **Crispy‑Bootstrap4** for responsive, clean forms and tables.
- **Dashboard layout** with a vertical sidebar (links to dashboard, users, categories, posts). Current page highlighted using `request.path`.
- **Tables** for categories and posts use hover effects and inline edit/delete icons (visible only to owners).
- **Forms** auto‑populate the `author` field in views (`post.author = request.user`).
- **Admin site** mirrors the same permission logic – staff sees all, regular users see only their own objects.

## Data Model Diagram (simplified)
```
User (auth.User)
 ├─ owns ── Category (category_name, author)
 ├─ owns ── Blog (title, slug, category, author, featured_image, ...)
 └─ writes ── Comment (user, blog, comment)
```
- Every `Category` and `Blog` contains an `author` FK to the user that created it.
- `Comment` links both the commenting user and the target blog.

## Interaction Flow
1. **Signup / Login** → Redirect to the custom dashboard.
2. **Dashboard** displays count of owned categories and posts.
3. **Add / Edit** → Forms automatically assign the current user as `author`.
4. **Delete** → Permission check (`is_staff` or object.author) before deletion.
5. **Public Blog View** → Anyone can read published posts; authenticated users can add comments.

---

# memory.md

## Runtime Memory Considerations
- **ORM Queries** – Use `select_related('author', 'category')` on list views to avoid N+1 queries.
- **Pagination** – Implement `django.core.paginator` for post listings; keeps each response < 100 KB.
- **Static Files** – Served via WhiteNoise, compressed and cached; negligible memory impact.
- **Media** – Only the Cloudinary URL (≈200 B) is stored in the database; actual image files reside on the CDN.
- **Session Backend** – Default signed‑cookie sessions; minimal server memory usage.
- **Gunicorn Workers** – Recommended 2‑4 workers (`--workers 3`) for a 512 MiB container, keeping each worker under ~120 MiB.
- **Database Connection Pool** – `CONN_MAX_AGE=600` to reuse connections and reduce overhead.

## Profiling & Monitoring
- **django‑debug‑toolbar** (local) – monitors query count, execution time, and memory per request.
- **Northflank metrics** – view container RSS/heap, CPU, and response latency.
- Optional custom script using **psutil** to log memory usage during load testing.

## Optimisation Tips
- Add DB indexes on `Blog.author`, `Category.author`, `Comment.user` for fast look‑ups.
- Enable `CompressedStaticFilesStorage` to serve gzipped assets.
- Cache expensive queries (e.g., homepage post list) with Django’s cache framework if needed.
- Keep the number of Gunicorn workers in line with container memory limits.

---

*These documents form a complete interview‑ready package covering requirements, architecture, coding rules, development phases, UI design, and memory/performance considerations.*
