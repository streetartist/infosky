from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from ..database.database import get_session
from ..database.models import KnowledgeNode, KnowledgeEdge

router = APIRouter()

@router.get("/")
async def get_graph(session: Session = Depends(get_session)):
    nodes = session.exec(select(KnowledgeNode)).all()
    edges = session.exec(select(KnowledgeEdge)).all()
    
    return {
        "nodes": [node.model_dump() for node in nodes],
        "edges": [{"id": e.id, "source_id": e.source_id, "target_id": e.target_id, "relation_type": e.relation_type} for e in edges]
    }

@router.get("/random")
async def get_random_node(session: Session = Depends(get_session)):
    import random
    nodes = session.exec(select(KnowledgeNode)).all()
    if not nodes:
        return None
    return random.choice(nodes)

# --- Node CRUD ---

class NodeCreate(BaseModel):
    label: str
    type: str = "概念"
    content: str = ""
    source: Optional[str] = None

class NodeUpdate(BaseModel):
    label: str
    content: str
    type: str

@router.post("/nodes")
async def create_node(node_data: NodeCreate, session: Session = Depends(get_session)):
    """Manually create a new node."""
    new_node = KnowledgeNode(
        label=node_data.label,
        type=node_data.type,
        content=node_data.content,
        source=node_data.source or "手动创建"
    )
    session.add(new_node)
    session.commit()
    session.refresh(new_node)
    return new_node

@router.put("/nodes/{node_id}")
async def update_node(node_id: int, node_data: NodeUpdate, session: Session = Depends(get_session)):
    node = session.get(KnowledgeNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    node.label = node_data.label
    node.content = node_data.content
    node.type = node_data.type
    session.add(node)
    session.commit()
    session.refresh(node)
    return node

@router.delete("/nodes/{node_id}")
async def delete_node(node_id: int, session: Session = Depends(get_session)):
    node = session.get(KnowledgeNode, node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    # Manually delete edges involving this node
    statement = select(KnowledgeEdge).where((KnowledgeEdge.source_id == node_id) | (KnowledgeEdge.target_id == node_id))
    edges = session.exec(statement).all()
    for edge in edges:
        session.delete(edge)
        
    session.delete(node)
    session.commit()
    return {"message": "Node deleted"}

# --- Edge CRUD ---

class EdgeCreate(BaseModel):
    source_id: int
    target_id: int
    relation_type: str = "相关"

@router.post("/edges")
async def create_edge(edge_data: EdgeCreate, session: Session = Depends(get_session)):
    """Manually create a new edge between two nodes."""
    # Validate nodes exist
    source = session.get(KnowledgeNode, edge_data.source_id)
    target = session.get(KnowledgeNode, edge_data.target_id)
    if not source or not target:
        raise HTTPException(status_code=404, detail="Source or target node not found")
    
    # Check for duplicate
    existing = session.exec(
        select(KnowledgeEdge).where(
            (KnowledgeEdge.source_id == edge_data.source_id) & 
            (KnowledgeEdge.target_id == edge_data.target_id)
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Edge already exists")
    
    new_edge = KnowledgeEdge(
        source_id=edge_data.source_id,
        target_id=edge_data.target_id,
        relation_type=edge_data.relation_type
    )
    session.add(new_edge)
    session.commit()
    session.refresh(new_edge)
    return {"id": new_edge.id, "source_id": new_edge.source_id, "target_id": new_edge.target_id, "relation_type": new_edge.relation_type}

@router.delete("/edges/{edge_id}")
async def delete_edge(edge_id: int, session: Session = Depends(get_session)):
    """Delete an edge."""
    edge = session.get(KnowledgeEdge, edge_id)
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    
    session.delete(edge)
    session.commit()
    return {"message": "Edge deleted"}

@router.delete("/clear")
async def clear_all_nodes(session: Session = Depends(get_session)):
    """Delete all nodes and edges from the database."""
    # Delete all edges first
    edges = session.exec(select(KnowledgeEdge)).all()
    for edge in edges:
        session.delete(edge)
    
    # Delete all nodes
    nodes = session.exec(select(KnowledgeNode)).all()
    for node in nodes:
        session.delete(node)
    
    session.commit()
    return {"message": f"Cleared {len(nodes)} nodes and {len(edges)} edges"}

