import { useState } from "react";

export const DEMO_MODULES = {
  mujer: {
    icon: "🦋",
    title: "Código Violeta",
    color: "#E91E8C",
    category: "Solicitud de apoyo preventivo",
    guidance: "Si hay peligro inmediato, aléjate si puedes hacerlo con seguridad y contacta directamente al 911.",
  },
  extorsion: {
    icon: "🔒",
    title: "Extorsión",
    color: "#FF6D00",
    category: "Reporte de extorsión",
    guidance: "No confrontes a nadie ni compartas información financiera. Esta demo no recibe ni envía alertas.",
  },
  escuela: {
    icon: "🏫",
    title: "Seguridad escolar",
    color: "#00E5FF",
    category: "Observación de seguridad escolar",
    guidance: "No te acerques a una situación peligrosa. Contacta a responsables escolares o al 911 si existe riesgo inmediato.",
  },
  desaparicion: {
    icon: "🔍",
    title: "Persona no localizada",
    color: "#00897B",
    category: "Reporte de persona no localizada",
    guidance: "Para una situación real, contacta de inmediato a las autoridades competentes. Esta demo no inicia una búsqueda.",
  },
  narco: {
    icon: "○",
    title: "Observación comunitaria",
    color: "#C8A84B",
    category: "Observación no verificada",
    guidance: "No investigues ni te acerques a personas o lugares. Describe solo una observación general y no verificada.",
  },
} as const;

export type DemoModuleId = keyof typeof DEMO_MODULES;

function localDateAndTime() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

export function DemoModuleDialog({
  moduleId,
  onClose,
}: {
  moduleId: DemoModuleId;
  onClose: () => void;
}) {
  const module = DEMO_MODULES[moduleId];
  const initial = localDateAndTime();
  const [alias, setAlias] = useState("");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [evidenceName, setEvidenceName] = useState("");

  const downloadDraft = () => {
    const text = [
      "BORRADOR DE DEMOSTRACIÓN — NO ES UN DOCUMENTO OFICIAL",
      "No sustituye una denuncia, un IPH, una cadena de custodia ni asesoría jurídica.",
      "No se envió a autoridades ni se transmitió a un servidor.",
      "",
      `Categoría: ${module.category}`,
      `Nombre o alias (opcional): ${alias || "No proporcionado"}`,
      `Fecha: ${date || "No proporcionada"}`,
      `Hora: ${time || "No proporcionada"}`,
      `Ubicación manual: ${location || "No proporcionada"}`,
      `Descripción no verificada: ${description || "No proporcionada"}`,
      `Adjunto local (solo nombre): ${evidenceName || "Ninguno"}`,
      "",
      "Generado localmente por una demostración. Verifica cualquier información con autoridades competentes.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `borrador-demo-${moduleId}-${date || "sin-fecha"}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1500, background: "rgba(0,0,0,.82)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-module-title"
        style={{ width: "min(580px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "#040F1D", border: `1px solid ${module.color}55`, borderRadius: 16, padding: 20, boxShadow: `0 0 40px ${module.color}18` }}
      >
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${module.color}25` }}>
          <span aria-hidden="true" style={{ fontSize: 26 }}>{module.icon}</span>
          <div>
            <div id="demo-module-title" style={{ fontFamily: "'Orbitron',monospace", fontSize: 14, fontWeight: 700, color: module.color }}>{module.title}</div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: "#7189A0", marginTop: 4 }}>FORMULARIO LOCAL · DEMOSTRACIÓN</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar formulario" style={{ marginLeft: "auto", background: "none", border: 0, color: "#91A8BC", fontSize: 20, cursor: "pointer" }}>×</button>
        </header>

        <div role="note" style={{ padding: 10, marginBottom: 12, background: "rgba(255,193,7,.07)", border: "1px solid rgba(255,193,7,.2)", borderRadius: 8, color: "#E4C979", fontSize: 11, lineHeight: 1.5 }}>
          Usa datos ficticios. No se solicita GPS ni se envía información a autoridades o servidores. El archivo adjunto solo se selecciona localmente; no se carga.
        </div>
        <p style={{ color: "#8AAAC8", fontSize: 11, lineHeight: 1.55, margin: "0 0 12px" }}>{module.guidance}</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={labelStyle}>
            Nombre o alias (opcional)
            <input value={alias} onChange={(event) => setAlias(event.target.value)} maxLength={80} placeholder="Usa un alias ficticio" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Ubicación manual (opcional)
            <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={120} placeholder="Sector general o coordenadas de demo" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Fecha
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Hora
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} style={inputStyle} />
          </label>
        </div>

        <label style={{ ...labelStyle, display: "block", marginTop: 9 }}>
          Descripción no verificada
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1500} rows={4} placeholder="Escribe una descripción ficticia para probar el formulario." style={{ ...inputStyle, resize: "vertical" }} />
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <label style={{ ...buttonStyle, borderColor: `${module.color}55`, color: module.color }}>
            Adjuntar archivo (solo local)
            <input type="file" accept="image/*,.pdf,.txt" onChange={(event) => setEvidenceName(event.target.files?.[0]?.name ?? "")} style={{ display: "none" }} />
          </label>
          <span style={{ color: "#7189A0", fontSize: 10, overflowWrap: "anywhere" }}>{evidenceName || "No se seleccionó archivo"}</span>
        </div>

        <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button type="button" onClick={onClose} style={buttonStyle}>Cerrar</button>
          <button type="button" onClick={downloadDraft} style={{ ...buttonStyle, borderColor: `${module.color}70`, background: `${module.color}16`, color: module.color }}>
            Descargar borrador TXT · DEMO
          </button>
        </footer>
      </section>
    </div>
  );
}

export function PanicDemoDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1600, background: "rgba(0,0,0,.84)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="panic-demo-title" style={{ width: "min(460px,100%)", background: "#120817", border: "1px solid rgba(233,30,140,.55)", borderRadius: 16, padding: 22, boxShadow: "0 0 35px rgba(233,30,140,.16)" }}>
        <div style={{ fontFamily: "'Orbitron',monospace", color: "#F48FB1", fontSize: 14, fontWeight: 700 }} id="panic-demo-title">SIMULACIÓN · CÓDIGO VIOLETA</div>
        <p style={{ color: "#D6C4D0", fontSize: 12, lineHeight: 1.65 }}>
          No solicita ubicación, no vibra ni reproduce sirenas, no contacta a unidades o autoridades y no envía alertas a nadie.
        </p>
        <p style={{ color: "#FFD6E5", fontSize: 12, lineHeight: 1.65, fontWeight: 600 }}>
          No uses esta demo para pedir ayuda real. Si existe peligro inmediato, llama al 911 directamente.
        </p>
        <button type="button" onClick={onClose} style={{ ...buttonStyle, width: "100%", marginTop: 8, borderColor: "rgba(233,30,140,.55)", background: "rgba(233,30,140,.12)", color: "#F48FB1" }}>
          CERRAR DEMOSTRACIÓN
        </button>
      </section>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  color: "#9BB0C3",
  fontFamily: "'Share Tech Mono',monospace",
  fontSize: 9,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(0,0,0,.36)",
  border: "1px solid rgba(200,168,75,.2)",
  borderRadius: 7,
  padding: "8px 9px",
  color: "#D0E8FF",
  fontFamily: "'Rajdhani',sans-serif",
  fontSize: 12,
};

const buttonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "8px 11px",
  border: "1px solid rgba(134,161,184,.3)",
  borderRadius: 7,
  background: "rgba(0,0,0,.25)",
  color: "#C8D8E8",
  fontFamily: "'Share Tech Mono',monospace",
  fontSize: 9,
  cursor: "pointer",
  textAlign: "center",
};
