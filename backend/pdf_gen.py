from fpdf import FPDF
from datetime import datetime
import os
import fitz

class MR4PDF(FPDF):
    def header(self):
        self.set_fill_color(0, 43, 73) # #002B49
        self.rect(0, 0, 210, 30, 'F')
        
        self.set_fill_color(225, 177, 44) # #E1B12C
        self.rect(0, 30, 210, 2, 'F')
        
        self.set_font('helvetica', 'B', 20)
        self.set_text_color(255, 255, 255)
        self.cell(0, 10, 'MR4 BROKER - DOCUMENTO ADUANEIRO', align='C', ln=True)
        self.set_font('helvetica', 'I', 10)
        self.cell(0, 10, f'Gerado em: {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}', align='C', ln=True)
        self.ln(15)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Pagina {self.page_no()}/{{nb}}', align='C')

def fill_pdf_template(data: dict, base_pdf_path: str, coordinates: dict, output_path: str):
    """
    Fills an existing PDF template using coordinates (x, y, font_size).
    Coordinates from frontend are scaled to PDF points.
    """
    doc = None
    try:
        if not base_pdf_path or base_pdf_path == "blank" or not os.path.exists(base_pdf_path):
            doc = fitz.open()
            page = doc.new_page(width=595, height=842) 
        else:
            doc = fitz.open(base_pdf_path)
            page = doc[0]
        
        for field, coords in coordinates.items():
            val = data.get(field)
            if val is None or val == "":
                continue
            
            x = coords.get('x', 0)
            y = coords.get('y', 0)
            font_size = coords.get('font_size', 10)
            
            page.insert_text((x, y), str(val), fontsize=font_size, color=(0, 0, 0))

        doc.save(output_path)
    finally:
        if doc:
            doc.close()

def generate_aduaneiro_pdf(data: dict, output_path: str):
    pdf = MR4PDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # Body
    pdf.set_text_color(0, 0, 0)
    pdf.set_font('helvetica', 'B', 14)
    pdf.cell(0, 10, 'DETALHES DA EXTRAÇÃO', ln=True)
    pdf.ln(5)
    
    field_labels = {
        "invoice_number": "Fatura Referência",
        "invoice_date": "Data de Emissão",
        "shipper": "Exportador (Shipper)",
        "consignee": "Importador (Consignee)",
        "notify_party": "Parte a Notificar",
        "incoterm": "Incoterm",
        "currency": "Moeda",
        "port_of_loading": "Porto de Embarque",
        "port_of_discharge": "Porto de Destino",
        "ncm_hs_code": "NCM / Classificação Fiscal",
        "gross_weight": "Peso Bruto (KG)",
        "net_weight": "Peso Líquido (KG)",
        "container_number": "Identificação Container",
        "seal_number": "Número do Lacre",
        "country_of_origin": "País de Origem",
        "payment_terms": "Termos de Pagamento"
    }

    pdf.set_font('helvetica', '', 11)
    for key, label in field_labels.items():
        val = data.get(key)
        if val is None or val == "":
            val = "Não Informado"
        
        pdf.set_font('helvetica', 'B', 10)
        pdf.cell(50, 8, f"{label}:", border='B')
        pdf.set_font('helvetica', '', 10)
        
        if key in ['shipper', 'consignee', 'notify_party'] and val:
            pdf.ln(8)
            pdf.multi_cell(0, 6, str(val))
        else:
            pdf.cell(0, 8, f" {val}", ln=True, border='B')
        
        pdf.ln(2)

    pdf.output(output_path)
    return output_path
