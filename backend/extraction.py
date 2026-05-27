import os
import json
import base64
import httpx
import fitz
import re
import pandas as pd
from typing import Dict, Any, List, Optional
from pydantic import ValidationError
from schemas import ExtractionResult

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
VISION_MODEL = os.getenv("VISION_MODEL", "llava")

def load_aliases() -> str:
    try:
        from database import SessionLocal, ExtractionAlias
        db = SessionLocal()
        aliases = db.query(ExtractionAlias).all()
        data = {a.campo_sistema: [x.strip() for x in a.aliases.split(',')] for a in aliases}
        db.close()
        return json.dumps(data, ensure_ascii=False)
    except Exception:
        return "{}"

def repair_json(raw_text: str) -> str:
    text = re.sub(r'```(?:json)?\s*', '', raw_text)
    text = re.sub(r'\s*```', '', text).strip()
    if not text.startswith('{'):
        start_idx = text.find('{')
        text = text[start_idx:] if start_idx != -1 else '{' + text
    if not text.endswith('}'):
        end_idx = text.rfind('}')
        text = text[:end_idx+1] if end_idx != -1 else text + '}'
    return text

async def call_ollama(prompt: str, images: list = None) -> Dict[str, Any]:
    payload = {
        "model": VISION_MODEL if images else OLLAMA_MODEL,
        "prompt": prompt,
        "format": "json",
        "stream": False,
        "keep_alive": 0,
        "options": {"temperature": 0, "num_ctx": 8192}
    }
    if images: payload["images"] = images
    try:
        async with httpx.AsyncClient(timeout=150.0) as client:
            response = await client.post(OLLAMA_URL, json=payload)
            response.raise_for_status()
            repaired = repair_json(response.json().get("response", "{}"))
            return json.loads(repaired)
    except Exception: return {}

def is_hallucinated_fill(val: Any) -> bool:
    if not isinstance(val, str): return False
    return bool(re.search(r'(.)\1{9,}', val))

def sanitize_to_float(val: Any) -> Optional[float]:
    if val is None or is_hallucinated_fill(val): return None
    s_val = str(val).lower().replace('kg', '').replace('lbs', '').replace(',', '.').strip()
    clean_val = re.sub(r'[^\d.]', '', s_val)
    try: return float(clean_val)
    except ValueError: return None

async def extract_data(file_path: str) -> Dict[str, Any]:
    ext = os.path.splitext(file_path)[1].lower()
    content, images = "", []
    if ext == ".pdf":
        doc = fitz.open(file_path)
        content = "\n".join([p.get_text() for p in doc])
        content = re.sub(r'[ \t]+', ' ', content)
        if len(content.strip()) < 100:
            for i in range(min(len(doc), 2)):
                pix = doc[i].get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
                images.append(base64.b64encode(pix.tobytes("png")).decode("utf-8"))
            content = "Scanned document logic triggered."
    elif ext in [".xls", ".xlsx"]:
        content = pd.read_excel(file_path).to_string()
    
    alias_json = load_aliases()
    alias_dict = json.loads(alias_json)
    schema_keys = list(alias_dict.keys())
    
    prompt = f"""
    SYSTEM: You are a high-precision customs data extractor for MR4Broker.
    Use these keys: {schema_keys}.
    
    ALIAS TABLE (System Key -> Common Names in Documents):
    {alias_json}
    
    CRITICAL RULES:
    1. GEOGRAPHIC: 'country_of_origin' must be ONLY the country name. If 'Port of Santos, Brazil', use 'Brazil'.
    2. CONTAINER: 'container_number' must be the 11-character ID (e.g. MSCU1234567). Ignore quantities like '1x40'.
    3. ADDRESSES: PRESERVE FULL ADDRESS BLOCKS with line breaks for 'shipper', 'consignee', and 'notify_party'. 
       Do not flatten the address into a single line. Keep the structure found in the document.
    4. NCM: Extract ONLY the numeric code.
    
    Content: {content[:4000]}
    """
    
    raw_data = await call_ollama(prompt, images)
    
    sanitized, log = {}, {}
    for k in schema_keys:
        val = raw_data.get(k)
        if is_hallucinated_fill(val): val = None
        
        if k in ['gross_weight', 'net_weight']:
            sanitized[k] = sanitize_to_float(val)
        else:
            sanitized[k] = val

    sanitized["internal_log"] = log
    return sanitized
