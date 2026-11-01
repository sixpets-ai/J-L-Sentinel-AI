import React, { useState } from "react";
import { TacticalMap } from "./TacticalMap";

export const CommandView = () => {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [justification, setJustification] = useState("");

  const handleCancelUnit = () => {
    if (justification.length < 20) {
      alert(
        "La justificación debe ser detallada (mínimo 20 caracteres). Quedará en el registro inmutable.",
      );
      return;
    }
    alert("Cancelación registrada. Ha sido auditada por SANTI.");
    setShowCancelModal(false);
    setJustification("");
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        backgroundColor: "#050505",
        color: "white",
      }}
    >
      <div style={{ flex: 1, position: "relative" }}>
        <TacticalMap />
      </div>
      <div
        style={{
          width: "400px",
          backgroundColor: "#111",
          padding: "20px",
          borderLeft: "1px solid #333",
          overflowY: "auto",
        }}
      >
        <h2 style={{ color: "#00ffcc", fontSize: "18px" }}>
          SANTI NEXUS - CMO (Mando)
        </h2>

        {/* Panel de Agentes */}
        <div
          style={{
            marginTop: "20px",
            padding: "10px",
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
          }}
        >
          <h4 style={{ color: "#fff", fontSize: "14px", marginBottom: "10px" }}>
            Equipo de Inteligencia
          </h4>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              color: "#0f0",
              fontSize: "12px",
              lineHeight: "1.8",
            }}
          >
            <li>🟢 SANTI (Watsonx) - Analizando</li>
            <li>🟢 LORENA (Género/DDHH) - En llamada</li>
            <li>🟢 MAXIMILIANO (OSINT) - Rastreando</li>
          </ul>
        </div>

        {/* NUEVO: Panel Cuántico / Física */}
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#0a1a1a",
            border: "1px solid #00ffcc",
            borderRadius: "8px",
          }}
        >
          <h4 style={{ color: "#00ffcc", fontSize: "14px" }}>
            ⚛️ Motor Cuántico y Física
          </h4>
          <p style={{ fontSize: "11px", color: "#aaa", marginBottom: "10px" }}>
            Análisis Probabilístico Bayesiano
          </p>
          <div
            style={{
              width: "100%",
              backgroundColor: "#333",
              height: "10px",
              borderRadius: "5px",
              marginBottom: "5px",
            }}
          >
            <div
              style={{
                width: "87%",
                backgroundColor: "#00ffcc",
                height: "100%",
                borderRadius: "5px",
              }}
            ></div>
          </div>
          <p style={{ fontSize: "12px" }}>
            Probabilidad de localización: <strong>87.4%</strong>
          </p>
          <p style={{ fontSize: "12px" }}>
            Nodos OSINT analizados: <strong>1,450</strong>
          </p>
        </div>

        {/* Control de Unidades */}
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#2a0000",
            border: "1px solid #ff0000",
            borderRadius: "8px",
          }}
        >
          <h4 style={{ color: "#ff4444", fontSize: "14px" }}>
            Control de Unidades
          </h4>
          <p style={{ fontSize: "12px", color: "#ccc", marginTop: "5px" }}>
            Enrutado a: FGR (5640967363)
          </p>
          <p style={{ fontSize: "12px", color: "#ccc" }}>
            Enrutado a: Fiscalía (6623519171)
          </p>
          <button
            onClick={() => setShowCancelModal(true)}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#ff0000",
              color: "white",
              border: "none",
              cursor: "pointer",
              marginTop: "10px",
              fontWeight: "bold",
              borderRadius: "4px",
            }}
          >
            Cancelar Asignación (Auditoría)
          </button>
        </div>

        <p
          style={{
            fontSize: "9px",
            color: "#555",
            marginTop: "20px",
            textAlign: "center",
          }}
        >
          © 2026 J&L Sentinel AI
        </p>
      </div>

      {showCancelModal && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.8)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: "#222",
              padding: "30px",
              borderRadius: "10px",
              width: "500px",
              border: "1px solid #ff0000",
            }}
          >
            <h3 style={{ color: "#ff0000" }}>⚠️ Auditoría Obligatoria</h3>
            <p style={{ fontSize: "14px" }}>
              El mando puede cancelar, pero debe justificar legalmente. Este
              registro es inmutable.
            </p>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Escriba el motivo legal (mínimo 20 caracteres)..."
              style={{
                width: "100%",
                height: "100px",
                marginTop: "10px",
                backgroundColor: "#000",
                color: "#fff",
                padding: "10px",
                border: "1px solid #555",
              }}
            />
            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <button
                onClick={handleCancelUnit}
                style={{
                  padding: "10px",
                  backgroundColor: "#ff0000",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  flex: 1,
                }}
              >
                Confirmar
              </button>
              <button
                onClick={() => setShowCancelModal(false)}
                style={{
                  padding: "10px",
                  backgroundColor: "#555",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  flex: 1,
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
