# PRD (Product Requirements Document)

## 1️⃣ Overview
**Project:** Premium Blogging System
**Goal:** Provide a modern, multi‑user blogging platform where staff can manage all content while regular users can only create, edit, and delete *their own* posts, categories, and comments. Media assets are stored on Cloudinary; static files are served via WhiteNoise. The app is containerised and deployed on **Northflank** with automated CI/CD.

## 2️⃣ Core Requirements
| Category | Requirement | Acceptance Criteria |
|----------|-------------|----------------------|
| **Functional** | User registration & authentication | Users can sign‑up, login, and logout using Django’s built‑in auth. |
| | Role‑based access | `is_staff` users have full admin rights; normal users can only manage their own resources. |
| | CRUD for Blog Posts | Create, read, update, delete posts with title, slug, featured image, short description, body, status, and featured flag. |
| | CRUD for Categories | Users can create categories tied to their account; staff can manage all. |
| | Comments | Authenticated users can comment on published posts; can edit/delete own comments. |
| | Media handling | Images uploaded via `ImageField` are stored on **Cloudinary** and served via CDN URLs. |
| **Non‑functional** | Security | CSRF protection, password validators, secret keys stored in env, HTTPS enforced on Northflank. |
| | Performance | Static files served via WhiteNoise, DB queries optimized with `select_related` where appropriate. |
| | Deployability | Dockerised, CI runs unit tests, on success triggers a Northflank build. |
| | Scalability | Uses PostgreSQL in production, fallback SQLite locally. |
| | Maintainability | Clear separation of `blogs` and `dashboards` apps, custom admin filters for ownership.

## 3️⃣ Stakeholders
- **Product Owner / Recruiter** – wants a polished portfolio piece.
- **End Users** – blog readers & contributors.
- **Admin / Staff** – manage all content.
- **DevOps** – CI/CD & deployment pipeline.

## 4️⃣ Success Metrics
- 100 % test coverage for core models/views.
- Zero security warnings from Django checks.
- Deployments complete within 2 minutes on Northflank.
- < 200 ms average page load for the home page.

---

# Architecture.md

## 1️⃣ High‑Level Architecture
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
* **Django** – core web framework, handling routing, ORM, authentication.
* **PostgreSQL** – production DB (managed by Northflank). SQLite used locally.
* **Cloudinary** – external media storage; `django‑cloudinary‑storage` integrates with the `ImageField`.
* **WhiteNoise** – bundles and serves static assets directly from the container.
* **Northflank** – CI/CD platform; builds Docker image, runs migrations, starts Gunicorn.
* **Docker** – containerises the app; `start.sh` runs `collectstatic` and `migrate`.

## 2️⃣ Components
| Component | Responsibility |
|-----------|-----------------|
| `blogs` app | Data models (`Blog`, `Category`, `Comment`), public‑facing views, URL routing. |
| `dashboards` app | Auth‑protected admin‑style UI for users to manage their own content. |
| `blog_main` | Settings, root URLs, WSGI/Gunicorn entrypoint. |
| `admin.py` (custom) | Restricts staff viewsets to own objects for regular users. |
| `Dockerfile` | Builds a slim Python image, copies source, installs deps, sets entrypoint. |
| `start.sh` | Executes `collectstatic --noinput` and `migrate` before running Gunicorn. |
| CI workflow (`.github/workflows/deploy.yml`) | Runs unit tests on SQLite, then triggers Northflank build via API token. |

---

# Rules.md

## 1️⃣ Coding Standards
- **PEP‑8** compliance – use `black` or `ruff` locally.
- **Type hints** for functions and model methods where feasible.
- All **secret values** (`SECRET_KEY`, Cloudinary creds, NORTHFLANK_API_TOKEN) live in `.env` and are referenced via `os.getenv` – never committed.
- **Model naming**: singular (`Blog`, `Category`, `Comment`). Use `verbose_name_plural` where appropriate.

## 2️⃣ Security Rules
- Enable **CSRF_TRUSTED_ORIGINS** for Northflank sub‑domains.
- Enforce **Password Validators** (`UserAttributeSimilarityValidator`, `MinimumLengthValidator`, …).
- `DEBUG=False` in production (controlled via env flag).
- Restrict **admin site** to staff (`is_staff` flag) – custom ModelAdmins filter queryset by `author`.

## 3️⃣ Permission Rules
- Regular users can **only** CRUD their own `Blog`, `Category`, and `Comment` objects.
- Staff (`is_staff`) can manage *all* objects and users.
- `PermissionDenied` is raised for unauthorized actions (handled in `dashboards/views.py`).

## 4️⃣ Deployment Rules
- **Dockerfile** must expose port `8000` and run Gunicorn (`gunicorn blog_main.wsgi:application`).
- CI runs `python manage.py test` on every push; on success triggers Northflank build.
- `collectstatic` runs on container start – no static files should be committed.

---

# phases.md

## Project Lifecycle Phases
| Phase | Objectives | Deliverables |
|-------|------------|--------------|
| **1️⃣ Discovery** | Define MVP, gather requirements, outline data model. | PRD.md, initial wireframes. |
| **2️⃣ Architecture & Setup** | Initialise Django project, configure Docker, CI pipeline. | Repository scaffold, `Dockerfile`, `start.sh`, CI workflow. |
| **3️⃣ Core Development** | Implement models, CRUD views, role‑based permissions. | `blogs/`, `dashboards/`, custom admin. |
| **4️⃣ Media Integration** | Add Cloudinary storage, image handling, featured image field. | Cloudinary config, `ImageField` usage. |
| **5️⃣ Security Harden** | Add CSRF trusted origins, password validators, secret management. | Updated `settings.py`, `.env` handling. |
| **6️⃣ Testing & QA** | Write unit tests, run locally, fix failing tests. | Test suite, CI green. |
| **7️⃣ Deployment** | Build Docker image, push to Northflank, verify live site. | Live URL, CI/CD pipeline operational. |
| **8️⃣ Documentation** | Write README, license, interview artifacts (this set). | PRD, Architecture, Rules, Phases, Design, Memory docs. |

---

# design.md

## UI / UX Design
- **Responsive Bootstrap 4 layout** (via `crispy‑bootstrap4`).
- **Dashboard sidebar** with navigation links, highlights current page via `request.path`.
- **Forms** use Django Crispy Forms for consistent styling.
- **Post list** page shows title, author, category, status, with edit/delete icons for owners.
- **Category management** similar table view with inline edit/delete.
- **Admin site** mirrors custom permissions – staff sees all, regular users see only theirs.

## Data Model Diagram (simplified)
```
User (auth.User)
   |
   ├─< owns >─ Category (category_name, author)
   |
   ├─< owns >─ Blog (title, slug, category, author, featured_image, …)
   |
   └─< writes >─ Comment (user, blog, comment)
```
- Each `Category` and `Blog` has a foreign key to `User` (`author`).
- `Comment` links both `User` and `Blog`.

## Interaction Flow
1. **Signup/Login** → redirects to dashboard.
2. **Dashboard** shows counts of owned categories & posts.
3. **Add/Edit** → forms pre‑populate owner automatically (`post.author = request.user`).
4. **Delete** → permission checked, then object removed.
5. **Public view** → Anyone can read published posts; comment form visible only for authenticated users.

---

# memory.md

## Runtime Memory Considerations
- **ORM Query Size** – Use `select_related('author', 'category')` when listing posts to avoid N+1 queries.
- **Pagination** – Implement pagination on post list (`django.core.paginator`) to keep response size < 100 KB.
- **Static Files** – Served via WhiteNoise, compressed and cached; no extra memory overhead.
- **Cloudinary** – Images are stored externally; only a URL string (~200 B) is kept in the DB.
- **Session Storage** – Default signed cookie sessions – minimal server memory.
- **Gunicorn Workers** – Recommended **2‑4 workers** (`--workers 3`) for a 512 MB container to keep memory under 350 MB.
- **Database Connection Pool** – Django opens a single persistent connection; ensure `CONN_MAX_AGE=600` to reuse connections efficiently.

## Profiling Tools
- `django‑debug‑toolbar` (local dev) to monitor query counts & memory.
- `psutil` or container metrics (Northflank) to watch RSS/heap size.

---

*All files are ready for interview presentation. Feel free to adjust wording or add screenshots as needed.*
