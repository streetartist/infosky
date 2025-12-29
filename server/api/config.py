from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select
from ..core.settings import settings
from ..database.database import get_session
from ..database.models import SystemConfig
from datetime import datetime

router = APIRouter()

class ConfigUpdate(BaseModel):
    api_key: str
    base_url: str
    model: str
    retrieval_mode: str = "rag"  # "basic" or "rag"

def _get_config_from_db(session: Session):
    configs = session.exec(select(SystemConfig)).all()
    config_dict = {c.key: c.value for c in configs}
    return config_dict

def _update_settings_from_db(session: Session):
    """Sync in-memory settings with DB"""
    db_config = _get_config_from_db(session)
    if "openai_api_key" in db_config:
        settings.openai_api_key = db_config["openai_api_key"]
    if "openai_base_url" in db_config:
        settings.openai_base_url = db_config["openai_base_url"]
    if "openai_model" in db_config:
        settings.openai_model = db_config["openai_model"]
    if "retrieval_mode" in db_config:
        settings.retrieval_mode = db_config["retrieval_mode"]

@router.get("/")
async def get_config(session: Session = Depends(get_session)):
    """Get current configuration (reads from DB if available, else falls back to env)."""
    # Ensure in-memory settings are up to date
    _update_settings_from_db(session)
    
    # Return redacted key for display
    key = settings.openai_api_key
    display_key = ""
    if key and len(key) > 8:
        display_key = key[:3] + "..." + key[-4:]
    elif key:
        display_key = key[:2] + "***"
        
    return {
        "api_key": display_key,
        "base_url": settings.openai_base_url,
        "model": settings.openai_model,
        "retrieval_mode": settings.retrieval_mode
    }

@router.post("/")
async def update_config(config: ConfigUpdate, session: Session = Depends(get_session)):
    """Update configuration in Database and Memory."""
    
    # Helper to update or create
    def upsert(key, value):
        statement = select(SystemConfig).where(SystemConfig.key == key)
        record = session.exec(statement).first()
        if not record:
            record = SystemConfig(key=key, value=value)
        else:
            record.value = value
            record.updated_at = datetime.utcnow()
        session.add(record)

    # Only update API Key if it's not the masked version (contains '...' and is short)
    # or if we can verify it's changed. 
    # Valid keys are usually long.
    should_update_key = True
    if "..." in config.api_key and len(config.api_key) < 20:
        print("DEBUG: Received masked key, ignoring update for api_key")
        should_update_key = False
    
    if should_update_key:
        upsert("openai_api_key", config.api_key)
        
    upsert("openai_base_url", config.base_url)
    upsert("openai_model", config.model)
    upsert("retrieval_mode", config.retrieval_mode)
    
    session.commit()
    
    # Update in-memory settings immediately
    settings.update_config(
        key=config.api_key if should_update_key else settings.openai_api_key,
        base_url=config.base_url,
        model=config.model,
        retrieval_mode=config.retrieval_mode
    )
    
    return {"message": "Configuration updated and saved to DB"}
