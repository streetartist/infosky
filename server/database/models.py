from typing import Optional, List
from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime

class KnowledgeNodeBase(SQLModel):
    label: str = Field(index=True)
    content: str
    type: str = Field(default="concept")
    summary: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    embedding: Optional[str] = None  # Store as JSON string first, or use pgvector if we switched, but sticking to simple setup for now.

class KnowledgeNode(KnowledgeNodeBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source: Optional[str] = Field(default=None) # URL or "User Input"
    last_reviewed_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    outgoing_edges: List["KnowledgeEdge"] = Relationship(back_populates="source_node", sa_relationship_kwargs={"primaryjoin": "KnowledgeNode.id==KnowledgeEdge.source_id"})
    incoming_edges: List["KnowledgeEdge"] = Relationship(back_populates="target_node", sa_relationship_kwargs={"primaryjoin": "KnowledgeNode.id==KnowledgeEdge.target_id"})

class KnowledgeEdgeBase(SQLModel):
    source_id: int = Field(foreign_key="knowledgenode.id")
    target_id: int = Field(foreign_key="knowledgenode.id")
    relation_type: str
    weight: float = Field(default=1.0)

class KnowledgeEdge(KnowledgeEdgeBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    
    source_node: KnowledgeNode = Relationship(back_populates="outgoing_edges", sa_relationship_kwargs={"foreign_keys": "KnowledgeEdge.source_id"})
    target_node: KnowledgeNode = Relationship(back_populates="incoming_edges", sa_relationship_kwargs={"foreign_keys": "KnowledgeEdge.target_id"})

class RawInput(SQLModel, table=True):
    """Stores original user inputs for the Knowledge Base."""
    id: Optional[int] = Field(default=None, primary_key=True)
    input_type: str = Field(default="text")  # "text" or "url"
    original_input: str  # The raw text or URL
    fetched_content: Optional[str] = None  # For URLs, the crawled content
    title: Optional[str] = None  # For URLs, the page title
    created_at: datetime = Field(default_factory=datetime.utcnow)

class SystemConfig(SQLModel, table=True):
    """Stores system configuration (key-value pairs)"""
    key: str = Field(primary_key=True)
    value: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)
