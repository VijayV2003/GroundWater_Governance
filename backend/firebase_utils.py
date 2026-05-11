import os
import requests
import logging

logger = logging.getLogger(__name__)

FIREBASE_PROJECT_ID = "groundwater-46059"

def fetch_policy_maker_emails() -> list:
    """
    Dynamically fetches emails of users with role 'policymaker' from Firestore.
    Uses the REST API to avoid heavy firebase-admin dependencies in lightweight hosting.
    """
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/users"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        emails = []
        documents = data.get("documents", [])
        
        for doc in documents:
            fields = doc.get("fields", {})
            role = fields.get("role", {}).get("stringValue")
            email = fields.get("email", {}).get("stringValue")
            
            if role == "policymaker" and email:
                emails.append(email)
        
        # If no emails found via API, fallback to .env for safety
        if not emails:
            env_emails = os.getenv("POLICY_MAKERS_EMAILS")
            if env_emails:
                emails = [e.strip() for e in env_emails.split(",") if e.strip()]
        
        return list(set(emails)) # Unique emails
        
    except Exception as e:
        logger.error(f"⚠️ Failed to fetch policy makers from Firebase: {e}")
        # Fallback to .env
        env_emails = os.getenv("POLICY_MAKERS_EMAILS")
        if env_emails:
            return [e.strip() for e in env_emails.split(",") if e.strip()]
        return []
