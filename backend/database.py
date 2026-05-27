from sqlalchemy import create_engine, Column, Integer, String, Float, JSON, ForeignKey, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import os
from datetime import datetime

DATABASE_URL = "sqlite:///./mr4_database.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Processo(Base):
    __tablename__ = "processos"

    id = Column(Integer, primary_key=True, index=True)
    numero_processo = Column(String, index=True, nullable=False)
    cliente = Column(String, nullable=False)
    is_template = Column(Boolean, default=False)
    data_criacao = Column(DateTime, default=datetime.utcnow)

    documentos = relationship("ExtractionRecord", back_populates="processo", cascade="all, delete-orphan")

class ExtractionRecord(Base):
    __tablename__ = "extractions"

    id = Column(Integer, primary_key=True, index=True)
    processo_id = Column(Integer, ForeignKey("processos.id"), nullable=True)
    dados_extraidos = Column(JSON, nullable=True)
    internal_log = Column(JSON, nullable=True)
    data_criacao = Column(DateTime, default=datetime.utcnow)

    processo = relationship("Processo", back_populates="documentos")

class DocumentTemplate(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    nome_modelo = Column(String, nullable=False)
    tipo_documento = Column(String, nullable=True)
    caminho_pdf_base = Column(String, nullable=True)
    coordenadas = Column(JSON, nullable=True)

class FieldTemplate(Base):
    __tablename__ = "field_templates"

    id = Column(Integer, primary_key=True, index=True)
    nome_campo = Column(String, index=True) 
    valor_salvo = Column(String)
    data_criacao = Column(DateTime, default=datetime.utcnow)

class ExtractionAlias(Base):
    __tablename__ = "extraction_aliases"

    id = Column(Integer, primary_key=True, index=True)
    campo_sistema = Column(String, unique=True, index=True) 
    label_exibicao = Column(String) 
    aliases = Column(String) 
    descricao = Column(String, nullable=True)

def init_db():
    db_path = "./mr4_database.db"
    if os.path.exists(db_path):
        try:
            from sqlalchemy import inspect
            inspector = inspect(engine)
            
            extractions_cols = [c['name'] for c in inspector.get_columns('extractions')]
            processos_cols = [c['name'] for c in inspector.get_columns('processos')]
            
            tables = inspector.get_table_names()
            
            needs_reset = ('is_template' not in processos_cols or 
                           'extraction_aliases' not in tables or
                           'dados_extraidos' not in extractions_cols)

            if needs_reset:
                print("Schema mismatch or new tables detected. Resetting database...")
                engine.dispose()
                import time
                time.sleep(1)
                try:
                    os.remove(db_path)
                except Exception:
                    os.rename(db_path, f"{db_path}.old_{int(time.time())}")
        except Exception as e:
            print(f"Error checking schema: {e}")
            
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    if db.query(ExtractionAlias).count() == 0:
        initial_aliases = [
            ("invoice_number", "Fatura Referência", "Invoice No, Reference, Factura, Inv#, Invoice Number"),
            ("invoice_date", "Data de Emissão", "Date, Issuance Date, Fecha, Invoice Date"),
            ("shipper", "Exportador / Shipper", "Exporter, Consignor, Shipper Name, Exportador"),
            ("consignee", "Importador / Consignee", "Consignee, Importer, Receiver, Importador"),
            ("notify_party", "Parte a Notificar", "Notify, Notify Party, Notificar"),
            ("incoterm", "Incoterm", "Incoterm, Terms of Delivery, Condição de Venda"),
            ("currency", "Moeda", "Currency, Moeda, Symbol"),
            ("port_of_loading", "Porto de Embarque", "Port of Loading, POL, Porto de Saída"),
            ("port_of_discharge", "Porto de Destino", "Port of Discharge, POD, Porto de Chegada"),
            ("gross_weight", "Peso Bruto (KG)", "Gross Weight, G.W., Peso Bruto, Total Gross Weight"),
            ("net_weight", "Peso Líquido (KG)", "Net Weight, N.W., Peso Liquido, Total Net Weight"),
            ("ncm_hs_code", "NCM / HS Code", "HS Code, NCM, Tariff Code, Classificação Fiscal"),
            ("container_number", "Identificação Container", "Container No, Container Number, Equipamento"),
            ("seal_number", "Número do Lacre", "Seal No, Seal Number, Lacre"),
            ("country_of_origin", "País de Origem", "Country of Origin, Origin, País de Origem"),
            ("payment_terms", "Termos de Pagamento", "Payment Terms, Terms, Prazo de Pagamento")
        ]
        for c, l, a in initial_aliases:
            db.add(ExtractionAlias(campo_sistema=c, label_exibicao=l, aliases=a))
        db.commit()
    db.close()
    print("Database initialized successfully.")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
