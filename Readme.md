# Premium Blogging System 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/python-3.13%20%7C%203.12-blue)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6.0%20%7C%205.1-green)](https://www.djangoproject.com/)
[![Northflank](https://img.shields.io/badge/Deployed%20on-Northflank-purple)](https://northflank.com/)
[![Cloudinary](https://img.shields.io/badge/Media%20Storage-Cloudinary-orange)](https://cloudinary.com/)

---

## 📖 Project Overview

**Premium Blogging System** is a full‑stack Django application that lets users create, manage, and share blog posts.  The project was built **entirely by hand – no AI assistance** – to showcase strong Python/Django fundamentals, secure handling of media files, CI/CD automation, and a polished admin experience.

Key highlights:
- Multi‑user support with staff/admin roles.
- **Fine‑grained permissions** – regular users can only edit their own posts, categories, and comments; staff members have full control.
- Media stored in **Cloudinary** for fast, globally‑cached delivery.
- Production‑ready containerised deployment on **Northflank** with automated migrations & static‑file handling.
- GitHub Actions pipeline runs unit tests and triggers a Northflank build only on successful test runs.

---

## ✨ Features

| Feature | Description |
|---|---|
| **User Management** | Staff (`is_staff`) users can manage all content, while normal users only see and edit their own posts, categories, and comments. |
| **Category Ownership** | Each `Category` records the author, enabling per‑user filtering in both the dashboard and the Django admin. |
| **Rich Text Blog Posts** | Supports title, slug, featured image (uploaded to Cloudinary), short description, body, status (Draft/Published), and a featured flag. |
| **Comments** | Authenticated users can leave comments on published posts. |
| **Responsive Dashboard** | Custom dashboard with quick stats, CRUD for posts/categories, and user management for staff. |
| **Static Files** | Served via **WhiteNoise** from the `staticfiles/` directory – no external web‑server required. |
| **CI/CD** | GitHub Actions runs tests, then triggers a Northflank build via a secure API token. |
| **Containerisation** | Dockerfile builds a lightweight container with all dependencies, runs migrations and starts Gunicorn. |

---

## 🛠️ Tech Stack

- **Backend**: Python 3.13, Django 6.0 (compatible with Django 5.1) 
- **Database**: PostgreSQL (managed by Northflank) – falls back to SQLite for local development.
- **Media Storage**: Cloudinary (`django‑cloudinary‑storage`).
- **Static Files**: WhiteNoise (`CompressedStaticFilesStorage`).
- **Container**: Docker & Gunicorn.
- **CI**: GitHub Actions.
- **Hosting**: Northflank.

---

## 📦 Quick Start (Local Development)

1. **Clone the repo**
   ```bash
   git clone https://github.com/<your‑username>/premium‑blogging‑system.git
   cd premium‑blogging‑system
   ```
2. **Create a virtual environment & install dependencies**
   ```bash
   python3 -m venv blog1
   source blog1/bin/activate
   pip install -r requirements.txt
   ```
3. **Create a `.env` file** (see the example below) – include your Cloudinary credentials and, if you wish, a local PostgreSQL URL.
   ```env
   SECRET_KEY=your‑django‑secret
   DEBUG=True
   ALLOWED_HOSTS=*

   # Cloudinary (media)
   CLOUDINARY_CLOUD_NAME=your‑cloud
   CLOUDINARY_API_KEY=1234567890
   CLOUDINARY_API_SECRET=your‑api‑secret

   # Optional: local Postgres (or keep the default SQLite)
   # DATABASE_URL=postgresql://user:pass@localhost:5432/blogdb?sslmode=disable
   ```
4. **Apply migrations & create a superuser**
   ```bash
   python manage.py migrate
   python manage.py createsuperuser   # follow prompts
   ```
5. **Run the development server**
   ```bash
   python manage.py runserver
   ```
   Open `http://127.0.0.1:8000/` – the site is ready!

---

## 🚀 Production Deployment (Northflank)

1. **Northflank Service** – create a new service, select **Docker**, and point it to this repository.
2. **Environment Variables** – add the same keys from `.env` (except `DEBUG`).
3. **Build & Deploy** – the GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically triggers a Northflank build after successful tests.
4. **Static Files** – `start.sh` runs `collectstatic` on container start, so all CSS/JS and admin assets are ready.
5. **Database** – Northflank’s managed PostgreSQL instance is referenced via the `DATABASE_URL` secret.

---

## 🔐 Permissions & Security

- **Staff (`is_staff`)** – full CRUD access in the admin and dashboard, can manage users.
- **Regular Users** – can create/edit/delete *their own* posts, categories, and comments. Attempts to edit others raise `PermissionDenied` (HTTP 403).
- **CSRF Protection** – `CSRF_TRUSTED_ORIGINS` configured for Northflank sub‑domains.
- **Secret Management** – All sensitive data (DB URL, Cloudinary keys, Northflank token) are stored as **environment secrets**, never committed.

---

## 🧪 Testing

The repository includes a minimal test suite. Run it locally with:
```bash
DATABASE_URL="" python manage.py test
```
The GitHub Actions workflow executes the same command on every push to `main`.

---

## 📚 Documentation & Further Reading

- **Django docs** – https://docs.djangoproject.com/en/stable/
- **Cloudinary integration** – https://cloudinary.com/documentation/django_integration
- **Northflank deployment guide** – https://northflank.com/docs
- **WhiteNoise static files** – https://whitenoise.evans.io/en/stable/



## 🛠️ Backend Architecture Deep Dive

- **Core Apps**: `blogs` (holds `Blog`, `Category`, `Comment` models) and `dashboards` (custom CRUD UI for authenticated users). Each `Category` and `Blog` records its creator via a `ForeignKey` to `auth.User`, enabling per‑user ownership checks.
- **Permissions**:
  - Regular users can **create**, **read**, **update**, and **delete** only their own posts, categories, and comments. This is enforced both in the custom dashboard views (using `PermissionDenied`) and in the Django admin (`CategoryAdmin`, `blogAdmin`, `CommentAdmin` with overridden `get_queryset`, `save_model`, and permission methods).
  - Staff members (`is_staff` / `is_superuser`) have unrestricted access across the admin and dashboard.
- **Media Management**: Images uploaded via `ImageField` are stored on **Cloudinary** using `django‑cloudinary‑storage`. The `featured_image` field automatically uploads files to Cloudinary, returning a CDN‑optimized URL.
- **Static Files**: Served by **WhiteNoise** (`CompressedStaticFilesStorage`) directly from the container’s `staticfiles/` directory, eliminating the need for an external web server.
- **Database Layer**: In production the app connects to a managed **PostgreSQL** instance on Northflank (configured through the `DATABASE_URL` environment variable). For local development it falls back to SQLite.
- **Environment Configuration**: Sensitive settings (`SECRET_KEY`, Cloudinary credentials, Northflank token) are loaded from a `.env` file using `python‑dotenv`, keeping secrets out of version control.
- **CI/CD Pipeline**: GitHub Actions runs unit tests (`python manage.py test`). On success it triggers a Northflank build via a secure API token, ensuring that only passing code reaches production.

Feel free to explore the code, raise issues, or request a demo!

---

## 📄 License

© 2026 **Aryan Yadav**

This project is licensed under the **MIT License**. See the `LICENSE` file for the full license text.


Feel free to explore the code, raise issues, or request a demo!

---

## 📄 License

This project is licensed under the **MIT License** – see `LICENSE` for details.