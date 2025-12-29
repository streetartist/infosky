from server.core.settings import settings
from server.core.ai_processor import ai_processor
import asyncio

# Simulate config update
print(f"Old Key: {settings.openai_api_key}")
print(f"Old URL: {settings.openai_base_url}")

settings.update_config("new-key", "https://new.url", "new-model")

print(f"New Key: {settings.openai_api_key}")
print(f"New URL: {settings.openai_base_url}")

# Check if processor detects it
# We can't easily access the client internals from here without importing private members or adding debug prints in the class
# But we can verify the Settings singleton behavior.
