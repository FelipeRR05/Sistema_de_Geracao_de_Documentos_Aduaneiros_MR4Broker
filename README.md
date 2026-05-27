# Sistema de Geração de Documentos Aduaneiros MR4Broker

Plataforma inteligente de extração e gestão de documentos aduaneiros utilizando Inteligência Artificial local.

## 🚀 Sobre o Projeto

O **Sistema de Geração de Documentos Aduaneiros** é uma solução completa para automatizar o fluxo de documentos aduaneiros. O sistema utiliza modelos de linguagem locais (via Ollama) para realizar o parser inteligente de documentos, permitindo a extração, revisão, armazenamento e geração de documentos personalizados (PDF) de forma integrada.

## 🛠 Funcionalidades Principais

- **Extração com IA**: Parser inteligente utilizando modelos Llama3/LLaVA (via Ollama) para extração de dados logísticos.
- **Gestão de Processos**: Dashboard para visualização, edição, duplicação e exclusão de processos aduaneiros.
- **Mapeador de PDF Dinâmico**: Editor de templates onde o usuário define o layout dos documentos de saída.
- **Campos Customizáveis**: Sistema de Alias que permite ao usuário adicionar novos campos de extração conforme sua necessidade.
- **Fluxo de Trabalho**: Consolidação inteligente de dados (Intelligent Merge) de múltiplos documentos em um único processo.

## ⚙️ Tecnologias

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite.
- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Shadcn/ui.
- **IA**: Ollama (Llama3, LLaVA).

## 🚀 Como Executar

1. Instale o [Ollama](https://ollama.com/).
2. Instale as dependências Python: `pip install -r requirements.txt`.
3. Inicie o sistema: `python run_system.py`.
4. Acesse o frontend no endereço: `http://localhost:5173`.
