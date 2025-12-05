from sqlmodel import Field, SQLModel, Relationship
from typing import Optional, List
import datetime

class OperationMasters(SQLModel, table=True):
    operation_id: Optional[int] = Field(default=None, primary_key=True)
    ref_number: str = Field(index=True)
    creation_date: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    success_count: int = Field(default=0)
    autonomy_level: str = Field(default="Baixa")
    
    staging_data: List["ParsedDataStaging"] = Relationship(back_populates="operation")
    log_errors: List["LogErrors"] = Relationship(back_populates="operation")

class ParsedDataStaging(SQLModel, table=True):
    staging_id: Optional[int] = Field(default=None, primary_key=True)
    source_file_name: Optional[str] = None
    field_name: str 
    parsed_value: Optional[str] = None 
    confidence_score: float = Field(default=0.0)
    
    operation_id: int = Field(foreign_key="operationmasters.operation_id")
    operation: OperationMasters = Relationship(back_populates="staging_data")

class LogErrors(SQLModel, table=True):
    log_id: Optional[int] = Field(default=None, primary_key=True)
    error_description: str
    error_type: Optional[str] = None
    log_date: datetime.datetime = Field(default_factory=datetime.datetime.utcnow)
    is_resolved: bool = Field(default=False)
    
    operation_id: int = Field(foreign_key="operationmasters.operation_id")
    operation: OperationMasters = Relationship(back_populates="log_errors")