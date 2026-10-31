import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const TacticalDashboard = () => {
  const [agentResponse, setAgentResponse] = useState(
    "Sistema SANTI NEXUS en línea. Esperando instrucciones.",
  );

  // 🎙️ FUNCIÓN DE VOZ (Katering femenina / Hombres graves)
  const speakResponse = (text: string, agentName: string) => {
    const utterance = new SpeechSynthesisUtterance(text);

    if (agentName === "KATERING") {
      utterance.pitch = 1.6; // Fuerza voz aguda (femenina)
      utterance.rate = 1.05;
    } else {
      utterance.pitch = 0.8; // Fuerza voz grave (masculina)
      utterance.rate = 1.0;
    }

    utterance.lang = "es-MX";

    // Buscar la mejor voz en español del sistema
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang.includes("es") && v.name.includes("Google")) ||
      voices.find((v) => v.lang.includes("es"));
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: "#050505",
        color: "#fff",
      }}
    >
      {/* 🗺️ EL MAPA DE ÉLITE (Filtro CSS oscuro táctico sobre OpenStreetMap) */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer
          center={[23.6345, -102.5528]} // Centro de México Federal
          zoom={5}
          style={{
            height: "100%",
            width: "100%",
            filter:
              "invert(100%) hue-rotate(180deg) brightness(90%) contrast(120%)",
          }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />
          <Marker position={[23.6345, -102.5528]}>
            <Popup>Centro de Comando Nacional (CNIC)</Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* PANEL DE AGENTES Y VOZ */}
      <div
        style={{
          width: "400px",
          padding: "20px",
          backgroundColor: "#111",
          borderLeft: "1px solid #333",
        }}
      >
        <h2 style={{ color: "#00ffcc" }}>SANTI NEXUS - CMO</h2>
        <p style={{ fontSize: "12px", color: "#888" }}>
          Nivel Federal - Coordinación Interinstitucional
        </p>

        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            backgroundColor: "#1a1a1a",
            borderRadius: "8px",
          }}
        >
          <p>
            <strong>Último Reporte:</strong> {agentResponse}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button
            onClick={() => {
              setAgentResponse(
                "Hola, soy KATERING. Estoy aquí para apoyarte. ¿Te sientes en peligro?",
              );
              speakResponse(
                "Hola, soy KATERING. Estoy aquí para apoyarte. ¿Te sientes en peligro?",
                "KATERING",
              );
            }}
            style={{
              padding: "10px",
              backgroundColor: "#ff00aa",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            🦋 Hablar con Katering
          </button>

          <button
            onClick={() => {
              setAgentResponse(
                "Soy SANTI. Coordinando despliegue táctico a nivel federal.",
              );
              speakResponse(
                "Soy SANTI. Coordinando despliegue táctico a nivel federal.",
                "SANTI",
              );
            }}
            style={{
              padding: "10px",
              backgroundColor: "#0088ff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            🛡️ Hablar con SANTI
          </button>
        </div>
      </div>
    </div>
  );
};

export default TacticalDashboard;
