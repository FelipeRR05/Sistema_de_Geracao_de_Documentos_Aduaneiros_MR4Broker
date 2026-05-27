import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Copy, FileText, Download, Loader2, X, Sparkles, Database, Save, Brain, FilePlus, Cpu } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

interface Processo {
  id: number;
  numero_processo: string;
  cliente: string;
  is_template: boolean;
  data_criacao: string;
  documentos?: any[];
}

interface ProcessesPageProps {
  onEditDocument?: (docData: any) => void;
}

const ProcessesPage: React.FC<ProcessesPageProps> = ({ onEditDocument }) => {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ numero_processo: '', cliente: '', is_template: false });

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProcesso, setEditingProcesso] = useState<Processo | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);

  const fetchProcessos = async () => {
    try {
      const resp = await axios.get('http://localhost:8000/api/processos');
      setProcessos(resp.data);
    } catch (err) {
      toast.error('Erro ao carregar processos.');
    }
  };

  useEffect(() => {
    fetchProcessos();
    axios.get('http://localhost:8000/api/templates').then(r => setTemplates(r.data)).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await axios.post('http://localhost:8000/api/processos', formData);
      toast.success('Processo criado manualmente!');
      setIsModalOpen(false);
      setFormData({ numero_processo: '', cliente: '', is_template: false });
      fetchProcessos();
    } catch (err) {
      toast.error('Erro ao criar processo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProcesso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProcesso) return;
    setIsLoading(true);
    try {
      await axios.put(`http://localhost:8000/api/processos/${editingProcesso.id}`, {
        ...formData
      });
      toast.success('Processo atualizado!');
      setIsEditModalOpen(false);
      fetchProcessos();
    } catch (err) {
      toast.error('Erro ao atualizar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await axios.post(`http://localhost:8000/api/processos/${id}/duplicate`);
      toast.success('Processo duplicado!');
      fetchProcessos();
    } catch (err) {
      toast.error('Erro ao duplicar.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este processo e todos os seus documentos?')) return;
    try {
      await axios.delete(`http://localhost:8000/api/processos/${id}`);
      toast.success('Processo excluído.');
      setProcessos(processos.filter(p => p.id !== id));
    } catch (err) {
      toast.error('Erro ao excluir.');
    }
  };

  const handleSaveAsTemplate = async (id: number) => {
    try {
      await axios.post(`http://localhost:8000/api/processos/${id}/save-as-template`);
      toast.success('Processo marcado como Template!');
      fetchProcessos();
    } catch (err) {
      toast.error('Erro ao salvar template.');
    }
  };

  const openTemplateSelection = (docId: number) => {
    setSelectedDocId(docId);
    setIsTemplateModalOpen(true);
  };

  const handleDownloadWithTemplate = (templateId: number | null) => {
    if (selectedDocId) {
      const url = `http://localhost:8000/api/download-pdf/${selectedDocId}${templateId ? `?template_id=${templateId}` : ''}`;
      window.open(url, '_blank');
      setIsTemplateModalOpen(false);
    }
  };

  const openDocEdit = async (docId: number) => {
    if (!onEditDocument) return;
    try {
      const resp = await axios.get(`http://localhost:8000/api/documentos/${docId}`);
      onEditDocument(resp.data);
    } catch (err) {
      toast.error('Erro ao carregar documento.');
    }
  };

  const filtered = processos.filter(p => 
    p.numero_processo.toLowerCase().includes(search.toLowerCase()) ||
    p.cliente.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-full max-w-6xl p-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 border-b border-slate-100 pb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Processos <span className="text-accent">Salvos</span></h1>
          <p className="text-slate-500 font-bold tracking-widest text-[10px] uppercase mt-1">Gestão de Processos</p>
        </div>
        <button 
          onClick={() => setIsSelectionModalOpen(true)}
          className="flex items-center gap-3 bg-primary text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg hover:brightness-110 active:scale-95"
        >
          <Plus size={20} />
          NOVO PROCESSO
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
          <Search className="text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por processo ou cliente..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm font-bold w-full"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nº Processo</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Criação</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-8 py-6">
                    <span className="text-sm font-black text-slate-700 tracking-tight flex items-center gap-2">
                      {p.numero_processo}
                      {p.is_template && <span className="bg-accent/20 text-accent text-[8px] px-1.5 py-0.5 rounded font-black">TEMPLATE</span>}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-sm font-bold text-slate-500 uppercase">{p.cliente}</span>
                  </td>
                  <td className="px-8 py-6 text-xs font-bold text-slate-400">
                    {new Date(p.data_criacao).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {p.documentos && p.documentos.length > 0 && (
                        <>
                          <button 
                            onClick={() => openDocEdit(p.documentos![0].id)}
                            className="p-2 text-slate-400 hover:text-accent transition-colors"
                            title="Revisar Dados do Processo"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => openTemplateSelection(p.documentos![0].id)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent hover:text-primary rounded-lg transition-all text-[10px] font-black uppercase"
                          >
                            <Download size={14} /> BAIXAR
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => { setEditingProcesso(p); setFormData({numero_processo:p.numero_processo, cliente:p.cliente, is_template:p.is_template}); setIsEditModalOpen(true); }} 
                        className="p-2 text-slate-400 hover:text-accent transition-colors" 
                        title="Configurações do Processo"
                      >
                        <Database size={18} />
                      </button>
                      <button onClick={() => handleDuplicate(p.id)} className="p-2 text-slate-400 hover:text-accent transition-colors" title="Duplicar">
                        <Copy size={18} />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 text-slate-400 hover:text-destructive transition-colors" title="Excluir">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Seleção Tipo de Processo */}
      {isSelectionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 p-12">
            <h2 className="text-3xl font-black text-center uppercase mb-8 tracking-tighter">Escolha como <span className="text-accent">Começar</span></h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <button 
                onClick={() => { window.location.reload(); }} // Simplificação para voltar ao upload
                className="p-8 bg-slate-50 rounded-3xl border-2 border-slate-100 hover:border-accent hover:bg-accent/5 transition-all text-center group"
              >
                <Cpu size={48} className="mx-auto mb-4 text-slate-300 group-hover:text-accent transition-colors" />
                <h3 className="font-black text-slate-700 uppercase mb-2">Anexar Documentos (IA)</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Deixe nossa inteligência extrair os dados automaticamente</p>
              </button>
              <button 
                onClick={() => { setIsSelectionModalOpen(false); setIsModalOpen(true); }}
                className="p-8 bg-slate-50 rounded-3xl border-2 border-slate-100 hover:border-accent hover:bg-accent/5 transition-all text-center group"
              >
                <FilePlus size={48} className="mx-auto mb-4 text-slate-300 group-hover:text-accent transition-colors" />
                <h3 className="font-black text-slate-700 uppercase mb-2">Criar Manualmente</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Inicie um processo em branco e preencha os campos depois</p>
              </button>
            </div>
            <button onClick={()=>setIsSelectionModalOpen(false)} className="w-full mt-8 text-xs font-black text-slate-400 uppercase hover:text-slate-600">Cancelar</button>
          </div>
        </div>
      )}

      {/* Modal Novo Processo (Manual) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-primary p-8 text-center text-white">
               <h2 className="text-2xl font-black uppercase tracking-tight">Manual <span className="text-accent">Entry</span></h2>
            </div>
            <form onSubmit={handleCreate} className="p-10 space-y-6">
              <input type="text" required value={formData.numero_processo} onChange={e=>setFormData({...formData, numero_processo:e.target.value})} placeholder="Nº do Processo / Fatura" className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-accent font-bold" />
              <input type="text" required value={formData.cliente} onChange={e=>setFormData({...formData, cliente:e.target.value})} placeholder="Nome do Cliente" className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-accent font-bold" />
              <button type="submit" disabled={isLoading} className="w-full py-5 bg-accent text-primary rounded-2xl font-black text-lg transition-all shadow-lg hover:brightness-110">
                {isLoading ? <Loader2 className="animate-spin mx-auto" size={24} /> : "INICIAR PROCESSO"}
              </button>
              <button type="button" onClick={()=>setIsModalOpen(false)} className="w-full text-xs font-black text-slate-400 uppercase hover:text-slate-600">Voltar</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Processo */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-primary p-8 text-center text-white">
               <h2 className="text-2xl font-black uppercase tracking-tight">Configurar <span className="text-accent">Processo</span></h2>
            </div>
            <form onSubmit={handleUpdateProcesso} className="p-10 space-y-6">
              <input type="text" required value={formData.numero_processo} onChange={e=>setFormData({...formData, numero_processo:e.target.value})} className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-accent font-bold" />
              <input type="text" required value={formData.cliente} onChange={e=>setFormData({...formData, cliente:e.target.value})} className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-accent font-bold" />
              <div className="flex items-center gap-3 px-1">
                <input type="checkbox" checked={formData.is_template} onChange={e=>setFormData({...formData, is_template:e.target.checked})} className="w-5 h-5 accent-accent" />
                <label className="text-xs font-black text-slate-500 uppercase">Utilizar como Template de Sistema</label>
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-5 bg-accent text-primary rounded-2xl font-black text-lg transition-all shadow-lg hover:brightness-110">
                {isLoading ? <Loader2 className="animate-spin mx-auto" size={24} /> : "SALVAR ALTERAÇÕES"}
              </button>
              <button type="button" onClick={()=>setIsEditModalOpen(false)} className="w-full text-xs font-black text-slate-400 uppercase hover:text-slate-600">Cancelar</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Modelo para Download */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-primary p-6 text-center text-white">
              <h3 className="font-black uppercase tracking-tight">Gerar <span className="text-accent">PDF</span></h3>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Escolha o modelo de saída</p>
            </div>
            <div className="p-6 space-y-3">
              <button 
                onClick={() => handleDownloadWithTemplate(null)}
                className="w-full p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left text-xs font-black text-slate-700 uppercase transition-all flex justify-between items-center group"
              >
                <span>Modelo Padrão (Sistema)</span>
                <Download size={16} className="text-slate-300 group-hover:text-accent" />
              </button>
              {templates.map(t => (
                <button key={t.id} onClick={() => handleDownloadWithTemplate(t.id)} className="w-full p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left text-xs font-black text-slate-700 uppercase transition-all flex justify-between items-center group">
                  <span>{t.nome_modelo}</span>
                  <Sparkles size={16} className="text-slate-300 group-hover:text-accent" />
                </button>
              ))}
            </div>
            <button onClick={() => setIsTemplateModalOpen(false)} className="w-full pb-4 text-[10px] font-black text-slate-400 uppercase">Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessesPage;
