# Architecture.md

## High‑Level Overview
```
+---------------------+      +-------------------+      +-------------------+
|  Front‑End (HTML/   | <-- |  Django (WSGI)    | -->  |  PostgreSQL DB    |
|   CSS/JS)           |      |  (views, models)  |      |  (Northflank)     |
+---------------------+      +-------------------+      +-------------------+
          |                               |
          |                               |
          v                               v
   Cloudinary (Media CDN)          WhiteNoise (static files)
```

- **Django** handles routing, business logic, authentication, and the ORM.
- **PostgreSQL** is used in production (provisioned by Northflank). Locally we fall back to SQLite.
- **Cloudinary** stores uploaded images; URLs are saved in the `featured_image` field.
- **WhiteNoise** serves static files directly from the container; no external web‑server needed.
- **Docker** builds a lightweight image that runs `gunicorn` via `start.sh` which also runs `collectstatic` and migrations.
- **CI/CD** – GitHub Actions execute unit tests on every push; on success a Northflank build is triggered via API.

## Component Diagram
```
[User] --> (Browser) --> [Django] --> {Views, Models, Templates}
   |                                 |
   |                                 v
   |                           [PostgreSQL]
   |
   v
[Cloudinary]   (media CDN)
[WhiteNoise]   (static CDN)
```

## Key Packages
- `django==6.0.3`
- `django‑cloudinary‑storage==0.3.0`
- `whitenoise==6.12.0`
- `gunicorn==26.0.0`
- `crispy‑bootstrap4` for UI.

---

# Rules.md

## Coding Standards
- Follow **PEP‑8**; use `ruff` or `black` for formatting.
- Type‑hint public functions where feasible.
- Keep secret credentials out of source control – use `.env` and the `python‑dotenv` package.
- All models use singular names (`Blog`, `Category`, `Comment`).

## Security Rules
- `DEBUG=False` in production (controlled via env).
- Enable `CSRF_TRUSTED_ORIGINS` for Northflank sub‑domains.
- Use Django’s password validators (minimum length, similarity, etc.).
- Enforce HTTPS on Northflank; set `SECURE_SSL_REDIRECT=True` if needed.

## Permission Rules
- **Staff (`is_staff`)**: Full access to admin site, can manage all users, posts, categories, comments.
- **Regular Users**: Can only CRUD their own `Blog`, `Category`, and `Comment` objects. Attempts to modify others raise `PermissionDenied`.
- Custom admin classes filter the queryset by `author` for non‑staff users.

## Deployment Rules
- Dockerfile must expose port `8000` and run `gunicorn blog_main.wsgi:application`.
- `collectstatic` runs at container start via `start.sh`.
- CI workflow runs `python manage.py test`; on success triggers Northflank build.
- Do not commit `staticfiles/`, `media/`, or `.env` – they are in `.gitignore`.

---

# phases.md

| Phase | Goal | Main Tasks | Deliverable |
|-------|------|------------|------------|
| **1️⃣ Discovery** | Define MVP and requirements | Write PRD, outline data model | `PRD.md` |
| **2️⃣ Setup** | Scaffold project, CI/CD, Docker | `django-admin startproject`, `Dockerfile`, GitHub Actions | Repo skeleton |
| **3️⃣ Core Features** | Implement models, CRUD, auth | `blogs` app, `dashboards` UI, permission checks | Functional app |
| **4️⃣ Media Integration** | Add Cloudinary storage | Configure `django‑cloudinary‑storage`, update `ImageField` | Media works |
| **5️⃣ Security Harden** | CSRF, password validators, env secrets | Update `settings.py`, add `CSRF_TRUSTED_ORIGINS` | Secure config |
| **6️⃣ Testing** | Write unit tests, ensure CI passes | `tests.py`, run GitHub Actions | Green CI badge |
| **7️⃣ Deployment** | Docker build, Northflank deploy | Push to main, trigger pipeline | Live URL |
| **8️⃣ Documentation** | Produce interview artefacts | `Architecture.md`, `Rules.md`, `design.md`, `memory.md` | Final docs |

---

# design.md

## UI / UX
- **Bootstrap 4** layout via `crispy‑bootstrap4` for consistent styling.
- **Dashboard** with a vertical sidebar (links to dashboard, users, categories, posts). Active link highlighted using `request.path`.
- **Forms** use Django Crispy Forms – clean markup, responsive.
- **Post List** shows title, author, status, edit/delete icons (visible only to owners).
- **Category Table** displays name, creation & update timestamps with edit/delete actions.
- **Admin Site** mirrors custom permissions: staff sees all objects, regular users see only their own.

## Data Model Diagram
```
User (auth.User)
 ├─ owns ── Category (category_name, author)
 ├─ owns ── Blog (title, slug, category, author, featured_image, ...)
 └─ writes ── Comment (user, blog, comment)
```
- Every `Category` and `Blog` stores an `author` FK to the user who created it.
- `Comment` links both the commenting user and the target blog.

## Interaction Flow
1. **Signup / Login** → redirect to dashboard.
2. **Dashboard** shows counts of owned categories & posts.
3. **Add/Edit** → form auto‑assigns `author = request.user`.
4. **Delete** → permission check; then object is removed.
5. **Public Blog View** → anyone can read published posts; comment form appears for authenticated users.

---

# memory.md

## Runtime Memory Profile
- **ORM Queries** – Use `select_related('author', 'category')` on list views to avoid N+1 queries.
- **Pagination** – Implement `Paginator` for post listings to keep response payload < 100 KB.
- **Static Assets** – Served by WhiteNoise from the container; cached, no additional memory.
- **Media** – Only URLs (≈200 B) stored in DB; actual files reside on Cloudinary CDN.
- **Session Backend** – Default signed‑cookie sessions → minimal server memory.
- **Gunicorn** – Recommended `--workers 3 --worker-class sync` for a 512 MiB container; each worker < 120 MiB.
- **Database Connections** – `CONN_MAX_AGE=600` to reuse connections, reducing overhead.

## Monitoring Tools
- **django‑debug‑toolbar** (local) – view query count, time, memory.
- **Northflank metrics** – monitor container RSS/heap, CPU usage.
- **psutil** (optional) – script to log memory usage during load tests.

## Optimisation Tips
- Add indexes on `Blog.author`, `Category.author`, `Comment.user` for fast look‑ups.
- Enable `CompressedStaticFilesStorage` to serve gzipped assets.
- Cache expensive queries with `django.core.cache` if needed (e.g., homepage post list).

---

*These documents provide a complete interview‑ready overview of the project’s requirements, architecture, coding rules, development phases, UI design, and memory considerations.*
