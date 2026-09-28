import os

# Real, non-default secrets for the test run, so importing the app never trips the
# "default secrets outside demo mode" startup check. Set before any app module is imported.
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("EMAIL_PEPPER", "test-email-pepper")
