import urllib.request
import urllib.error
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

def test_model(model_name):
    print(f"\n--- Testing {model_name} ---")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    
    data = {
        "contents": [{"parts":[{"text": "Hello, this is a test."}]}]
    }
    
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), method='POST')
    req.add_header('Content-Type', 'application/json')
    
    try:
        response = urllib.request.urlopen(req)
        print(f"SUCCESS! {model_name} is valid and accessible.")
        res_body = json.loads(response.read())
        print(f"Response: {res_body['candidates'][0]['content']['parts'][0]['text']}")
    except urllib.error.HTTPError as e:
        print(f"FAILURE! HTTP Error {e.code}: {e.reason}")
        print(e.read().decode())
    except Exception as e:
        print(f"FAILURE! {type(e).__name__}: {e}")

test_model("gemini-3.1-flash-lite")
test_model("gemini-1.5-flash")
