from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import ingest, graph, config, search, chat, library, extension

from contextlib import asynccontextmanager
from .database.database import create_db_and_tables

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
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
