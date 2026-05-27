import os
import aiofiles
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse, Response
from extraction import extract_data
from schemas import ExtractionResult
from database import get_db, ExtractionRecord, init_db, DocumentTemplate, Processo, FieldTemplate, ExtractionAlias
from pdf_gen import generate_aduaneiro_pdf, fill_pdf_template
from pydantic import BaseModel
import fitz 

app = FastAPI(title="MR4Broker API")

class ProcessoCreate(BaseModel):
    numero_processo: str
    cliente: str
    is_template: Optional[bool] = False

class AliasCreate(BaseModel):
    campo_sistema: str
    label_exibicao: str
    aliases: str
    descricao: Optional[str] = None

class ExtractionUpdate(BaseModel):
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
    gross_weight: Optional[float] = None
    net_weight: Optional[float] = None
    container_number: Optional[str] = None
    seal_number: Optional[str] = None
    country_of_origin: Optional[str] = None
    payment_terms: Optional[str] = None

class FieldTemplateCreate(BaseModel):
    nome_campo: str
    valor_salvo: str

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
PDF_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pdfs")
TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates_base")

for d in [UPLOAD_DIR, PDF_DIR, TEMPLATES_DIR]:
    if not os.path.exists(d):
        os.makedirs(d)

@app.post("/upload", response_model=List[ExtractionResult])
async def upload_files(files: List[UploadFile] = File(...)):
    results = []
    for file in files:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        try:
            extraction = await extract_data(file_path)
            results.append(extraction)
        except Exception as e:
            results.append(ExtractionResult())
    return results

@app.post("/api/save")
async def save_results(data: List[Dict[str, Any]], processo_id: Optional[int] = None, db: Session = Depends(get_db)):
    try:
        if not processo_id and data:
            item = data[0]
            shipper_clean = (item.get("shipper") or "SEM_SHIPPER").split("\n")[0].strip()[:30]
            invoice_clean = (item.get("invoice_number") or "SEM_FATURA").strip()
            num_proc = f"{shipper_clean} - {invoice_clean}"
            
            db_p = db.query(Processo).filter(Processo.numero_processo == num_proc).first()
            if not db_p:
                db_p = Processo(numero_processo=num_proc, cliente="AUTO-GERADO")
                db.add(db_p)
                db.flush()
            processo_id = db_p.id

        last_id = None
        for item in data:
            internal_log = item.pop("internal_log", {})
            db_record = ExtractionRecord(dados_extraidos=item, internal_log=internal_log)
            db_record.processo_id = processo_id
            db.add(db_record)
            db.flush()
            last_id = db_record.id
        db.commit()
        return {"status": "success", "message": f"{len(data)} records saved.", "last_id": last_id, "processo_id": processo_id}
    except Exception as e:
        db.rollback()
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in /api/save: {error_details}")
        raise HTTPException(status_code=500, detail={"message": str(e), "traceback": error_details})

@app.get("/api/download-pdf/{record_id}")
async def download_pdf(record_id: int, template_id: Optional[int] = None, db: Session = Depends(get_db)):
    try:
        record = db.query(ExtractionRecord).filter(ExtractionRecord.id == record_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Registro não encontrado")
        
        data = record.dados_extraidos or {}
        
        pdf_filename = f"aduaneiro_{record_id}.pdf"
        pdf_path = os.path.join(PDF_DIR, pdf_filename)

        if template_id:
            template = db.query(DocumentTemplate).filter(DocumentTemplate.id == template_id).first()
            if template:
                fill_pdf_template(data, template.caminho_pdf_base, template.coordenadas, pdf_path)
                return FileResponse(pdf_path, media_type='application/pdf', filename=pdf_filename)

        generate_aduaneiro_pdf(data, pdf_path)
        return FileResponse(pdf_path, media_type='application/pdf', filename=pdf_filename)
    except Exception as e:
        import traceback
        print(f"Error generating PDF: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/processos")
async def list_processos(db: Session = Depends(get_db)):
    processos = db.query(Processo).all()
    return [
        {
            "id": p.id,
            "numero_processo": p.numero_processo,
            "cliente": p.cliente,
            "is_template": p.is_template,
            "data_criacao": p.data_criacao,
            "documentos": [{"id": d.id} for d in p.documentos]
        } for p in processos
    ]

@app.post("/api/processos")
async def create_processo(p: ProcessoCreate, db: Session = Depends(get_db)):
    try:
        db_p = Processo(**p.model_dump())
        db.add(db_p)
        db.flush()
        
        empty_doc = ExtractionRecord(processo_id=db_p.id, dados_extraidos={})
        db.add(empty_doc)
        db.commit()
        db.refresh(db_p)
        return db_p
    except Exception as e:
        db.rollback()
        print(f"Error creating process: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/processos/{id}")
async def delete_processo(id: int, db: Session = Depends(get_db)):
    try:
        db_p = db.query(Processo).filter(Processo.id == id).first()
        if not db_p: raise HTTPException(status_code=404)
        db.delete(db_p)
        db.commit()
        return {"status": "deleted"}
    except Exception as e:
        db.rollback()
        print(f"Error in delete_processo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/processos/{id}")
async def update_processo(id: int, p: ProcessoCreate, db: Session = Depends(get_db)):
    try:
        print(f"DEBUG: Updating process {id} with data: {p.model_dump()}")
        db_p = db.query(Processo).filter(Processo.id == id).first()
        if not db_p: raise HTTPException(status_code=404)
        db_p.numero_processo = p.numero_processo
        db_p.cliente = p.cliente
        db_p.is_template = p.is_template
        db.commit()
        db.refresh(db_p)
        print(f"DEBUG: Process {id} updated successfully.")
        return db_p
    except Exception as e:
        db.rollback()
        print(f"ERROR in update_processo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/processos/{id}/duplicate")
async def duplicate_processo(id: int, db: Session = Depends(get_db)):
    from sqlalchemy.exc import IntegrityError
    import time
    
    db_p = db.query(Processo).filter(Processo.id == id).first()
    if not db_p: raise HTTPException(status_code=404)
    
    base_name = db_p.numero_processo
    new_name = f"{base_name} - CÓPIA"
    
    counter = 1
    while db.query(Processo).filter(Processo.numero_processo == new_name).first():
        new_name = f"{base_name} - CÓPIA ({counter})"
        counter += 1

    try:
        new_p = Processo(
            numero_processo=new_name,
            cliente=db_p.cliente,
            is_template=db_p.is_template
        )
        db.add(new_p)
        db.flush()

        for doc in db_p.documentos:
            new_doc = ExtractionRecord(
                processo_id=new_p.id,
                dados_extraidos=doc.dados_extraidos or {},
                internal_log=doc.internal_log or {}
            )
            db.add(new_doc)
        
        db.commit()
        db.refresh(new_p)
        return new_p
    except IntegrityError:
        db.rollback()
        ts_name = f"{base_name} - CÓPIA {int(time.time())}"
        new_p = Processo(numero_processo=ts_name, cliente=db_p.cliente)
        db.add(new_p)
        db.commit()
        db.refresh(new_p)
        return new_p
    except Exception as e:
        db.rollback()
        print(f"Error duplicating process: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Alias Endpoints ---

@app.get("/api/aliases")
async def list_aliases(db: Session = Depends(get_db)):
    return db.query(ExtractionAlias).all()

@app.post("/api/aliases")
async def create_alias(data: AliasCreate, db: Session = Depends(get_db)):
    db_alias = ExtractionAlias(**data.model_dump())
    db.add(db_alias)
    db.commit()
    db.refresh(db_alias)
    return db_alias

@app.put("/api/aliases/{id}")
async def update_alias(id: int, data: AliasCreate, db: Session = Depends(get_db)):
    db_alias = db.query(ExtractionAlias).filter(ExtractionAlias.id == id).first()
    if not db_alias: raise HTTPException(status_code=404)
    for k, v in data.model_dump().items():
        setattr(db_alias, k, v)
    db.commit()
    return db_alias

@app.delete("/api/aliases/{id}")
async def delete_alias(id: int, db: Session = Depends(get_db)):
    db_alias = db.query(ExtractionAlias).filter(ExtractionAlias.id == id).first()
    if not db_alias: raise HTTPException(status_code=404)
    db.delete(db_alias)
    db.commit()
    return {"status": "deleted"}

@app.post("/api/processos/{id}/save-as-template")
async def save_as_template(id: int, db: Session = Depends(get_db)):
    db_p = db.query(Processo).filter(Processo.id == id).first()
    if not db_p: raise HTTPException(status_code=404)
    db_p.is_template = True
    db.commit()
    return {"status": "success"}

# --- Field Template Endpoints ---

@app.get("/api/field-templates/{nome_campo}")
async def list_field_templates(nome_campo: str, db: Session = Depends(get_db)):
    try:
        return db.query(FieldTemplate).filter(FieldTemplate.nome_campo == nome_campo).all()
    except Exception as e:
        print(f"Error in list_field_templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/field-templates")
async def create_field_template(data: FieldTemplateCreate, db: Session = Depends(get_db)):
    try:
        existing = db.query(FieldTemplate).filter(FieldTemplate.nome_campo == data.nome_campo, FieldTemplate.valor_salvo == data.valor_salvo).first()
        if existing: return existing
        
        db_ft = FieldTemplate(**data.model_dump())
        db.add(db_ft)
        db.commit()
        db.refresh(db_ft)
        return db_ft
    except Exception as e:
        db.rollback()
        print(f"Error in create_field_template: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/field-templates/{id}")
async def delete_field_template(id: int, db: Session = Depends(get_db)):
    try:
        db_ft = db.query(FieldTemplate).filter(FieldTemplate.id == id).first()
        if not db_ft: raise HTTPException(status_code=404)
        db.delete(db_ft)
        db.commit()
        return {"status": "deleted"}
    except Exception as e:
        db.rollback()
        print(f"Error in delete_field_template: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/templates/{id}/coordenadas")
async def update_template_coords(id: int, coords: Dict[str, Any], db: Session = Depends(get_db)):
    db_t = db.query(DocumentTemplate).filter(DocumentTemplate.id == id).first()
    if not db_t: raise HTTPException(status_code=404)
    db_t.coordenadas = coords
    db.commit()
    return db_t

@app.get("/api/templates/{id}/preview")
async def get_template_preview(id: int, db: Session = Depends(get_db)):
    db_t = db.query(DocumentTemplate).filter(DocumentTemplate.id == id).first()
    if not db_t: raise HTTPException(status_code=404)
    
    if not db_t.caminho_pdf_base or not os.path.exists(db_t.caminho_pdf_base):
        import numpy as np
        import cv2
        blank = np.ones((842, 595, 3), dtype=np.uint8) * 255
        _, img_encoded = cv2.imencode('.png', blank)
        return Response(content=img_encoded.tobytes(), media_type="image/png")
    
    doc = fitz.open(db_t.caminho_pdf_base)
    page = doc.load_page(0)
    pix = page.get_pixmap()
    img_data = pix.tobytes("png")
    doc.close()
    
    return Response(content=img_data, media_type="image/png")

@app.get("/api/documentos/{id}")
async def get_documento(id: int, db: Session = Depends(get_db)):
    return db.query(ExtractionRecord).filter(ExtractionRecord.id == id).first()

@app.put("/api/documentos/{id}")
async def update_documento(id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    try:
        print(f"DEBUG: Updating document {id} with data: {data}")
        db_doc = db.query(ExtractionRecord).filter(ExtractionRecord.id == id).first()
        if not db_doc: raise HTTPException(status_code=404)
        
        if "dados_extraidos" in data:
            db_doc.dados_extraidos = data["dados_extraidos"]
        else:
            db_doc.dados_extraidos = data
            
        db.commit()
        db.refresh(db_doc)
        print(f"DEBUG: Document {id} updated successfully.")
        return db_doc
    except Exception as e:
        db.rollback()
        import traceback
        print(f"ERROR in update_documento: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/documentos/{id}")
async def delete_documento(id: int, db: Session = Depends(get_db)):
    db_doc = db.query(ExtractionRecord).filter(ExtractionRecord.id == id).first()
    if not db_doc: raise HTTPException(status_code=404)
    db.delete(db_doc)
    db.commit()
    return {"status": "deleted"}

@app.get("/api/templates")
async def list_templates(db: Session = Depends(get_db)):
    templates = db.query(DocumentTemplate).all()
    return templates

@app.post("/api/templates/upload-base")
async def upload_template_base(
    nome_modelo: str = Form(...),
    tipo_documento: str = Form(...),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    file_path = None
    if file:
        file_path = os.path.join(TEMPLATES_DIR, f"{nome_modelo}_{file.filename}")
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
    
    new_template = DocumentTemplate(
        nome_modelo=nome_modelo,
        tipo_documento=tipo_documento,
        caminho_pdf_base=file_path,
        coordenadas={} 
    )
    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    return new_template

@app.delete("/api/templates/{id}")
async def delete_template(id: int, db: Session = Depends(get_db)):
    db_t = db.query(DocumentTemplate).filter(DocumentTemplate.id == id).first()
    if not db_t: raise HTTPException(status_code=404)
    db.delete(db_t)
    db.commit()
    return {"status": "deleted"}

@app.post("/api/templates/{id}/duplicate")
async def duplicate_template(id: int, db: Session = Depends(get_db)):
    db_t = db.query(DocumentTemplate).filter(DocumentTemplate.id == id).first()
    if not db_t: raise HTTPException(status_code=404)
    
    base_name = db_t.nome_modelo
    new_name = f"{base_name} - CÓPIA"
    
    counter = 1
    while db.query(DocumentTemplate).filter(DocumentTemplate.nome_modelo == new_name).first():
        new_name = f"{base_name} - CÓPIA ({counter})"
        counter += 1

    new_t = DocumentTemplate(
        nome_modelo=new_name,
        tipo_documento=db_t.tipo_documento,
        caminho_pdf_base=db_t.caminho_pdf_base,
        coordenadas=db_t.coordenadas
    )
    db.add(new_t)
    db.commit()
    return new_t

@app.get("/api/generate-excel")
async def generate_excel():
    return {"status": "ok", "message": "Excel Generation Endpoint Stub"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
