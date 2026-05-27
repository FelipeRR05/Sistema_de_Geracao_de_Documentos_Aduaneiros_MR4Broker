import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircle, Save, ArrowLeft, Loader2, Database, AlertTriangle, Sparkles, Search, X, Plus, Copy, Download } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

interface ReviewPageProps {
  initialData?: any[] | null;
  onReset: () => void;
  existingId?: number | null;
}

const ReviewPage: React.FC<ReviewPageProps> = ({ initialData, onReset, existingId }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSystem, setIsLoadingSystem] = useState(true);
  const [savedId, setSavedId] = useState<number | null>(existingId || null);
  const [processos, setProcessos] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [fieldTemplates, setFieldTemplates] = useState<any[]>([]);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingSystem(true);
        const [tResp, pResp, aResp] = await Promise.all([
          axios.get('http://localhost:8000/api/templates'),
          axios.get('http://localhost:8000/api/processos'),
          axios.get('http://localhost:8000/api/aliases')
        ]);
        setTemplates(tResp.data);
        setProcessos(pResp.data);
        
        const labels: Record<string, string> = {};
        aResp.data.forEach((a: any) => {
          labels[a.campo_sistema] = a.label_exibicao;
        });
        setFieldLabels(labels);
      } catch (err) {
        toast.error('Erro ao sincronizar com o servidor.');
      } finally {
        setIsLoadingSystem(false);
      }
    };
    fetchData();
  }, []);

  const consolidated = useMemo(() => {
    try {
      if (!initialData || initialData.length === 0) return { data: {}, conflicts: {} };
      const base: any = {};
      const conflicts: any = {};

      initialData.forEach((item) => {
        const raw = item.dados_extraidos || item;
        Object.keys(raw).forEach((key) => {
          if (['internal_log', 'id', 'processo_id', 'data_criacao'].includes(key)) return;
          const val = raw[key];
          if (val !== null && val !== undefined && val !== '') {
            if (base[key] !== undefined && base[key] !== val) conflicts[key] = true;
            if (base[key] === undefined) base[key] = val;
          }
        });
      });
      return { data: base, conflicts };
    } catch (e) {
      setHasError(true);
      return { data: {}, conflicts: {} };
    }
  }, [initialData]);

  const [editable, setEditable] = useState<any>({});

  useEffect(() => {
    if (consolidated.data && Object.keys(consolidated.data).length > 0) {
      setEditable(prev => ({ ...prev, ...consolidated.data }));
    }
  }, [consolidated.data]);

  const openFieldTemplates = async (field: string) => {
    setActiveField(field);
    try {
      const resp = await axios.get(`http://localhost:8000/api/field-templates/${field}`);
      setFieldTemplates(resp.data);
      setIsFieldModalOpen(true);
    } catch (err) {
      toast.error('Erro ao carregar favoritos.');
    }
  };

  const saveFieldAsFavorite = async (field: string, value: string) => {
    if (!value) {
      toast.error('O campo está vazio!');
      return;
    }
    try {
      await axios.post('http://localhost:8000/api/field-templates', {
        nome_campo: field,
        valor_salvo: value
      });
      toast.success('Campo salvo nos favoritos!');
    } catch (err) {
      toast.error('Erro ao salvar favorito.');
    }
  };

  const applyProcessTemplate = async (processoId: number) => {
    try {
      const proc = processos.find((p: any) => p.id === processoId);
      if (proc && proc.documentos && proc.documentos.length > 0) {
         const docResp = await axios.get(`http://localhost:8000/api/documentos/${proc.documentos[0].id}`);
         setEditable(prev => ({ ...prev, ...(docResp.data.dados_extraidos || {}) }));
         toast.success('Template aplicado!');
         setIsProcessModalOpen(false);
      } else {
         toast.error('Template inválido.');
      }
    } catch (err) {
      toast.error('Erro ao aplicar template.');
    }
  };

  const markAsTemplate = async () => {
     if (!savedId) {
       toast.error('Salve o documento antes de marcar como template!');
       return;
     }
     try {
       const docResp = await axios.get(`http://localhost:8000/api/documentos/${savedId}`);
       if (docResp.data.processo_id) {
         await axios.post(`http://localhost:8000/api/processos/${docResp.data.processo_id}/save-as-template`);
         toast.success('Processo marcado como Template!');
         const pResp = await axios.get('http://localhost:8000/api/processos');
         setProcessos(pResp.data);
       }
     } catch (err) {
       toast.error('Erro ao salvar template.');
     }
  };

  const handleFinalSave = async () => {
    if (Object.keys(editable).length === 0) {
      toast.error('Nenhum dado para salvar.');
      return;
    }
    setIsSaving(true);
    try {
      if (savedId) {
        await axios.put(`http://localhost:8000/api/documentos/${savedId}`, { dados_extraidos: editable });
        toast.success('Alterações salvas!');
      } else {
        const resp = await axios.post('http://localhost:8000/api/save', [editable]);
        setSavedId(resp.data.last_id);
        toast.success('Documento salvo com sucesso!');
      }
    } catch (err) {
      toast.error('Erro ao salvar dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = (templateId: number | null) => {
    if (savedId) {
      const url = `http://localhost:8000/api/download-pdf/${savedId}${templateId ? `?template_id=${templateId}` : ''}`;
      window.open(url, '_blank');
      setIsTemplateModalOpen(false);
    }
  };

  if (hasError) {
    return (
      <div className="w-full max-w-4xl p-20 text-center bg-white rounded-3xl shadow-2xl border border-red-50">
        <AlertTriangle size={80} className="mx-auto text-red-500 mb-6" />
        <h2 className="text-3xl font-black uppercase text-slate-800">Falha Crítica</h2>
        <p className="text-slate-500 mt-2 mb-10">Ocorreu um erro ao processar os dados da extração.</p>
        <button onClick={onReset} className="bg-primary text-white px-12 py-4 rounded-2xl font-black uppercase tracking-widest hover:brightness-110 transition-all">Voltar ao Início</button>
      </div>
    );
  }

  const multiLineFields = ['shipper', 'consignee', 'notify_party'];

  return (
    <div className="w-full max-w-5xl p-6 animate-in fade-in duration-500">
      {/* Header com Ações Principais */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md pb-8 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 border-b border-slate-100">
        <div className="flex items-center gap-6">
          <button onClick={onReset} className="p-4 bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all rounded-2xl border border-slate-200 shadow-sm">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase leading-none">Console de <span className="text-accent">Revisão</span></h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsProcessModalOpen(true)}
            className="flex items-center gap-2 bg-slate-50 text-slate-600 px-5 py-3 rounded-xl text-[10px] font-black hover:bg-slate-100 transition-all uppercase tracking-widest border border-slate-200"
            title="Aplicar dados de um processo template"
          >
            <Copy size={16} className="text-accent" /> Aplicar Template
          </button>
          <button 
            onClick={markAsTemplate}
            className="flex items-center gap-2 bg-slate-50 text-slate-600 px-5 py-3 rounded-xl text-[10px] font-black hover:bg-slate-100 transition-all uppercase tracking-widest border border-slate-200"
            title="Marcar este processo como modelo para outros"
          >
            <Sparkles size={16} className="text-accent" /> Salvar Template
          </button>
          <div className="w-px h-10 bg-slate-200 mx-1" />
          <button 
            onClick={() => setIsTemplateModalOpen(true)} 
            disabled={!savedId} 
            className="flex items-center gap-3 bg-accent text-primary px-8 py-4 rounded-2xl font-black transition-all shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            <Download size={20} /> PDF
          </button>
          <button 
            onClick={handleFinalSave} 
            disabled={isSaving} 
            className="flex items-center gap-3 bg-primary text-white px-8 py-4 rounded-2xl font-black transition-all shadow-lg hover:brightness-110 active:scale-95 disabled:bg-slate-400"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {savedId ? "ATUALIZAR" : "FINALIZAR"}
          </button>
        </div>
      </div>

      {/* Grid de Inputs Dinâmicos */}
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden mb-20">
        <div className="bg-slate-50 px-10 py-6 flex justify-between items-center border-b border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
              <Database size={20} />
            </div>
            <div>
               <h2 className="font-black text-slate-800 uppercase text-sm tracking-tight">Mapeador de Dados</h2>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sincronização em tempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full text-[10px] font-black tracking-widest border border-emerald-100 uppercase">
            <CheckCircle size={14} /> Dados Verificados
          </div>
        </div>

        <div className="p-10 grid gap-8">
          {isLoadingSystem ? (
            <div className="py-24 text-center">
               <Loader2 className="animate-spin mx-auto text-accent mb-6" size={48} />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando campos dinâmicos...</p>
            </div>
          ) : (
            Object.keys(fieldLabels).map((field) => {
              const isConflict = consolidated.conflicts[field];
              const isMultiLine = multiLineFields.includes(field);
              const val = editable[field] || '';

              return (
                <div key={field} className="relative group/field">
                  <div className="flex justify-between items-center mb-2 px-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      {fieldLabels[field] || field}
                      {isConflict && <AlertTriangle size={14} className="text-amber-500 animate-pulse" />}
                    </label>
                    {isConflict && <span className="text-[8px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md uppercase border border-amber-100">Conflito de Extração</span>}
                  </div>
                  
                  <div className="flex items-stretch gap-3">
                     <div className="relative flex-1">
                        {isMultiLine ? (
                          <textarea
                            value={val}
                            onChange={(e) => setEditable({...editable, [field]: e.target.value})}
                            rows={3}
                            className="w-full bg-slate-50/50 px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-accent focus:bg-white text-sm font-bold tracking-wide transition-all outline-none resize-none"
                            placeholder="..."
                          />
                        ) : (
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => setEditable({...editable, [field]: e.target.value})}
                            className="w-full bg-slate-50/50 px-6 py-4 rounded-2xl border-2 border-slate-100 focus:border-accent focus:bg-white text-sm font-bold tracking-wide transition-all outline-none"
                            placeholder="-"
                          />
                        )}
                     </div>
                     <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => openFieldTemplates(field)}
                          className="flex-1 px-4 bg-white text-slate-400 hover:text-accent border-2 border-slate-100 hover:border-accent/20 rounded-xl transition-all flex items-center justify-center group/btn shadow-sm"
                          title="Carregar Favorito"
                        >
                          <Search size={18} className="group-hover/btn:scale-110 transition-transform" />
                        </button>
                        <button 
                          onClick={() => saveFieldAsFavorite(field, val)}
                          className="flex-1 px-4 bg-white text-slate-400 hover:text-emerald-500 border-2 border-slate-100 hover:border-emerald-100 rounded-xl transition-all flex items-center justify-center group/btn shadow-sm"
                          title="Salvar como Favorito"
                        >
                          <Plus size={18} className="group-hover/btn:scale-110 transition-transform" />
                        </button>
                     </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL: FAVORITOS DO CAMPO */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-primary p-8 flex justify-between items-center text-white">
              <div>
                <h3 className="font-black uppercase tracking-tight text-sm">Favoritos</h3>
                <p className="text-[10px] font-bold text-white/50 uppercase">{fieldLabels[activeField!]}</p>
              </div>
              <button onClick={() => setIsFieldModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X size={24}/></button>
            </div>
            <div className="p-8 space-y-3 max-h-96 overflow-y-auto bg-slate-50/30">
              {fieldTemplates.map(ft => (
                <button 
                  key={ft.id}
                  onClick={() => {
                    setEditable({...editable, [activeField!]: ft.valor_salvo});
                    setIsFieldModalOpen(false);
                  }}
                  className="w-full p-5 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs font-bold text-slate-600 transition-all flex justify-between items-center group shadow-sm hover:shadow-md"
                >
                  <span className="line-clamp-2 pr-4">{ft.valor_salvo}</span>
                  <Plus size={18} className="text-slate-300 group-hover:text-accent flex-shrink-0" />
                </button>
              ))}
              {fieldTemplates.length === 0 && (
                <div className="py-12 text-center">
                  <Sparkles size={40} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Nenhum favorito salvo</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APLICAR TEMPLATE DE PROCESSO */}
      {isProcessModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-primary p-10 text-center text-white relative">
              <h2 className="text-2xl font-black uppercase tracking-tight">Carregar <span className="text-accent">Template</span></h2>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-2">Escolha um modelo de processo para herdar dados</p>
              <button onClick={() => setIsProcessModalOpen(false)} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"><X size={24}/></button>
            </div>
            <div className="p-8 space-y-4 max-h-[30rem] overflow-y-auto">
              {processos.filter(p => p.is_template).map(p => (
                <button 
                  key={p.id}
                  onClick={() => applyProcessTemplate(p.id)}
                  className="w-full p-6 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-3xl text-left transition-all flex justify-between items-center group shadow-sm"
                >
                  <div>
                    <p className="text-sm font-black text-slate-700">{p.numero_processo}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.cliente}</p>
                  </div>
                  <Copy size={24} className="text-slate-200 group-hover:text-accent transition-colors" />
                </button>
              ))}
              {processos.filter(p => p.is_template).length === 0 && (
                <div className="py-20 text-center">
                   <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Nenhum processo marcado como template.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SELEÇÃO DE LAYOUT PDF */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-primary p-8 text-center text-white">
              <h3 className="font-black uppercase tracking-tight">Gerar <span className="text-accent">Documento</span></h3>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Selecione o layout de saída</p>
            </div>
            <div className="p-8 space-y-3">
              <button 
                onClick={() => handleDownloadPdf(null)}
                className="w-full p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-left text-xs font-black text-slate-700 uppercase transition-all flex justify-between items-center group"
              >
                <span>Layout Padrão</span>
                <Download size={20} className="text-slate-300 group-hover:text-accent" />
              </button>
              {templates.map(t => (
                <button 
                  key={t.id}
                  onClick={() => handleDownloadPdf(t.id)}
                  className="w-full p-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-left text-xs font-black text-slate-700 uppercase transition-all flex justify-between items-center group"
                >
                  <span>{t.nome_modelo}</span>
                  <Sparkles size={20} className="text-slate-300 group-hover:text-accent" />
                </button>
              ))}
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
               <button onClick={() => setIsTemplateModalOpen(false)} className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600 transition-all">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewPage;
