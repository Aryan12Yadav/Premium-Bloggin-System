# Premium Blogging System 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6.0-green)](https://www.djangoproject.com/)
[![Deployed on](https://img.shields.io/badge/Deployed%20on-Northflank-purple)](https://northflank.com/)
[![Cloudinary](https://img.shields.io/badge/Media%20Storage-Cloudinary-orange)](https://cloudinary.com/)
[![AI Copilot](https://img.shields.io/badge/AI%20Copilot-FastAPI%20%2B%20RAG-brightgreen)](https://social-blogging-copilot-api.onrender.com)

---

## 📖 About This Project

**Premium Blogging System** is a full-stack web application I built from scratch using **Python** and **Django**. It allows multiple users to create, manage, and share blog posts on a clean, responsive platform.

This project helped me practice real-world backend development skills — authentication, file uploads, database design, permissions, deployment, and now AI integration. I built everything step-by-step while learning Django, so this is both a learning project and a working product.

What makes this project special is the **AI Blog Copilot** — a floating chatbot I integrated that is powered by a custom FastAPI backend using **LangChain RAG (Retrieval-Augmented Generation)**. Users can chat with the AI directly on the website to find blogs, ask questions, and get article summaries.

---

## ✨ Features

### 🔑 Core Blogging Features
| Feature | Description |
|---|---|
| **User Authentication** | Register, Login, Logout with session management |
| **Blog Posts** | Create/Edit/Delete posts with title, slug, body, short description, status (Draft / Published), and featured image |
| **Categories** | Organize posts into categories with ownership tracking |
| **Comments** | Authenticated users can comment on published posts |
| **Featured Posts** | Mark blogs as featured to highlight them on the home page |
| **Search** | Search blogs by keyword across titles and descriptions |
| **Responsive Design** | Bootstrap 4 layout that works on mobile and desktop |

### 🛡️ Permissions System
| Role | What They Can Do |
|---|---|
| **Regular User** | Create, edit, and delete **their own** posts, categories, and comments only |
| **Staff / Admin** | Full access to all content, user management, and Django admin panel |

### 🤖 AI Blog Copilot (New!)
A floating chatbot widget sits in the **bottom-right corner** of every page. It connects to a custom AI backend and lets users:
- Ask questions about any blog post or category in natural language
- Get AI-generated summaries of articles
- Explore what content is available on the platform
- Maintain their own **private multi-turn conversation** — each user's chat history is saved separately

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.10+, Django 6.0 |
| **Database** | PostgreSQL (production via Neon/Northflank), SQLite (local dev) |
| **Media Storage** | Cloudinary via `django-cloudinary-storage` |
| **Static Files** | WhiteNoise (`CompressedStaticFilesStorage`) |
| **Forms** | Django Crispy Forms + Bootstrap 4 |
| **AI Copilot API** | FastAPI + LangChain + PGVector + Groq LLM (hosted on Render) |
| **Containerization** | Docker + Gunicorn |
| **CI/CD** | GitHub Actions |
| **Hosting** | Northflank (main app) + Render (AI Copilot API) |

---

## 🤖 AI Copilot Architecture

The AI Copilot is a completely separate FastAPI service I built at:
```
https://social-blogging-copilot-api.onrender.com
```

It uses **RAG (Retrieval-Augmented Generation)** — the AI doesn't just guess answers, it actually reads from the real blog database to give accurate responses.

```
User types a question in the chatbot widget
            │
            ▼
    FastAPI Backend (Render)
            │
            ├── Content Moderation Layer  →  Blocks harmful/abusive queries
            │
            ├── Conversational Memory  ←→  PostgreSQL (chat_history table)
            │
            ├── RAG Vector Engine  ←→  PGVector / FAISS (blog embeddings)
            │
            ├── LLM (Groq / OpenAI)  →  Generates the final answer
            │
            └── JSON Response  →  Rendered in the floating chat window
```

**Per-User Conversation Isolation:**
- Logged-in users get their own conversation thread scoped to their User ID (`conv_u<id>_...`)
- Guest visitors get a session UUID stored in `localStorage`
- Chat history is restored automatically when you reopen the chat window
- Each user's conversation is completely private — no data leakage between users

---

## 📁 Project Structure

```
blogging system/
│
├── blog_main/                  # Main Django project settings
│   ├── settings.py             # All configurations (DB, Cloudinary, WhiteNoise)
│   ├── urls.py                 # Root URL routing
│   ├── views.py                # Home, login, register, logout views
│   └── static/
│       ├── css/
│       │   ├── blog.css        # Main blog styling (Playfair Display serif)
│       │   └── chatbot.css     # AI Copilot floating widget styling
│       └── js/
│           └── chatbot.js      # AI Copilot client logic (per-user memory, API calls)
│
├── blogs/                      # Blog app (posts, categories, comments)
│   ├── models.py               # Blog, Category, Comment models
│   ├── views.py                # Blog list, detail, category, search views
│   └── urls.py                 # Blog URL patterns
│
├── dashboards/                 # Custom admin dashboard
│   ├── views.py                # CRUD views with permission checks
│   └── urls.py                 # Dashboard URL patterns
│
├── assignments/                # About page content model
│
├── templates/
│   ├── base.html               # Base template (navbar, footer, chatbot widget)
│   ├── home.html               # Home page with featured + regular posts
│   ├── blogs.html              # Individual blog post view
│   ├── search.html             # Search results page
│   ├── includes/
│   │   └── chatbot.html        # Floating AI Copilot widget HTML
│   └── dashboard/
│       ├── dashboard.html      # Dashboard home with stats cards
│       ├── posts.html          # Manage posts table
│       ├── categories.html     # Manage categories table
│       ├── users.html          # User management (staff only)
│       └── sidebar.html        # Dashboard sidebar navigation
│
├── media/                      # Local media files (uploaded images)
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Production Docker image
├── start.sh                    # Container startup script (collectstatic + gunicorn)
└── manage.py                   # Django management entry point
```

---

## ⚙️ Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Aryan12Yadav/Premium-Bloggin-System.git
cd "Premium-Bloggin-System"
```

### 2. Create Virtual Environment
```bash
python3 -m venv blog1
source blog1/bin/activate       # Linux / Mac
# blog1\Scripts\activate        # Windows
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a `.env` file in the project root (copy from `.env.example`):
```env
# Django Core Settings
SECRET_KEY=your-long-random-secret-key-here
DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

# Neon PostgreSQL (or leave blank to use SQLite for local dev)
DATABASE_URL=

# Cloudinary Media Storage
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```
> **Tip:** If you leave `DATABASE_URL` blank, Django automatically uses SQLite for local development.

### 5. Apply Migrations
```bash
python manage.py migrate
python manage.py createsuperuser   # create your admin account
```

### 6. Run the Development Server
```bash
python manage.py runserver
```
Open **http://127.0.0.1:8000/** — the site is live!

The **AI Copilot chatbot** connects to the live Render API automatically, so it works out of the box without any extra setup.

---

## 🚀 Production Deployment (Northflank + Render)

### Main Django App → Northflank

1. Push code to GitHub (already done via CI/CD)
2. On Northflank: create a new **Docker** web service pointing to this repo
3. Add environment variables (same as `.env`, but without `DEBUG`)
4. The `start.sh` script runs `collectstatic` + starts Gunicorn automatically
5. GitHub Actions triggers a new Northflank build on every successful `git push` to `main`

### AI Copilot API → Render
The FastAPI backend is deployed separately at:
```
https://social-blogging-copilot-api.onrender.com
```
Source code: [github.com/Aryan12Yadav/social_blogging_copilot_api](https://github.com/Aryan12Yadav/social_blogging_copilot_api)

---

## 🧪 Running Tests

```bash
# Run all Django tests
DATABASE_URL="" python manage.py test

# Check for project issues
python manage.py check
```

The GitHub Actions workflow runs tests automatically on every push to `main`. A Northflank deployment is triggered only if tests pass.

---

## 📡 AI Copilot API Reference

The chatbot widget communicates with these endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Check API health, DB connection, indexed docs count |
| `POST` | `/api/chat` | Send a message, get AI response with sources |
| `GET` | `/api/chat/history/{conversation_id}` | Load past messages for a conversation |
| `GET` | `/api/categories` | List all blog categories |
| `GET` | `/api/blogs` | List all published blogs |
| `POST` | `/api/summarize/{blog_id}` | Get a 3-bullet summary of a specific post |

**Example Chat Request:**
```json
POST /api/chat
{
  "message": "What blogs are available about finance?",
  "conversation_id": "conv_u1_abc123"
}
```

**Example Response:**
```json
{
  "conversation_id": "conv_u1_abc123",
  "answer": "We have 2 finance blogs:\n1. Stock Market for Beginners - What is an ETF?\n2. How to Write a One-Page Business Plan",
  "sources": [
    { "title": "Stock Market for Beginners", "category": "Business and Finance", "author": "akarsh" }
  ],
  "status": "success"
}
```

---

## 🔐 Security & Permissions

- **CSRF Protection** — enabled across all forms and configured for Northflank domains
- **Password Hashing** — Django's built-in PBKDF2 hashing
- **Permission Checks** — views raise `PermissionDenied` (HTTP 403) if a user tries to edit someone else's content
- **Secret Management** — all credentials in `.env`, never committed to version control
- **Content Moderation** — AI Copilot API blocks abusive language and prompt injection before hitting the LLM
- **XSS Protection** — all user-generated content escaped in JavaScript with a custom `escapeHtml()` helper

---

## 📸 Screenshots

> _Run the server locally and visit http://127.0.0.1:8000/ to see the homepage, blog posts, dashboard, and the floating AI Copilot chatbot in the bottom-right corner._

---

## 🤔 What I Learned

Building this project taught me:
- How Django's **MTV architecture** works in practice (Models, Templates, Views)
- Writing **permission-based views** from scratch without relying on third-party packages
- Integrating **third-party storage** (Cloudinary) with Django's file fields
- Setting up **Docker + Gunicorn** for production deployment
- Building and connecting a **FastAPI microservice** for AI features
- How **RAG (Retrieval-Augmented Generation)** works — embeddings, vector stores, and LLM chains
- Writing clean **JavaScript** for API-driven UI components with per-user state management
- Setting up **GitHub Actions** for CI/CD automation

---

## 📄 License

© 2026 **Aryan Yadav**

This project is licensed under the **MIT License** — see the [`LICENSE`](LICENSE) file for details.

---

> Built with ❤️ by [Aryan Yadav](https://github.com/Aryan12Yadav) — A student learning Django one feature at a time.
