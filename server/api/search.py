from fastapi import APIRouter, Depends
from sqlmodel import Session, select, col
from ..database.database import get_session
from ..database.models import KnowledgeNode
from typing import List

router = APIRouter()

@router.get("/")
async def search_nodes(q: str, limit: int = 10, session: Session = Depends(get_session)):
    if not q:
        return []
    
    # Simple keyword search on label or content
    # Using simple ILIKE equivalent via contains/icontains if supported, or just verify sqlmodel support
    # SQLModel uses SQLAlchemy. 
    statement = select(KnowledgeNode).where(
        (col(KnowledgeNode.label).contains(q)) | 
        (col(KnowledgeNode.content).contains(q))
    ).limit(limit)
    
    results = session.exec(statement).all()
    return results
