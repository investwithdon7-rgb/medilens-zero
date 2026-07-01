"""
Deploy firestore.rules via the Firebase Rules REST API.

Used by .github/workflows/05-deploy-firestore-rules.yml. We deploy through the
REST API (not `firebase deploy`) because the CLI performs a Service Usage API
check (serviceusage.services.get) that the Firebase Admin SDK service account
lacks, causing a 403. The Rules REST API needs only firebaserules permissions,
which the pipeline service account already has.

Reads the same FIREBASE_SERVICE_ACCOUNT secret the rest of the pipeline uses
(raw JSON or base64). Creates a new ruleset from firestore.rules and points the
`cloud.firestore` release at it.
"""
import base64
import json
import os
import sys
import urllib.request
import urllib.error

from google.oauth2 import service_account
import google.auth.transport.requests as gtr

API = "https://firebaserules.googleapis.com/v1"
RULES_FILE = os.path.join(os.path.dirname(__file__), os.pardir, "firestore.rules")


def _load_sa() -> dict:
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT") or os.environ.get("FIREBASE_CREDENTIALS")
    if not raw:
        sys.exit("FIREBASE_SERVICE_ACCOUNT (or FIREBASE_CREDENTIALS) not set.")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return json.loads(base64.b64decode(raw).decode("utf-8"))


def _token(sa: dict) -> str:
    creds = service_account.Credentials.from_service_account_info(
        sa, scopes=["https://www.googleapis.com/auth/firebase"])
    creds.refresh(gtr.Request())
    return creds.token


def _api(method: str, url: str, token: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {url} -> HTTP {e.code}\n{e.read().decode()[:500]}")


def main() -> None:
    sa = _load_sa()
    project = sa["project_id"]
    token = _token(sa)

    with open(RULES_FILE, encoding="utf-8") as f:
        rules_src = f.read()

    # 1. Create a ruleset from the current firestore.rules.
    ruleset = _api("POST", f"{API}/projects/{project}/rulesets", token, {
        "source": {"files": [{"name": "firestore.rules", "content": rules_src}]}
    })
    ruleset_name = ruleset["name"]
    print(f"Created ruleset: {ruleset_name}")

    # 2. Point the cloud.firestore release at the new ruleset.
    release_name = f"projects/{project}/releases/cloud.firestore"
    _api("PATCH", f"{API}/{release_name}", token, {
        "release": {"name": release_name, "rulesetName": ruleset_name}
    })
    print(f"Released firestore.rules -> {release_name}")
    print("Firestore rules deployed successfully.")


if __name__ == "__main__":
    main()
