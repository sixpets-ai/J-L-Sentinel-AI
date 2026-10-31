import React, { useState, useEffect, useRef } from "react";
import { TacticalMap } from "./TacticalMap";

export const CitizenView = () => {
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [folio, setFolio] = useState("");
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");

  const recognitionRef = useRef<any>(null);

  // Función para activar la voz de IA (Femenina para Lorena)
  const speakText = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.5; // Voz femenina
    utterance.rate = 1.0;
    utterance.lang = "es-MX";
    utterance.onend = () => {
      // Cuando termina de hablar, vuelve a escuchar si el modo manos libres está activo
      if (isHandsFree && recognitionRef.current) {
        recognitionRef.current.start();
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  // Inicializar el reconocimiento de voz
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "es-MX";

      recognitionRef.current.onresult = async (event: any) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        setTranscript(transcriptText);

        // Si la persona deja de hablar (es un resultado final), enviamos a la IA
        if (event.results[current].isFinal) {
          recognitionRef.current.stop(); // Detener escucha mientras piensa
          await sendToAgent(transcriptText);
        }
      };
    }
  }, [isHandsFree]);

  const activateCodeViolet = () => {
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
    const newFolio = `CV-2026-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setFolio(newFolio);
    setEmergencyActive(true);
    setIsHandsFree(true); // Activa el modo continuo automáticamente

    // Lorena saluda automáticamente
    const welcomeMsg =
      "Hola, soy Lorena. He recibido tu alerta de Código Violeta. La unidad 14 ya va en camino. Estoy aquí contigo, dime, ¿estás en un lugar seguro?";
    setAiResponse(welcomeMsg);
    speakText(welcomeMsg);

    if (recognitionRef.current) recognitionRef.current.start();
  };

  const sendToAgent = async (text: string) => {
    try {
      // Nota: Si lo pruebas en Replit, usa la URL completa o localhost.
      const res = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: "LORENA", prompt: text }),
      });
      const data = await res.json();
      setAiResponse(data.response);
      speakText(data.response); // La IA responde y automáticamente vuelve a escuchar
    } catch (e) {
      const errorMsg =
        "No te preocupes, la línea está fallando pero la patrulla va en camino.";
      setAiResponse(errorMsg);
      speakText(errorMsg);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0a0a0a",
        color: "white",
      }}
    >
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          backgroundColor: "#111",
          borderBottom: "2px solid #ff00aa",
        }}
      >
        <h2>SANTI NEXUS - Auxilio Ciudadano</h2>
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        <TacticalMap />

        <button
          onClick={activateCodeViolet}
          style={{
            position: "absolute",
            bottom: "30px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            backgroundColor: "#ff00aa",
            color: "white",
            fontSize: "16px",
            fontWeight: "bold",
            border: "5px solid #fff",
            boxShadow: "0 0 20px #ff00aa",
            cursor: "pointer",
            zIndex: 1000,
          }}
        >
          CÓDIGO VIOLETA
        </button>
      </div>

      {emergencyActive && (
        <div
          style={{
            padding: "20px",
            backgroundColor: "#1a001a",
            borderTop: "2px solid #ff00aa",
            textAlign: "center",
          }}
        >
          <h3 style={{ color: "#ff00aa" }}>
            🚨 ALERTA ACTIVA - FOLIO: {folio}
          </h3>
          <div
            style={{
              margin: "10px 0",
              padding: "10px",
              backgroundColor: "#000",
              borderRadius: "5px",
            }}
          >
            <p style={{ color: "#888", fontSize: "12px" }}>Tú: {transcript}</p>
            <p style={{ color: "#00ffcc" }}>Lorena (IA): {aiResponse}</p>
          </div>
          {isHandsFree && (
            <p style={{ color: "#ff00aa", fontSize: "12px", animate: "pulse" }}>
              🎙️ Modo Manos Libres Activado (Escuchando...)
            </p>
          )}
        </div>
      )}
    </div>
  );
};
