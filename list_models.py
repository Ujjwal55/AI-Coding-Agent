import os
import sys

env_file = ".env"
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            if line.startswith("GOOGLE_API_KEY="):
                os.environ["GOOGLE_API_KEY"] = line.strip().split("=", 1)[1]

api_key = os.environ.get("GOOGLE_API_KEY")
if not api_key:
    print("No GOOGLE_API_KEY found.")
    sys.exit(1)

from google import genai
try:
    client = genai.Client(api_key=api_key)
    print("Available models:")
    for model in client.models.list():
        print(model.name)
except Exception as e:
    print("Failed to list models:", e)
