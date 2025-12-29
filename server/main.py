from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import ingest, graph, config, search, chat, library, extension

from contextlib import asynccontextmanager
from .database.database import create_db_and_tables

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    
    # Load settings from DB on startup
    from sqlmodel import Session, select
    from .database.database import engine
    from .database.models import SystemConfig
    from .core.settings import settings
    
    try:
        with Session(engine) as session:
            configs = session.exec(select(SystemConfig)).all()
            db_config = {c.key: c.value for c in configs}
            
            if "openai_api_key" in db_config:
                settings.openai_api_key = db_config["openai_api_key"]
            if "openai_base_url" in db_config:
                settings.openai_base_url = db_config["openai_base_url"]
            if "openai_model" in db_config:
                settings.openai_model = db_config["openai_model"]
            if "retrieval_mode" in db_config:
                settings.retrieval_mode = db_config["retrieval_mode"]
            
            print(f"Loaded {len(db_config)} settings from database.")
    except Exception as e:
        print(f"Warning: Could not load settings from DB on startup: {e}")
        
    yield

app = FastAPI(title="InfoSky API", version="0.1.0", lifespan=lifespan)

# CORS setup - allow all origins for browser extension support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (required for browser extensions)
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingestion"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(library.router, prefix="/api/library", tags=["library"])
app.include_router(extension.router, prefix="/api/extension", tags=["extension"])

@app.get("/")
def read_root():
    return {"message": "InfoSky Backend is running"}
