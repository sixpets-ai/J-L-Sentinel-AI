import React, { useState } from "react";
import { CitizenView } from "./CitizenView";
import { CommandView } from "./CommandView";

function App() {
  const [view, setView] = useState<"citizen" | "command">("citizen");

  return (
    <div className="App">
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 9999,
          backgroundColor: "rgba(0,0,0,0.9)",
          padding: "10px",
          borderRadius: "8px",
          display: "flex",
          gap: "10px",
          border: "1px solid #333",
        }}
      >
        <button
          onClick={() => setView("citizen")}
          style={{
            padding: "8px 16px",
            backgroundColor: view === "citizen" ? "#00ffcc" : "#222",
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
            padding: "8px 16px",
            backgroundColor: view === "command" ? "#00ffcc" : "#222",
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
      {view === "citizen" ? <CitizenView /> : <CommandView />}
    </div>
  );
}
export default App;
