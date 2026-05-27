import React, { useState, useEffect } from 'react';
import { Plus, Layout, FileText, Upload, X, Loader2, Sparkles, Database, Trash2, Copy, Search, ArrowLeft, Save, CheckCircle, FilePlus } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

interface Template {
  id: number;
  nome_modelo: string;
  tipo_documento?: string;
  caminho_pdf_base: string;
  coordenadas: any;
}

const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  const [nomeModelo, setNomeModelo] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('Invoice');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useBlankPage, setUseBlankPage] = useState(false);

  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [coords, setCoords] = useState<any>({});
  const [activeFieldForMapping, setActiveFieldForMapping] = useState<string | null>(null);
  const [dynamicFieldLabels, setDynamicFieldLabels] = useState<Record<string, string>>({});

  const fetchTemplates = async () => {
    try {
      setIsFetching(true);
      const [tResp, aResp] = await Promise.all([
        axios.get('http://localhost:8000/api/templates'),
        axios.get('http://localhost:8000/api/aliases')
      ]);
      setTemplates(tResp.data);
      
      const labels: Record<string, string> = {};
      aResp.data.forEach((a: any) => {
        labels[a.campo_sistema] = a.label_exibicao;
      });
      setDynamicFieldLabels(labels);
    } catch (err) {
      toast.error('Erro ao carregar dados do sistema.');
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeModelo) return;
    if (!useBlankPage && !selectedFile) {
      toast.error('Selecione um PDF ou escolha folha em branco.');
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    if (selectedFile) formData.append('file', selectedFile);
    formData.append('nome_modelo', nomeModelo);
    formData.append('tipo_documento', tipoDocumento);

    try {
      await axios.post('http://localhost:8000/api/templates/upload-base', formData);
      toast.success('Modelo criado!');
      setIsModalOpen(false);
      setNomeModelo('');
      setSelectedFile(null);
      setUseBlankPage(false);
      fetchTemplates();
    } catch (err) {
      toast.error('Erro ao enviar modelo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await axios.post(`http://localhost:8000/api/templates/${id}/duplicate`);
      toast.success('Modelo duplicado!');
      fetchTemplates();
    } catch (err) {
      toast.error('Erro ao duplicar.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este modelo permanentemente?')) return;
    try {
      await axios.delete(`http://localhost:8000/api/templates/${id}`);
      toast.success('Modelo excluído.');
      setTemplates(templates.filter(t => t.id !== id));
    } catch (err) {
      toast.error('Erro ao excluir.');
    }
  };

  const handleSaveCoords = async () => {
    if (!editingTemplate) return;
    try {
      await axios.put(`http://localhost:8000/api/templates/${editingTemplate.id}/coordenadas`, coords);
      toast.success('Layout salvo com sucesso!');
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err) {
      toast.error('Erro ao salvar layout.');
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeFieldForMapping) {
       toast.error('Selecione um campo para mapear primeiro!');
       return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x_px = e.clientX - rect.left;
    const y_px = e.clientY - rect.top;
    const scaleX = 595 / rect.width;
    const scaleY = 842 / rect.height;
    const x_pt = x_px * scaleX;
    const y_pt = y_px * scaleY;

    setCoords({
      ...coords,
      [activeFieldForMapping]: { x: x_pt, y: y_pt, font_size: 10 }
    });
    toast.info(`Campo ${fieldLabels[activeFieldForMapping]} mapeado!`);
  };

  const filtered = (templates || []).filter(t => t.nome_modelo.toLowerCase().includes(search.toLowerCase()));

  if (isFetching) {
    return (
      <div className="w-full h-full flex items-center justify-center p-20 min-h-[400px]">
        <div className="text-center">
          <Loader2 className="animate-spin text-accent mx-auto mb-4" size={48} />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Modelos...</p>
        </div>
      </div>
    );
  }

  if (editingTemplate) {
    const safeCoords = coords || {};

    return (
      <div className="w-full h-full p-6 flex flex-col animate-in fade-in">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setEditingTemplate(null)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-black uppercase">Editor de Layout: <span className="text-accent">{editingTemplate.nome_modelo}</span></h1>
          </div>
          <button 
            onClick={handleSaveCoords}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:brightness-110"
          >
            <Save size={18} /> SALVAR LAYOUT
          </button>
        </div>

        <div className="flex-1 flex gap-8 overflow-hidden">
          {/* Sidebar Editor */}
          <div className="w-80 bg-white rounded-3xl border border-slate-200 p-6 overflow-y-auto shadow-sm flex flex-col">
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campos do PDF</h3>
               <button 
                 onClick={() => {
                   const nextField = Object.keys(dynamicFieldLabels).find(k => !safeCoords[k]);
                   if (nextField) setActiveFieldForMapping(nextField);
                   else toast.info('Todos os campos já foram mapeados!');
                 }}
                 className="p-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent hover:text-primary transition-all"
                 title="Mapear Próximo Campo"
               >
                 <Plus size={16} />
               </button>
            </div>
            <div className="space-y-2 flex-1">
              {Object.entries(dynamicFieldLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveFieldForMapping(key)}
                  className={`w-full p-3 text-left rounded-xl border-2 transition-all flex justify-between items-center ${activeFieldForMapping === key ? 'border-accent bg-accent/5' : 'border-slate-50 hover:border-slate-100'}`}
                >
                  <div>
                    <p className={`text-[10px] font-black uppercase ${activeFieldForMapping === key ? 'text-accent' : 'text-slate-700'}`}>{label}</p>
                    {safeCoords[key] && <p className="text-[8px] font-bold text-emerald-500">MAPEADO (x: {Math.round(safeCoords[key].x)}, y: {Math.round(safeCoords[key].y)})</p>}
                  </div>
                  {safeCoords[key] && <CheckCircle size={14} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 bg-slate-200/50 rounded-[2.5rem] p-8 overflow-auto flex justify-center items-start">
             <div 
               className="relative bg-white shadow-2xl cursor-crosshair group border border-slate-300 overflow-hidden"
               style={{ width: '210mm', height: '297mm', minWidth: '210mm', minHeight: '297mm' }}
               onClick={handleMapClick}
             >
                {editingTemplate.caminho_pdf_base ? (
                  <img 
                    src={`http://localhost:8000/api/templates/${editingTemplate.id}/preview?t=${Date.now()}`} 
                    alt="Preview" 
                    className="w-full h-full object-contain pointer-events-none select-none"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = ""; 
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-white flex items-center justify-center border-8 border-double border-slate-100">
                  </div>
                )}
                
                {/* Visual Markers for Mapped Fields */}
                {Object.entries(safeCoords).map(([key, c]: [string, any]) => (
                  <div 
                    key={key}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveFieldForMapping(key);
                    }}
                    className={`absolute border flex items-center justify-center cursor-pointer transition-all ${activeFieldForMapping === key ? 'bg-accent/60 border-primary scale-110 z-10' : 'bg-accent/30 border-accent hover:bg-accent/40'}`}
                    style={{ 
                      left: `${(c.x / 595) * 100}%`, 
                      top: `${(c.y / 842) * 100}%`,
                      width: '120px',
                      height: '24px',
                      transform: 'translate(-5%, -50%)'
                    }}
                  >
                    <span className="text-[8px] font-black text-primary uppercase whitespace-nowrap overflow-hidden px-2">{dynamicFieldLabels[key] || key}</span>
                  </div>
                ))}

                {activeFieldForMapping && (
                  <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute top-0 left-0 text-[10px] font-black bg-accent text-primary px-4 py-2 rounded-br-2xl shadow-lg z-20 uppercase tracking-widest">
                      Mapeando: {dynamicFieldLabels[activeFieldForMapping] || activeFieldForMapping}
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl p-6 py-12 animate-in fade-in duration-700 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 border-b border-slate-100 pb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Modelos de <span className="text-accent">PDF</span></h1>
          <p className="text-slate-500 font-bold tracking-widest text-[10px] uppercase mt-1">Configuração de Templates Documentos</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Buscar modelos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 pr-6 py-4 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest focus:border-accent outline-none transition-all w-64 shadow-sm"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 bg-primary text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg hover:brightness-110 active:scale-95"
          >
            <Plus size={20} />
            NOVO MODELO
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map((template) => (
          <div key={template.id} className="group relative bg-white rounded-3xl p-8 border border-slate-200 shadow-xl hover:shadow-2xl hover:border-accent/30 transition-all">
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleDuplicate(template.id)} className="p-2 bg-slate-50 text-slate-400 hover:text-accent rounded-lg transition-colors border border-slate-100">
                <Copy size={16} />
              </button>
              <button onClick={() => handleDelete(template.id)} className="p-2 bg-slate-50 text-slate-400 hover:text-destructive rounded-lg transition-colors border border-slate-100">
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="mb-6 w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
              <FileText size={28} />
            </div>

            <h3 className="text-xl font-black text-slate-800 uppercase mb-2 truncate pr-16">{template.nome_modelo}</h3>
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
              <span className="flex items-center gap-2"><Database size={12} /> {Object.keys(template.coordenadas || {}).length} Campos</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded text-[8px]">{template.tipo_documento || 'Invoice'}</span>
            </div>

            <button 
              onClick={() => {
                setEditingTemplate(template);
                setCoords(template.coordenadas || {});
                setActiveFieldForMapping(null);
              }}
              className="w-full py-3 bg-slate-50 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest border border-slate-100 hover:bg-primary hover:text-white transition-all"
            >
              Configurar Layout
            </button>
          </div>
        ))}

        {templates.length === 0 && !isFetching && (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <div className="mx-auto w-20 h-20 mb-6 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300">
              <Layout size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-400 uppercase mb-2">Nenhum modelo encontrado</h2>
            <p className="text-slate-400 font-bold tracking-widest text-[10px] uppercase">Comece criando um novo modelo de PDF</p>
          </div>
        )}
      </div>

      {/* Modal Novo Modelo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95">
            <div className="bg-primary p-8 text-center relative overflow-hidden">
               <h2 className="text-2xl font-black text-white uppercase tracking-tight relative z-10">Novo <span className="text-accent">Modelo</span></h2>
            </div>

            <form onSubmit={handleUpload} className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome do Modelo</label>
                <input 
                  type="text"
                  required
                  value={nomeModelo}
                  onChange={(e) => setNomeModelo(e.target.value)}
                  placeholder="Ex: Fatura Comercial MR4"
                  className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-accent outline-none text-sm font-bold transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Tipo de Documento</label>
                <select 
                  value={tipoDocumento}
                  onChange={e => setTipoDocumento(e.target.value)}
                  className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-accent outline-none text-sm font-bold transition-all appearance-none"
                >
                  <option value="Invoice">Invoice (Fatura)</option>
                  <option value="Packing List">Packing List</option>
                  <option value="ISF">ISF Form</option>
                  <option value="Certificado">Certificado de Origem</option>
                </select>
              </div>

              <div className="flex items-center gap-3 px-1 mb-4">
                <input type="checkbox" checked={useBlankPage} onChange={e=>setUseBlankPage(e.target.checked)} className="w-5 h-5 accent-accent" />
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Começar com Folha em Branco (Mapear no Escuro)</label>
              </div>

              {!useBlankPage && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">PDF Base (Vazio)</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-accent/20 rounded-2xl cursor-pointer hover:bg-accent/5 transition-all group bg-accent/5">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      <Upload className="mb-2 text-accent/60 group-hover:text-accent transition-colors" size={24} />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {selectedFile ? selectedFile.name : 'Selecione o PDF Base'}
                      </p>
                    </div>
                    <input type="file" className="hidden" accept=".pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              )}

              {useBlankPage && (
                <div className="p-6 bg-slate-50 rounded-2xl border-2 border-slate-100 text-center">
                   <FilePlus size={32} className="mx-auto text-slate-300 mb-2" />
                   <p className="text-[10px] font-bold text-slate-400 uppercase">O sistema gerará um fundo branco 595x842 para o mapeamento.</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-5 bg-accent text-primary rounded-2xl font-black text-lg transition-all shadow-lg hover:brightness-110 active:scale-95 disabled:bg-slate-200"
              >
                {isLoading ? <Loader2 className="animate-spin mx-auto" size={24} /> : <><Sparkles size={20} className="inline mr-2" /> CRIAR MODELO</>}
              </button>
              <button type="button" onClick={()=>setIsModalOpen(false)} className="w-full text-xs font-black text-slate-400 uppercase hover:text-slate-600 transition-all">Cancelar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
