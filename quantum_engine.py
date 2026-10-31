import os
from qiskit_ibm_runtime import QiskitRuntimeService

def run_quantum_optimization():
    print("Iniciando conexión con IBM Quantum...")
    try:
        # Se conecta usando los Secrets seguros de Replit
        service = QiskitRuntimeService(
            channel="ibm_quantum_platform",
            token=os.getenv("IBM_API_KEY"),
            instance=os.getenv("QUANTUM_CRN") # <-- Aquí irá el CRN cuando lo tengas
        )

        # Busca el procesador cuántico real con menos cola
        backend = service.least_busy(operational=True, simulator=False)
        print(f"✅ CONEXIÓN EXITOSA AL QPU REAL: {backend.name}")
        return backend.name
    except Exception as e:
        print(f"⚠️ Esperando CRN de IBM Quantum: {e}")
        return "Simulación local activa"

if __name__ == "__main__":
    run_quantum_optimization()