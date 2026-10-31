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
    setJustification(""); // Limpiar el campo
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
      {/* Panel Izquierdo: Mapa Táctico */}
      <div style={{ flex: 1, position: "relative" }}>
        <TacticalMap />
      </div>

      {/* Panel Derecho: Agentes y Control */}
      <div
        style={{
          width: "400px",
          backgroundColor: "#111",
          padding: "20px",
          borderLeft: "1px solid #333",
        }}
      >
        <h2 style={{ color: "#00ffcc" }}>SANTI NEXUS - CMO (Mando)</h2>

        {/* Lista de Agentes */}
        <div style={{ marginTop: "20px" }}>
          <h4>Equipo de Inteligencia</h4>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              color: "#0f0",
              fontSize: "14px",
              lineHeight: "1.8",
            }}
          >
            <li>🟢 SANTI (Watsonx) - Analizando</li>
            <li>🟢 LORENA (Género/DDHH) - En llamada</li>
            <li>🟢 MAXIMILIANO (OSINT) - Rastreando</li>
            <li>🟢 EMILIANO (Táctico) - En espera</li>
          </ul>
        </div>

        {/* Botón de Cancelación Anti-Corrupción */}
        <div
          style={{
            marginTop: "40px",
            padding: "15px",
            backgroundColor: "#2a0000",
            border: "1px solid #ff0000",
            borderRadius: "8px",
          }}
        >
          <h4 style={{ color: "#ff4444" }}>Control de Unidades</h4>
          <p style={{ fontSize: "12px", color: "#ccc" }}>
            Unidad 14 asignada al Folio CV-2026
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
            }}
          >
            Cancelar Asignación (Requiere Auditoría)
          </button>
        </div>
      </div>

      {/* Modal de Auditoría */}
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
              placeholder="Escriba el motivo legal de la cancelación (mínimo 20 caracteres)..."
              style={{
                width: "100%",
                height: "100px",
                marginTop: "10px",
                backgroundColor: "#000",
                color: "#fff",
                padding: "10px",
                border: "1px solid #555",
                resize: "none",
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
                Confirmar Cancelación
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
