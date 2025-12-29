"""
Extension API - Endpoints for browser extension
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, col, or_
from typing import Optional, List
from ..database.database import get_session
from ..database.models import KnowledgeNode, KnowledgeEdge
from ..core.vector_store import vector_store
from ..core.settings import settings

router = APIRouter()

# ============ Request Models ============

class QuickSaveRequest(BaseModel):
    """Request to save a URL quickly"""
    url: str
    title: Optional[str] = None
    html_content: Optional[str] = None

class CreateNodeRequest(BaseModel):
    """Request to create a node from selected text"""
    text: str
    label: Optional[str] = None  # If not provided, use first 30 chars of text
    node_type: str = "概念"
    source_url: Optional[str] = None
    source_title: Optional[str] = None

class FindRelatedRequest(BaseModel):
    """Request to find related knowledge"""
    title: str
    keywords: Optional[List[str]] = None
    content_snippet: Optional[str] = None  # First paragraph or meta description

# ============ Response Models ============

class RelatedNode(BaseModel):
    id: int
    label: str
    type: str
    content_preview: str
    score: float = 0.0

class FindRelatedResponse(BaseModel):
    related_nodes: List[RelatedNode]
    has_related: bool

# ============ Endpoints ============

@router.post("/quick-save")
async def quick_save(request: QuickSaveRequest, session: Session = Depends(get_session)):
    """
    Quick save a URL to the knowledge base.
    Reuses existing ingest logic.
    """
    from ..api.ingest import ingest_info, IngestRequest
    
    # Call existing ingest endpoint
    ingest_request = IngestRequest(
        text=request.url,
        html_content=request.html_content
    )
    result = await ingest_info(ingest_request, session)
    
    return {
        "success": True,
        "message": f"已保存: {request.title or request.url}",
        "result": result
    }

@router.post("/create-node")
async def create_node_from_text(request: CreateNodeRequest, session: Session = Depends(get_session)):
    """
    Create a knowledge node from selected text.
    """
    # Generate label if not provided
    label = request.label
    if not label:
        # Use first 30 chars or first sentence
        label = request.text[:30].strip()
        if len(request.text) > 30:
            label += "..."
    
    # Check if node with same label exists
    existing = session.exec(
        select(KnowledgeNode).where(KnowledgeNode.label == label)
    ).first()
    
    if existing:
        # Append to existing node
        timestamp = __import__('datetime').datetime.utcnow().strftime("%Y-%m-%d")
        existing.content = f"{existing.content}\n\n--- [摘录 {timestamp}] ---\n{request.text}"
        if request.source_url:
            current_source = existing.source or ""
            if request.source_url not in current_source:
                existing.source = f"{current_source}; {request.source_url}" if current_source else request.source_url
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return {
            "success": True,
            "message": f"已追加到现有节点: {label}",
            "node": existing.model_dump(),
            "is_new": False
        }
    
    # Create new node
    source_info = request.source_url or "浏览器插件"
    if request.source_title:
        source_info = f"{request.source_title} ({source_info})"
    
    new_node = KnowledgeNode(
        label=label,
        type=request.node_type,
        content=request.text,
        source=source_info
    )
    session.add(new_node)
    session.commit()
    session.refresh(new_node)
    
    # Add to vector store
    try:
        vector_store.add_node(new_node.id, new_node.label, new_node.content)
    except Exception as e:
        print(f"[Extension] Failed to add to vector store: {e}")
    
    return {
        "success": True,
        "message": f"已创建节点: {label}",
        "node": new_node.model_dump(),
        "is_new": True
    }

@router.post("/find-related")
async def find_related(request: FindRelatedRequest, session: Session = Depends(get_session)):
    """
    Find knowledge nodes related to the current page.
    Uses both keyword matching and vector similarity.
    """
    # Get all nodes
    all_nodes = session.exec(select(KnowledgeNode)).all()
    
    if not all_nodes:
        return FindRelatedResponse(related_nodes=[], has_related=False)
    
    # Build query from title and keywords
    query_parts = [request.title]
    if request.keywords:
        query_parts.extend(request.keywords)
    if request.content_snippet:
        query_parts.append(request.content_snippet[:200])
    
    query = " ".join(query_parts)
    
    related_nodes = []
    
    # Try RAG mode first
    if settings.retrieval_mode == "rag":
        try:
            nodes_for_index = [{"id": n.id, "label": n.label, "content": n.content} for n in all_nodes]
            vector_store.build_index(nodes_for_index)
            
            results = vector_store.search(query, top_k=5)
            if results:
                id_to_node = {n.id: n for n in all_nodes}
                for node_id, score in results:
                    if node_id in id_to_node and score > 0.3:  # Threshold
                        node = id_to_node[node_id]
                        related_nodes.append(RelatedNode(
                            id=node.id,
                            label=node.label,
                            type=node.type,
                            content_preview=node.content[:100] + "..." if len(node.content) > 100 else node.content,
                            score=score
                        ))
        except Exception as e:
            print(f"[Extension/RAG] Vector search failed: {e}")
    
    # Fallback to keyword matching
    if not related_nodes:
        keywords = [k.strip().lower() for k in query.split() if len(k.strip()) > 1]
        
        scored_nodes = []
        for node in all_nodes:
            score = 0
            label_lower = node.label.lower()
            content_lower = node.content.lower() if node.content else ""
            
            for kw in keywords:
                if kw in label_lower:
                    score += 3
                if kw in content_lower:
                    score += 1
            
            if score > 2:  # Threshold
                scored_nodes.append((node, score))
        
        scored_nodes.sort(key=lambda x: x[1], reverse=True)
        
        for node, score in scored_nodes[:5]:
            related_nodes.append(RelatedNode(
                id=node.id,
                label=node.label,
                type=node.type,
                content_preview=node.content[:100] + "..." if len(node.content) > 100 else node.content,
                score=score / 10.0  # Normalize
            ))
    
    return FindRelatedResponse(
        related_nodes=related_nodes,
        has_related=len(related_nodes) > 0
    )

@router.get("/status")
async def extension_status():
    """Check if backend is reachable"""
    return {"status": "ok", "message": "InfoSky 后端运行中"}
