from pydantic import BaseModel, field_validator
from typing import Optional, Any, Dict
import re

class ExtractionResult(BaseModel):
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    shipper: Optional[str] = None
    consignee: Optional[str] = None
    notify_party: Optional[str] = None
    incoterm: Optional[str] = None
    currency: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    ncm_hs_code: Optional[str] = None
    gross_weight: Optional[Any] = None
    net_weight: Optional[Any] = None
    container_number: Optional[str] = None
    seal_number: Optional[str] = None
    country_of_origin: Optional[str] = None
    payment_terms: Optional[str] = None
    internal_log: Optional[Dict[str, Any]] = {}

    @field_validator('ncm_hs_code', mode='before')
    @classmethod
    def sanitize_ncm(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        return re.sub(r'\D', '', str(v))

    @field_validator('gross_weight', 'net_weight', mode='before')
    @classmethod
    def sanitize_weight(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        clean_v = re.sub(r'[^\d.]', '', str(v).replace(',', '.'))
        try:
            return float(clean_v)
        except ValueError:
            return None
