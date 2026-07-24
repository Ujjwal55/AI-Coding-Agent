import os
import sys

# Load API key directly from .env for this test
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

print(f"Loaded GOOGLE_API_KEY: {api_key[:10]}...")

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    print("Testing gemini-3.1-flash-lite...")
    llm = ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite")
    response = llm.invoke("Hello, say 'Test successful'.")
    print("\nSUCCESS!")
    print(f"Response: {response.content}")
except Exception as e:
    print("\nFAILURE!")
    import traceback
    traceback.print_exc()

print("\n--- Testing gemini-1.5-flash ---")
try:
    llm2 = ChatGoogleGenerativeAI(model="gemini-1.5-flash")
    response2 = llm2.invoke("Hello, say 'Test successful'.")
    print("\nSUCCESS!")
    print(f"Response: {response2.content}")
except Exception as e:
    print("\nFAILURE!")
    import traceback
    traceback.print_exc()
