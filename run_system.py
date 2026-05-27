import subprocess
import os
import sys
import signal
import time
import socket
import httpx

processes = []
ollama_started_locally = False

def signal_handler(sig, frame):
    print("\nEncerrando processos...")
    for p, name in processes:
        if name == "Ollama" and not ollama_started_locally:
            continue
        try:
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)], capture_output=True)
        except Exception:
            p.terminate()
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def check_ollama_heartbeat():
    try:
        with httpx.Client(timeout=2.0) as client:
            response = client.get("http://localhost:11434/")
            return response.status_code == 200
    except Exception:
        return False

def check_ai_models():
    print("--- Verificando modelos de IA ---")
    required_models = ["llama3", "llava"]
    try:
        result = subprocess.run(["ollama", "list"], capture_output=True, text=True)
        installed_models = result.stdout
        for model in required_models:
            if model not in installed_models:
                print(f"Baixando modelo {model}... Isso pode levar alguns minutos.")
                subprocess.run(["ollama", "pull", model])
            print(f"Modelo {model}... [OK]")
    except Exception as e:
        print(f"Erro ao verificar Ollama: {e}.")
    print("--------------------------------")

def run_service(command, cwd=None, name=""):
    print(f"Iniciando {name}: {' '.join(command)}")
    p = subprocess.Popen(command, cwd=cwd, shell=True)
    processes.append((p, name))
    return p

if __name__ == "__main__":
    if is_port_in_use(11434):
        if check_ollama_heartbeat():
            print("Utilizando instância externa do Ollama (Porta 11434 ocupada).")
            ollama_started_locally = False
        else:
            print("Erro: Porta 11434 ocupada por um processo que não é o Ollama.")
            sys.exit(1)
    else:
        run_service(["ollama", "serve"], name="Ollama")
        ollama_started_locally = True
        print("Aguardando inicialização do Ollama...")
        while not check_ollama_heartbeat():
            time.sleep(1)

    check_ai_models()
    
    print("Sincronizando serviços e preparando ambiente...")
    time.sleep(1)
    
    run_service(["uvicorn", "main:app", "--reload"], cwd="backend", name="Backend (FastAPI)")
    
    if os.path.exists("frontend"):
        run_service(["npm", "run", "dev"], cwd="frontend", name="Frontend (Vite)")

    print("\n[OK] Ambiente MR4Broker pronto!")
    print("Backend: http://localhost:8000")
    print("Frontend: http://localhost:5173")
    print("Pressione Ctrl+C para encerrar.\n")
    
    try:
        while True:
            time.sleep(1)
            for p, name in processes:
                if name == "Ollama" and not ollama_started_locally:
                    continue
                if p.poll() is not None:
                    print(f"\nAlerta: O serviço {name} parou inesperadamente.")
                    signal_handler(None, None)
    except KeyboardInterrupt:
        signal_handler(None, None)
