import { useState } from 'react'
import UploadPage from './UploadPage'
import ReviewPage from './ReviewPage'
import TemplatesPage from './TemplatesPage'
import ProcessesPage from './ProcessesPage'
import ExtractionFieldsPage from './ExtractionFieldsPage'
import { Toaster } from 'sonner'
import { FileSearch, LayoutTemplate, Menu, X, Briefcase, Tag } from 'lucide-react'
import logoBranca from './assets/logo_branca.png'

function App() {
  const [extractionData, setExtractionData] = useState<any[] | null>(null);
  const [activePage, setActivePage] = useState<'extracao' | 'processos' | 'modelos' | 'aliases'>('extracao');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);

  const handleUploadComplete = (data: any[]) => {
    setExtractionData(data);
    setEditingDocId(null);
  };

  const handleEditDocument = (docData: any) => {
    setExtractionData([docData]);
    setEditingDocId(docData.id);
    setActivePage('extracao');
  };

  const handleReset = () => {
    setExtractionData(null);
    setEditingDocId(null);
  };

  const renderContent = () => {
    if (activePage === 'modelos') {
      return <TemplatesPage />;
    }
    if (activePage === 'processos') {
      return <ProcessesPage onEditDocument={handleEditDocument} />;
    }
    if (activePage === 'aliases') {
      return <ExtractionFieldsPage />;
    }

    return !extractionData ? (
      <UploadPage onUploadComplete={handleUploadComplete} />
    ) : (
      <ReviewPage 
        initialData={extractionData} 
        onReset={handleReset} 
        existingId={editingDocId}
      />
    );
  };

  return (
    <div className="min-h-screen w-full bg-white text-slate-900 font-sans selection:bg-accent selection:text-primary flex overflow-hidden">
      <Toaster position="top-center" richColors />
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-72' : 'w-20'} bg-primary transition-all duration-300 flex flex-col border-r border-white/10 relative z-50 shrink-0`}>
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && (
            <img src={logoBranca} alt="Logo MR4" className="h-7 w-auto object-contain" />
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-white hover:text-accent transition-colors">
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <nav className="mt-8 flex-1 px-4 space-y-2">
          <button
            onClick={() => { setActivePage('extracao'); handleReset(); }}
            className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all font-bold uppercase text-xs tracking-widest
              ${activePage === 'extracao' ? 'bg-accent text-primary' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <FileSearch size={20} />
            {isSidebarOpen && "Novo Upload"}
          </button>

          <button
            onClick={() => setActivePage('processos')}
            className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all font-bold uppercase text-xs tracking-widest
              ${activePage === 'processos' ? 'bg-accent text-primary' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <Briefcase size={20} />
            {isSidebarOpen && "Processos Salvos"}
          </button>
          
          <button
            onClick={() => setActivePage('modelos')}
            className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all font-bold uppercase text-xs tracking-widest
              ${activePage === 'modelos' ? 'bg-accent text-primary' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <LayoutTemplate size={20} />
            {isSidebarOpen && "Modelos de PDF"}
          </button>

          <button
            onClick={() => setActivePage('aliases')}
            className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all font-bold uppercase text-xs tracking-widest
              ${activePage === 'aliases' ? 'bg-accent text-primary' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
          >
            <Tag size={20} />
            {isSidebarOpen && "Campos IA"}
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex justify-center items-start min-h-screen p-4 overflow-y-auto bg-slate-50/50">
        <div className="w-full flex justify-center py-8">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}

export default App
