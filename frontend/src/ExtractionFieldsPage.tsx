import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, Database, Save, Loader2, X, Tag } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

interface Alias {
  id: number;
  campo_sistema: string;
  label_exibicao: string;
  aliases: string;
  descricao: string;
}

const ExtractionFieldsPage: React.FC = () => {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingAlias, setEditingAlias] = useState<Alias | null>(null);
  const [formData, setFormData] = useState({
    campo_sistema: '',
    label_exibicao: '',
    aliases: '',
    descricao: ''
  });

  const fetchAliases = async () => {
    try {
      const resp = await axios.get('http://localhost:8000/api/aliases');
      setAliases(resp.data);
    } catch (err) {
      toast.error('Erro ao carregar campos de extração.');
    }
  };

  useEffect(() => {
    fetchAliases();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingAlias) {
        await axios.put(`http://localhost:8000/api/aliases/${editingAlias.id}`, formData);
        toast.success('Campo atualizado!');
      } else {
        await axios.post('http://localhost:8000/api/aliases', formData);
        toast.success('Novo campo de extração criado!');
      }
      setIsModalOpen(false);
      fetchAliases();
    } catch (err) {
      toast.error('Erro ao salvar campo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este campo e seus aliases? Isso pode afetar a extração por IA.')) return;
    try {
      await axios.delete(`http://localhost:8000/api/aliases/${id}`);
      toast.success('Campo removido.');
      fetchAliases();
    } catch (err) {
      toast.error('Erro ao excluir.');
    }
  };

  const openModal = (alias: Alias | null = null) => {
    if (alias) {
      setEditingAlias(alias);
      setFormData({
        campo_sistema: alias.campo_sistema,
        label_exibicao: alias.label_exibicao,
        aliases: alias.aliases,
        descricao: alias.descricao || ''
      });
    } else {
      setEditingAlias(null);
      setFormData({ campo_sistema: '', label_exibicao: '', aliases: '', descricao: '' });
    }
    setIsModalOpen(true);
  };

  return (
    <div className="w-full max-w-6xl p-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 border-b border-slate-100 pb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Campos de <span className="text-accent">Extração</span></h1>
          <p className="text-slate-500 font-bold tracking-widest text-[10px] uppercase mt-1">Configuração de Inteligência da IA</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-3 bg-primary text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg hover:brightness-110"
        >
          <Plus size={20} />
          NOVO CAMPO
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {aliases.map((a) => (
          <div key={a.id} className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl hover:shadow-2xl transition-all group relative">
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openModal(a)} className="p-2 text-slate-400 hover:text-accent"><Edit2 size={16}/></button>
              <button onClick={() => handleDelete(a.id)} className="p-2 text-slate-400 hover:text-destructive"><Trash2 size={16}/></button>
            </div>
            
            <div className="mb-4 w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
               <Tag size={24} />
            </div>

            <h3 className="text-lg font-black text-slate-800 uppercase mb-1">{a.label_exibicao}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">CHAVE: {a.campo_sistema}</p>
            
            <div className="space-y-2">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sinônimos Detectáveis:</p>
               <div className="flex flex-wrap gap-2">
                 {a.aliases.split(',').map((tag, idx) => (
                   <span key={idx} className="bg-slate-50 border border-slate-100 text-slate-600 px-2 py-1 rounded-md text-[9px] font-bold">
                     {tag.strip ? tag.trim() : tag}
                   </span>
                 ))}
               </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
            <div className="bg-primary p-8 text-center text-white">
               <h2 className="text-2xl font-black uppercase tracking-tight">{editingAlias ? 'Editar' : 'Novo'} <span className="text-accent">Campo IA</span></h2>
            </div>
            <form onSubmit={handleSubmit} className="p-10 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome no Sistema (snake_case)</label>
                <input type="text" required value={formData.campo_sistema} onChange={e=>setFormData({...formData, campo_sistema:e.target.value})} placeholder="ex: peso_cubado" className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-accent font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Título de Exibição</label>
                <input type="text" required value={formData.label_exibicao} onChange={e=>setFormData({...formData, label_exibicao:e.target.value})} placeholder="ex: Peso Cubado" className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-accent font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sinônimos (Separados por vírgula)</label>
                <textarea required value={formData.aliases} onChange={e=>setFormData({...formData, aliases:e.target.value})} placeholder="ex: Cubage, Volume, M3, CBM" className="w-full bg-slate-50 px-6 py-4 rounded-2xl border-2 border-gray-100 outline-none focus:border-accent font-bold h-32 resize-none" />
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-5 bg-accent text-primary rounded-2xl font-black text-lg transition-all shadow-lg hover:brightness-110">
                {isLoading ? <Loader2 className="animate-spin mx-auto" size={24} /> : "SALVAR CONFIGURAÇÃO"}
              </button>
              <button type="button" onClick={()=>setIsModalOpen(false)} className="w-full text-xs font-black text-slate-400 uppercase hover:text-slate-600">Cancelar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractionFieldsPage;
