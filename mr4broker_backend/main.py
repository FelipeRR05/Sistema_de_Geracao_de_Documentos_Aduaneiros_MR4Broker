import os
import shutil
import json
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session
from fastapi.middleware.cors import CORSMiddleware

from database import engine, create_db_and_tables
from models import OperationMasters, ParsedDataStaging
from parser import parse_universal_pdf

app = FastAPI(
    title="MR4Broker API",
    description="API para automação de processos aduaneiros."
)

origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
DEBUG_FOLDER = "debug_logs"
ALIAS_FILE = "tabela_alias.json"
ALIAS_DATA = []


def get_session():
    with Session(engine) as session:
        yield session


@app.on_event("startup")
def on_startup():
    global ALIAS_DATA

    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)

    if not os.path.exists(DEBUG_FOLDER):
        os.makedirs(DEBUG_FOLDER)

    create_db_and_tables()

    try:
        with open(ALIAS_FILE, "r", encoding="utf-8") as f:
            ALIAS_DATA = json.load(f)
        print(f"Sucesso: {len(ALIAS_DATA)} termos carregados do {ALIAS_FILE}")
    except Exception as e:
        print(f"ERRO FATAL ao carregar {ALIAS_FILE}: {e}")


@app.get("/")
def root():
    return {"Projeto": "MR4Broker API - Online"}


@app.post("/api/upload/parse", status_code=201)
async def upload_and_parse_file(
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    try:
        new_op = OperationMasters(ref_number=file.filename)
        session.add(new_op)
        session.commit()
        session.refresh(new_op)

        file_location = os.path.join(UPLOAD_FOLDER, f"{new_op.operation_id}_{file.filename}")

        with open(file_location, "wb") as f:
            shutil.copyfileobj(file.file, f)

        parsed_results = parse_universal_pdf(file_location, ALIAS_FILE)

        for item in parsed_results:
            staging = ParsedDataStaging(
                source_file_name=file.filename,
                field_name=item["field_name"],
                parsed_value=item["parsed_value"],
                confidence_score=item["confidence_score"],
                operation_id=new_op.operation_id
            )
            session.add(staging)

        session.commit()

        return {
            "message": "Arquivo processado com sucesso!",
            "operation_id": new_op.operation_id,
            "parsed_data": parsed_results
        }

    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {e}")


# -----------------------------
# ROTA PARA BAIXAR DEBUG
# -----------------------------
@app.get("/debug")
def download_debug():
    debug_path = os.path.join(DEBUG_FOLDER, "debug_output.json")

    if not os.path.exists(debug_path):
        raise HTTPException(
            status_code=404,
            detail="debug_output.json não encontrado. Gere um PDF primeiro."
        )

    return FileResponse(
        debug_path,
        media_type="application/json",
        filename="debug_output.json"
    )
