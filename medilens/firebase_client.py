"""
MediLens Firebase client — shared across all pipeline modules.
Reads service account from FIREBASE_CREDENTIALS env var (GitHub Actions secret).
"""
import json
import os
import firebase_admin
from firebase_admin import credentials, firestore

_app = None

def get_db():
    global _app
    if _app is None:
        # Standardized name is FIREBASE_SERVICE_ACCOUNT
        raw_cred = os.environ.get('FIREBASE_SERVICE_ACCOUNT') or os.environ.get('FIREBASE_CREDENTIALS')
        if not raw_cred:
            raise EnvironmentError("FIREBASE_SERVICE_ACCOUNT or FIREBASE_CREDENTIALS env var not set.")
        
        try:
            # Try parsing as direct JSON first
            cred_dict = json.loads(raw_cred)
        except json.JSONDecodeError:
            # If JSON fails, try decoding from Base64 (Standard for Github Secrets)
            try:
                import base64
                decoded_cred = base64.b64decode(raw_cred).decode('utf-8')
                cred_dict = json.loads(decoded_cred)
            except Exception as e:
                raise ValueError(f"Failed to parse Firebase credentials as JSON or Base64: {e}")

        cred = credentials.Certificate(cred_dict)
        _app = firebase_admin.initialize_app(cred)
    return firestore.client()
