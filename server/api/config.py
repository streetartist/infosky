from fastapi import APIRouter
from pydantic import BaseModel
from ..core.settings import settings

router = APIRouter()

class ConfigUpdate(BaseModel):
    api_key: str
    base_url: str
    model: str
    retrieval_mode: str = "rag"  # "basic" or "rag"

@router.get("/")
async def get_config():
    """Get current configuration (without exposing full API key)."""
    return {
        "api_key": settings.openai_api_key[:8] + "..." if settings.openai_api_key else "",
        "base_url": settings.openai_base_url,
        "model": settings.openai_model,
        "retrieval_mode": settings.retrieval_mode
    }

@router.post("/")
async def update_config(config: ConfigUpdate):
    """Update configuration."""
    settings.update_config(
        key=config.api_key,
        base_url=config.base_url,
        model=config.model,
        retrieval_mode=config.retrieval_mode
    )
    return {"message": "Configuration updated"}
