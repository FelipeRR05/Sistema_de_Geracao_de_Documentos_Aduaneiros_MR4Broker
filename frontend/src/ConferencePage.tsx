import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, X, Loader2, Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const ConferencePage: React.FC = () => {
  const [instrucaoFile, setInstrucaoFile] = useState<File | null>(null);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [results, setResults] = useState<any | null>(null);

  const handleCompare = async () => {
    if (!instrucaoFile || !draftFile) return;
    setIsComparing(true);
    setResults(null);
    
    const formData = new FormData();
    formData.append('instrucao_file', instrucaoFile);
    formData.append('draft_file', draftFile);
    
    const promise = axios.post('http://localhost:8000/api/compare', formData);

    toast.promise(promise, {
      loading: 'IA comparando documentos...',
      success: (resp) => {
        setResults(resp.data);
        return 'Comparação concluída!';
      },
      error: 'Falha na comparação. Verifique o servidor.',
    });

    try {
      await promise;
    } catch (err) {
      console.error(err);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl animate-in fade-in zoom-in duration-700 space-y-6">
      
      {/* Upload Section */}
      <div className="bg-card/40 backdrop-blur-xl text-card-foreground rounded-[2rem] shadow-2xl border border-white/10 overflow-hidden p-8">
        <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
          <Scale className="text-accent" />
          Conferência de Documentos
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Instrução / Invoice Upload */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-600 ml-2">1. Instrução / Invoice</h3>
            {!instrucaoFile ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-accent/20 rounded-3xl cursor-pointer hover:bg-accent/5 transition-all bg-accent/5">
                <div className="flex flex-col items-center justify-center text-center px-4">
                  <Upload className="mb-2 text-accent/60" size={30} />
                  <p className="text-sm font-bold text-slate-400">Anexar Instrução</p>
                </div>
                <input type="file" className="hidden" onChange={(e) => { if(e.target.files) setInstrucaoFile(e.target.files[0]) }} accept=".pdf,.xlsx,.xls" />
              </label>
            ) : (
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-white/5 border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-accent/10 rounded-xl text-accent"><FileText size={20} /></div>
                  <p className="text-sm font-bold text-slate-700 truncate max-w-[180px]">{instrucaoFile.name}</p>
                </div>
                <button onClick={() => setInstrucaoFile(null)} className="text-slate-400 hover:text-destructive p-2 rounded-lg"><X size={20} /></button>
              </div>
            )}
          </div>

          {/* Draft BL Upload */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-600 ml-2">2. Draft BL</h3>
            {!draftFile ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-accent/20 rounded-3xl cursor-pointer hover:bg-accent/5 transition-all bg-accent/5">
                <div className="flex flex-col items-center justify-center text-center px-4">
                  <Upload className="mb-2 text-accent/60" size={30} />
                  <p className="text-sm font-bold text-slate-400">Anexar Draft BL</p>
                </div>
                <input type="file" className="hidden" onChange={(e) => { if(e.target.files) setDraftFile(e.target.files[0]) }} accept=".pdf,.xlsx,.xls" />
              </label>
            ) : (
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-white/5 border-slate-200">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-accent/10 rounded-xl text-accent"><FileText size={20} /></div>
                  <p className="text-sm font-bold text-slate-700 truncate max-w-[180px]">{draftFile.name}</p>
                </div>
                <button onClick={() => setDraftFile(null)} className="text-slate-400 hover:text-destructive p-2 rounded-lg"><X size={20} /></button>
              </div>
            )}
          </div>
          
        </div>

        <button
          onClick={handleCompare}
          disabled={!instrucaoFile || !draftFile || isComparing}
          className={`w-full mt-8 py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-4
            ${instrucaoFile && draftFile && !isComparing
              ? 'bg-accent text-primary hover:brightness-110 shadow-[0_10px_40px_-10px_rgba(225,177,44,0.3)] transform hover:-translate-y-1'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
        >
          {isComparing ? <><Loader2 className="animate-spin" size={24} /> COMPARANDO...</> : <><Scale size={24} /> COMPARAR DOCUMENTOS</>}
        </button>
      </div>

      {/* Results Section */}
      {results && (
        <div className="bg-white rounded-[2rem] shadow-xl p-8 border border-slate-100 animate-in slide-in-from-bottom-4">
          <h3 className="text-xl font-bold text-slate-800 mb-6 border-b pb-4">Resultados da Conferência</h3>
          
          {results.general_observations && (
            <div className="mb-8 bg-slate-50 p-4 rounded-xl text-slate-700 text-sm border border-slate-100">
              <span className="font-bold text-slate-900 block mb-2">Observações Gerais:</span>
              {results.general_observations}
            </div>
          )}

          {(results.comparisons || results.discrepancies) && (results.comparisons || results.discrepancies).length > 0 ? (
            <div className="space-y-4">
              {(results.comparisons || results.discrepancies).map((comp: any, idx: number) => {
                const statusLower = comp.status?.toLowerCase() || '';
                const isIdentico = statusLower === 'idêntico' || statusLower === 'identico' || statusLower === 'conferido' || comp.is_match === true || String(comp.is_match).toLowerCase() === 'true';
                const isParecido = statusLower === 'parecido';
                const isDivergente = !isIdentico && !isParecido;

                return (
                  <div key={idx} className={`flex items-start gap-4 p-4 border rounded-2xl ${isIdentico ? 'bg-green-50/50 border-green-100' : isParecido ? 'bg-yellow-50/50 border-yellow-100' : 'bg-red-50/50 border-red-100'}`}>
                    <div className={`p-2 rounded-lg shrink-0 mt-1 ${isIdentico ? 'bg-green-100 text-green-600' : isParecido ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                      {isIdentico ? <CheckCircle2 size={20} /> : isParecido ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                    </div>
                    <div className="flex-1">
                      <h4 className={`font-bold mb-2 ${isIdentico ? 'text-green-900' : isParecido ? 'text-yellow-900' : 'text-red-900'}`}>{comp.field}</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div className={`bg-white p-3 rounded-xl border ${isIdentico ? 'border-green-50' : isParecido ? 'border-yellow-50' : 'border-red-50'}`}>
                          <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Instrução/Invoice</span>
                          <span className="font-mono text-slate-800 break-words">{comp.doc1_value || '-'}</span>
                        </div>
                        <div className={`bg-white p-3 rounded-xl border ${isIdentico ? 'border-green-50' : isParecido ? 'border-yellow-50' : 'border-red-50'}`}>
                          <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Draft BL</span>
                          <span className="font-mono text-slate-800 break-words">{comp.doc2_value || '-'}</span>
                        </div>
                      </div>
                      <p className={`text-sm p-3 rounded-xl inline-block w-full ${isIdentico ? 'text-green-800 bg-green-50' : isParecido ? 'text-yellow-800 bg-yellow-50' : 'text-red-700 bg-red-50'}`}>
                        <span className="font-bold mr-2">{isIdentico ? 'Idêntico:' : isParecido ? 'Atenção (Parecido):' : 'Divergência:'}</span>
                        {comp.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-green-50 text-green-700 rounded-2xl border border-green-100">
              <CheckCircle2 size={48} className="mb-4 text-green-500" />
              <h4 className="text-xl font-bold mb-2">Tudo Certo!</h4>
              <p>Nenhuma divergência foi encontrada entre os documentos.</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default ConferencePage;
