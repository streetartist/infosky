import asyncio
import os
from openai import AsyncOpenAI
import dotenv

# Load .env manually to be sure
dotenv.load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
base_url = os.getenv("OPENAI_BASE_url") or os.getenv("OPENAI_BASE_URL", "https://api.deepseek.com")
model = os.getenv("OPENAI_MODEL", "deepseek-chat")

print(f"Testing Connection...")
print(f"Base URL: {base_url}")
print(f"Model: {model}")
print(f"API Key: {api_key[:5]}...{api_key[-4:] if api_key else 'None'}")

if not api_key:
    print("ERROR: No API Key found in .env")
    exit(1)

client = AsyncOpenAI(api_key=api_key, base_url=base_url)

async def test():
    try:
        print("\nSending request...")
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Hello, are you online?"}],
        )
        print("\nSuccess!")
        print("Response:", response.choices[0].message.content)
    except Exception as e:
        print(f"\nCONNECTION FAILED: {type(e).__name__}")
        print(f"Error details: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test())
