import React, { useState } from 'react';
import axios from 'axios';
import { Upload, FileText, X, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import logoBranca from './assets/logo_branca.png';

interface UploadPageProps {
  onUploadComplete: (data: any[]) => void;
}

const UploadPage: React.FC<UploadPageProps> = ({ onUploadComplete }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      setError(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    
    const promise = axios.post('http://localhost:8000/upload', formData);

    toast.promise(promise, {
      loading: 'IA analisando documentos...',
      success: (resp) => {
        onUploadComplete(resp.data);
        return 'Extração concluída com sucesso!';
      },
      error: 'Falha na extração. Verifique o servidor.',
    });

    try {
      await promise;
    } catch (err: any) {
      setError('Erro na conexão. Verifique se o servidor está rodando.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl animate-in fade-in zoom-in duration-700">
      <div className="bg-card/40 backdrop-blur-xl text-card-foreground rounded-[2rem] shadow-2xl border border-white/10 overflow-hidden">
        <div className="bg-primary p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent/40 via-transparent to-transparent"></div>
          
          <div className="relative mx-auto w-80 h-30 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 bg-accent/15 rounded-[2rem] rotate-4 animate-pulse"></div>
            <div className="absolute inset-0 bg-accent/10 rounded-[2rem] -rotate-4"></div>
            
            <img 
              src={logoBranca} 
              alt="Logo MR4" 
              className="relative z-10 w-70 h-auto object-contain" 
            />
          </div>

          <p className="text-slate-300 font-bold tracking-widest text-[10px] uppercase">Processamento de Documentos com Inteligência Artificial</p>
        </div>

        <div className="p-10">
          <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-accent/20 rounded-3xl cursor-pointer hover:bg-accent/5 transition-all group bg-accent/5">
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
              <Upload className="mb-4 text-accent/60 group-hover:text-accent transition-colors" size={40} />
              <p className="text-sm font-bold text-slate-400">Clique para anexar Documentos Aduaneiros</p>
              <p className="text-xs text-slate-500 mt-2">Suporta faturas, bookings e packing lists</p>
            </div>
            <input type="file" className="hidden" multiple onChange={onFileChange} accept=".pdf,.xlsx,.xls" />
          </label>

          {files.length > 0 && (
            <div className="mt-8 space-y-3 max-h-52 overflow-y-auto pr-3 custom-scrollbar">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-white/5 group animate-in slide-in-from-right-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-accent/10 rounded-xl text-accent">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-300 truncate max-w-[280px]">{file.name}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Pronto para processamento</p>
                    </div>
                  </div>
                  <button onClick={() => removeFile(idx)} className="text-slate-600 hover:text-destructive transition-colors p-2 hover:bg-destructive/10 rounded-lg">
                    <X size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-2xl text-center font-bold">{error}</div>}

          <button
            onClick={handleUpload}
            disabled={files.length === 0 || isUploading}
            className={`w-full mt-10 py-5 rounded-2xl font-black text-xl transition-all shadow-[0_10px_40px_-10px_rgba(225,177,44,0.3)] flex items-center justify-center gap-4
              ${files.length > 0 && !isUploading
                ? 'bg-accent text-primary hover:brightness-110 transform hover:-translate-y-1'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="animate-spin" size={28} />
                ANALISANDO...
              </>
            ) : (
              <>
                <Sparkles size={24} />
                INICIAR EXTRAÇÃO
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
