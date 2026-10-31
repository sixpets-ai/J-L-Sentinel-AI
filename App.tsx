import React, { useState } from "react";
import { CitizenView } from "./CitizenView";
import { CommandView } from "./CommandView";

function App() {
  const [view, setView] = useState<"citizen" | "command">("citizen");

  return (
    <div className="App">
      {/* Selector flotante para el video */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 9999,
          backgroundColor: "rgba(0,0,0,0.8)",
          padding: "10px",
          borderRadius: "5px",
          display: "flex",
          gap: "10px",
        }}
      >
        <button
          onClick={() => setView("citizen")}
          style={{
            padding: "8px 12px",
            backgroundColor: view === "citizen" ? "#00ffcc" : "#333",
            color: view === "citizen" ? "#000" : "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Vista Ciudadano
        </button>
        <button
          onClick={() => setView("command")}
          style={{
            padding: "8px 12px",
            backgroundColor: view === "command" ? "#00ffcc" : "#333",
            color: view === "command" ? "#000" : "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Vista Mando (CNI)
        </button>
      </div>

      {/* Renderiza la vista seleccionada */}
      {view === "citizen" ? <CitizenView /> : <CommandView />}
    </div>
  );
}

export default App;
