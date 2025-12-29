from pydantic_settings import BaseSettings
from typing import Literal

class Settings(BaseSettings):
    app_name: str = "InfoSky API"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.deepseek.com"
    openai_model: str = "deepseek-chat"
    
    # Retrieval mode: "basic" (keyword) or "rag" (vector)
    retrieval_mode: Literal["basic", "rag"] = "rag"
    
    OPENAI_TIMEOUT: int = 60
    OPENAI_MAX_RETRIES: int = 0
    
    class Config:
        env_file = ".env"

    def update_config(self, key: str, base_url: str, model: str, retrieval_mode: str = None, timeout: int = 60, max_retries: int = 0):
        self.openai_api_key = key
        self.openai_base_url = base_url
        self.openai_model = model
        if retrieval_mode:
            self.retrieval_mode = retrieval_mode
        self.OPENAI_TIMEOUT = timeout
        self.OPENAI_MAX_RETRIES = max_retries
        self.save_to_env()

    def save_to_env(self):
        env_content = f"""OPENAI_API_KEY="{self.openai_api_key}"
OPENAI_BASE_URL="{self.openai_base_url}"
OPENAI_MODEL="{self.openai_model}"
RETRIEVAL_MODE="{self.retrieval_mode}"
OPENAI_TIMEOUT={self.OPENAI_TIMEOUT}
OPENAI_MAX_RETRIES={self.OPENAI_MAX_RETRIES}
"""
        try:
            with open(".env", "w", encoding="utf-8") as f:
                f.write(env_content)
        except Exception as e:
            print(f"Failed to save .env: {e}")

settings = Settings()
