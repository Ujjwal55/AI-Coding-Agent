import urllib.request
import json
import os
import sys

env_file = ".env"
api_key = None
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            if line.startswith("GOOGLE_API_KEY="):
                api_key = line.strip().split("=", 1)[1]

if not api_key:
    print("No GOOGLE_API_KEY found in .env")
    sys.exit(1)

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
req = urllib.request.Request(url)

try:
    response = urllib.request.urlopen(req)
    res_body = json.loads(response.read())
    print("--- Available Models ---")
    for model in res_body.get('models', []):
        print(f"{model['name']} (version: {model.get('version', 'N/A')}) - {model.get('displayName', '')}")
except Exception as e:
    print("FAILURE!", e)
