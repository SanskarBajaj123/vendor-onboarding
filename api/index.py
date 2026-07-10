import sys
import os

# Vercel runs from the project root, so `api/` is not on sys.path by default.
# Add it so that `from app.main import app` resolves to api/app/main.py.
sys.path.insert(0, os.path.dirname(__file__))

from app.main import app  # noqa: F401 — Vercel looks for `app` in this file
