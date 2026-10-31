import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getGetStatsQueryKey, useGetStats, useAnalyzeIncident, useCreateReport } from "@workspace/api-client-react";
import { playNewReport, playAgentActivated } from "@/lib/audio";
import {
  speakAsAgent, stopAgentSpeech,
} from "@/lib/agent-speech";
import { useSpeechDictation } from "@/hooks/use-speech-dictation";
import { DemoModuleDialog, PanicDemoDialog } from "@/components/demo-module-dialog";
import { DEMO_MODULES, type DemoModuleId } from "@/components/demo-modules";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;

/* ─── CONSTANTS ────────────────────────────────────────────── */

const AGENTS = {
  santi:    { name: "SANTI",       emoji: "👮", color: "#C8A84B", role: "Asistente de IA · Demo", lang: "Español" },
  emiliano: { name: "EMILIANO",    emoji: "⚔️",  color: "#1E88E5", role: "Asistente de IA · Demo", lang: "Español" },
  maxi:     { name: "MAXIMILIANO", emoji: "🔎", color: "#9C27B0", role: "Asistente de IA · Demo", lang: "Español" },
  santiago: { name: "SANTIAGO",    emoji: "🏫", color: "#00897B", role: "Asistente de IA · Demo", lang: "Español" },
  katering: { name: "KATERING",    emoji: "🦋", color: "#E91E8C", role: "Asistente de IA · Demo", lang: "Español" },
} as const;
type AgentId = keyof typeof AGENTS;

const CRIME_TYPES = [
  "Robo / asalto", "Violencia familiar", "Narcomenudeo",
  "Extorsión", "Arma o disparos", "Persona no localizada",
  "Seguridad escolar", "Amenazas", "Otra observación",
];

const TYPE_AGENT: Record<string, AgentId> = {
  "Violencia familiar": "katering", "Seguridad escolar": "santiago",
  "Narcomenudeo": "maxi", "Arma o disparos": "emiliano",
  "Extorsión": "maxi", "Persona no localizada": "santi",
};

function genFolio() {
  return `SANTI-DEMO-${Date.now().toString(36).toUpperCase()}`;
}

function nowStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}

interface FolioEntry {
  folio: string; tipo: string; agente: AgentId;
  sector: string; horaEntrada: string;
  lat?: number; lng?: number;
}
interface ChatMsg { role: "user"|"agent"; text: string; }
interface TraceEntry { time: string; event: string; }
interface AnalysisResult {
  agente: string; analisis: string; nivelRiesgo: string;
  accionesRecomendadas: string[]; unidadesRequeridas: number;
  protocolo: string; coordinacion: string;
}

/* ─── MODAL: AGENT CHAT ─────────────────────────────────────── */
function AgentChatModal({
  agentId, onClose, speak, voiceEnabled, onToggleVoice,
}: {
  agentId: AgentId;
  onClose: () => void;
  speak: (t: string, a: AgentId) => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
}) {
  const ag = AGENTS[agentId];
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "agent", text: `Soy ${ag.name}, asistente de IA de esta demostración. ¿Qué información general necesitas?` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const { listening, error: voiceInputError, toggle: toggleListening } =
    useSpeechDictation(setInput, () => setInput(""));

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = useCallback(async () => {
    if (!input.trim() || loading || listening) return;
    const q = input.trim();
    setInput("");
    setMsgs(p => [...p, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/santi/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, userMessage: q }),
      });
      const data: { response?: string; error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "No fue posible consultar al asistente.");
      const reply = data.response || "Sin respuesta del sistema.";
      setMsgs(p => [...p, { role: "agent", text: reply }]);
      speak(reply, agentId);
    } catch {
      setMsgs(p => [...p, { role: "agent", text: "No pude conectar con el asistente. Puedes intentarlo de nuevo." }]);
    } finally { setLoading(false); }
  }, [input, loading, listening, agentId, speak]);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,.82)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:12 }}>
      <div role="dialog" aria-modal="true" aria-label={`Conversación con ${ag.name}`}
        style={{ width:"min(520px, 100%)",maxHeight:"82vh",display:"flex",flexDirection:"column",background:"#040F1D",border:`1px solid ${ag.color}30`,borderRadius:16,overflow:"hidden",boxShadow:`0 0 40px ${ag.color}20` }}>
        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:`${ag.color}10`,borderBottom:`1px solid ${ag.color}20`,flexShrink:0 }}>
          <div style={{ width:44,height:44,borderRadius:"50%",background:`${ag.color}20`,border:`2px solid ${ag.color}50`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22 }}>{ag.emoji}</div>
          <div>
            <div style={{ fontFamily:"'Orbitron',monospace",fontSize:13,fontWeight:700,color:ag.color,letterSpacing:1 }}>{ag.name}</div>
            <div style={{ fontSize:10,color:"#3A5A7A",fontFamily:"'Share Tech Mono',monospace",marginTop:2 }}>{ag.role}</div>
            <div style={{ fontSize:9,color:`${ag.color}80`,fontFamily:"'Share Tech Mono',monospace",marginTop:1 }}>🌐 {ag.lang}</div>
          </div>
          <div style={{ marginLeft:"auto",display:"flex",gap:6,alignItems:"center" }}>
            <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#C8A84B" }}>IA · DEMO</span>
          </div>
          <button type="button" onClick={onToggleVoice} aria-pressed={voiceEnabled}
            title={voiceEnabled ? "Desactivar respuestas por voz" : "Activar respuestas por voz"}
            style={{background:voiceEnabled?`${ag.color}18`:"rgba(0,0,0,.2)",border:`1px solid ${ag.color}35`,borderRadius:7,color:ag.color,fontFamily:"'Share Tech Mono',monospace",fontSize:8,padding:"7px 8px",cursor:"pointer",whiteSpace:"nowrap"}}>
            {voiceEnabled ? "VOZ ACTIVA" : "ACTIVAR VOZ"}
          </button>
          <button onClick={onClose} style={{ marginLeft:8,background:"none",border:"none",color:"#3A5A7A",fontSize:18,cursor:"pointer",padding:4 }}>✕</button>
        </div>
        {/* Messages */}
        <div style={{ flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:8,scrollbarWidth:"thin" }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display:"flex",gap:8,justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
              {m.role === "agent" && (
                <div style={{ width:28,height:28,borderRadius:"50%",background:`${ag.color}20`,border:`1px solid ${ag.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0 }}>{ag.emoji}</div>
              )}
              <div style={{ maxWidth:"76%",padding:"9px 12px",borderRadius:m.role==="user"?"12px 12px 4px 12px":"12px 12px 12px 4px",background:m.role==="user"?"rgba(200,168,75,.12)":"rgba(10,30,50,.9)",border:`1px solid ${m.role==="user"?"rgba(200,168,75,.2)":`${ag.color}25`}`,fontSize:12,lineHeight:1.6,color:"#D0E8FF" }}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display:"flex",gap:8 }}>
              <div style={{ width:28,height:28,borderRadius:"50%",background:`${ag.color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14 }}>{ag.emoji}</div>
              <div style={{ padding:"9px 14px",borderRadius:"12px 12px 12px 4px",background:"rgba(10,30,50,.9)",border:`1px solid ${ag.color}25` }}>
                <span style={{ display:"inline-flex",gap:4 }}>
                  {[0,150,300].map(d => <span key={d} style={{ width:5,height:5,borderRadius:"50%",background:ag.color,animation:`pulse-dot 1s ${d}ms infinite`,display:"inline-block" }}/>)}
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        {/* Input */}
        <div style={{ padding:"10px 14px",borderTop:`1px solid ${ag.color}20`,flexShrink:0 }}>
          {voiceInputError && <div role="status" style={{color:"#FF8C8C",fontSize:10,marginBottom:7}}>{voiceInputError}</div>}
          <div style={{display:"flex",gap:7}}>
            <button type="button" onClick={toggleListening} aria-label={listening ? "Detener dictado" : "Dictar mensaje"}
              aria-pressed={listening} disabled={loading}
              style={{padding:"8px 11px",background:listening?"rgba(255,23,68,.15)":`${ag.color}12`,border:`1px solid ${listening?"rgba(255,23,68,.6)":`${ag.color}40`}`,borderRadius:8,color:listening?"#FF6D6D":ag.color,fontSize:15,cursor:loading?"not-allowed":"pointer",opacity:loading?.55:1}}>
              {listening ? "DETENER" : "MIC"}
            </button>
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&send()}
              maxLength={2000}
              aria-label={`Mensaje para ${ag.name}`}
              placeholder={listening ? "Escuchando… revisa el texto antes de enviarlo" : `Escribe o dicta a ${ag.name}...`}
              style={{ minWidth:0,flex:1,background:"rgba(0,0,0,.4)",border:`1px solid ${ag.color}30`,borderRadius:8,padding:"8px 12px",color:"#D0E8FF",fontFamily:"'Rajdhani',sans-serif",fontSize:13,outline:"none" }} />
            <button type="button" onClick={send} disabled={loading||!input.trim()||listening}
              style={{ padding:"8px 14px",background:loading?`${ag.color}20`:`${ag.color}18`,border:`1px solid ${ag.color}50`,borderRadius:8,color:ag.color,fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,cursor:"pointer",letterSpacing:1,transition:"all .2s",opacity:(!input.trim()||loading||listening)?.6:1 }}>
              ENVIAR
            </button>
          </div>
          <div style={{fontSize:9,color:"#526A80",lineHeight:1.4,marginTop:7}}>
            El texto se procesa con IA. El micrófono solo se activa al pulsar y el navegador procesa el dictado; no ingreses datos personales reales ni información de incidentes activos.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ────────────────────────────────────────── */
export default function SantiCommand() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map|null>(null);
  const selectedLocationMarkerRef = useRef<L.CircleMarker|null>(null);
  const audioInit = useRef(false);

  const [clock, setClock] = useState("");
  const [clockDate, setClockDate] = useState("");
  const [coords, setCoords] = useState("Haz clic en el mapa para elegir coordenadas (opcional)");
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }|null>(null);

  /* Speech */
  const [speechText, setSpeechText] = useState("Bienvenido a SANTI NEXUS. Demostración interactiva con asistentes de IA y datos simulados.");
  const [speechAgent, setSpeechAgent] = useState<AgentId>("santi");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const speechRequestRef = useRef(0);

  /* State */
  const [activeTab, setActiveTab] = useState<"report"|"analysis"|"trace"|"log">("report");
  const [chatAgent, setChatAgent] = useState<AgentId|null>(null);
  const [openModule, setOpenModule] = useState<DemoModuleId|null>(null);
  const [panicDemoOpen, setPanicDemoOpen] = useState(false);

  /* Report form */
  const [rtype, setRtype] = useState("");
  const [rdesc, setRdesc] = useState("");
  const [rSector, setRSector] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const reportDictationBaseRef = useRef("");
  const handleReportTranscript = useCallback((transcript: string) => {
    const base = reportDictationBaseRef.current;
    setRdesc(base ? `${base} ${transcript}` : transcript);
  }, []);
  const prepareReportDictation = useCallback(() => {
    reportDictationBaseRef.current = rdesc.trim();
  }, [rdesc]);
  const {
    listening: reportListening,
    error: reportVoiceError,
    toggle: toggleReportDictation,
  } = useSpeechDictation(handleReportTranscript, prepareReportDictation);

  /* Current incident state */
  const [currentFolio, setCurrentFolio] = useState<FolioEntry|null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AnalysisResult|null>(null);
  const [traceLog, setTraceLog] = useState<TraceEntry[]>([]);

  /* Stats */
  const [stats, setStats] = useState({ units: null as number|null, reports: 0, critical: 0 });
  const [activity, setActivity] = useState<{time:string;color:string;msg:string}[]>([]);
  const [folioList, setFolioList] = useState<FolioEntry[]>([]);

  const analyzeIncident = useAnalyzeIncident();
  const createReport = useCreateReport();
  const { data: serverStats } = useGetStats({ query: { queryKey: getGetStatsQueryKey(), refetchInterval: 30000 } });

  const toggleVoice = useCallback(() => {
    if (voiceEnabled) {
      speechRequestRef.current += 1;
      stopAgentSpeech();
      setIsSpeaking(false);
    }
    setVoiceEnabled(!voiceEnabled);
  }, [voiceEnabled]);

  /* ── Clock ── */
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const p = (v:number) => String(v).padStart(2,"0");
      setClock(`${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`);
      const days = ["DOM","LUN","MAR","MIÉ","JUE","VIE","SÁB"];
      const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
      setClockDate(`${days[n.getDay()]} ${p(n.getDate())} ${months[n.getMonth()]} ${n.getFullYear()}`);
    };
    tick(); const id = setInterval(tick,1000); return ()=>clearInterval(id);
  },[]);
  useEffect(() => () => stopAgentSpeech(), []);

  /* ── Server stats ── */
  useEffect(()=>{
    if(!serverStats) return;
    setStats({ units:serverStats.activeUnits, reports:serverStats.totalReports, critical:serverStats.criticalAlerts });
    setActivity(serverStats.recentActivity?.map(a=>({time:a.time,color:a.color,msg:a.message})) ?? []);
  },[serverStats]);

  /* ── Map ── */
  useEffect(()=>{
    if(!mapRef.current||mapInst.current) return;
    const map=L.map(mapRef.current,{zoomControl:false}).setView([18.8405,-99.2328],12);
    mapInst.current=map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      maxZoom:19,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);



    map.on("click",event=>{
      const point={lat:event.latlng.lat,lng:event.latlng.lng};
      setSelectedCoords(point);
      setCoords(`Selección manual · ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`);
      selectedLocationMarkerRef.current?.remove();
      selectedLocationMarkerRef.current=L.circleMarker(event.latlng,{
        radius:7,color:"#00E5FF",fillColor:"#00E5FF",fillOpacity:.8,weight:2,
      }).addTo(map).bindPopup("Ubicación elegida manualmente para esta demostración").openPopup();
    });
    L.control.zoom({position:"bottomright"}).addTo(map);
    return ()=>{map.remove();mapInst.current=null;selectedLocationMarkerRef.current=null;};
  },[]);

  /* ── Speech ── */
  const speak=useCallback((text:string,agentId:AgentId,force=false)=>{
    setSpeechAgent(agentId);
    setSpeechText(text);
    if (!voiceEnabled && !force) {
      setIsSpeaking(false);
      return;
    }

    const requestId = ++speechRequestRef.current;
    const started = speakAsAgent(text, agentId, () => {
      if (requestId === speechRequestRef.current) setIsSpeaking(false);
    });
    setIsSpeaking(started);
    if (!started) {
      setVoiceEnabled(false);
      setSpeechText("La voz no está disponible en este navegador. Puedes continuar por escrito.");
    }
  },[voiceEnabled]);

  /* ── Send Report ── */
  const sendReport=useCallback(async()=>{
    if(reportListening){alert("Detén el dictado antes de registrar el reporte.");return;}
    if(!rtype){ alert("Selecciona el tipo de incidente."); return; }
    playNewReport();
    const folio=genFolio();
    const agentId:AgentId=TYPE_AGENT[rtype]||"santi";
    const ag=AGENTS[agentId];
    const sector=rSector.trim()||undefined;
    const descripcion=rdesc.trim()||undefined;
    const tm=nowStr();
    const entry:FolioEntry={
      folio,tipo:rtype,agente:agentId,sector:sector||"Sin especificar",horaEntrada:tm,
      ...(selectedCoords ? {lat:selectedCoords.lat,lng:selectedCoords.lng} : {}),
    };
    setCurrentFolio(entry);
    setTraceLog([
      {time:tm,event:`${folio} · Borrador de demostración creado`},
      {time:tm,event:"Resumen neutral pendiente; sin evaluación de riesgo ni despacho"},
    ]);
    setActiveTab("analysis");
    setAnalyzing(true);
    speak(`${ag.name} preparará un resumen de demostración para ${folio}. No se enviará una alerta ni se asignarán unidades.`,agentId);

    let analysis:AnalysisResult={
      agente:agentId,
      analisis:"No se pudo generar un resumen en este momento. La información permanece sin verificar.",
      nivelRiesgo:"NO EVALUADO",
      accionesRecomendadas:[
        "Esta es una demostración y no verifica los datos.",
        "Ante una emergencia real, contacta directamente al 911 o a las autoridades competentes.",
      ],
      unidadesRequeridas:0,
      protocolo:"No aplica — demostración",
      coordinacion:"No se inició coordinación ni despacho real.",
    };
    try {
      analysis=await analyzeIncident.mutateAsync({
        data:{tipo:rtype,descripcion,sector,folio,agente:agentId},
      });
    } catch {
      setTraceLog(previous=>[...previous,{time:nowStr(),event:"Resumen IA no disponible; se conserva como información no verificada"}]);
    }
    setAiAnalysis(analysis);

    try {
      await createReport.mutateAsync({data:{
        folio,
        tipo:rtype,
        descripcion,
        sector,
        ...(selectedCoords ? {latitud:selectedCoords.lat,longitud:selectedCoords.lng} : {}),
        agente:agentId,
        nivelRiesgo:"NO EVALUADO",
        analisis:analysis.analisis,
      }});
      setFolioList(previous=>[entry,...previous].slice(0,30));
      setStats(previous=>({...previous,reports:previous.reports+1}));
      setActivity(previous=>[{time:nowStr(),color:"#8AAAC8",msg:`${folio} · ${rtype} · guardado en demo; no verificado`},...previous].slice(0,20));
      setTraceLog(previous=>[...previous,{time:nowStr(),event:"Registro guardado en la base de datos de demostración"},{time:nowStr(),event:"Sin notificación, despacho ni enlace institucional"}]);
      speak(`El borrador ${folio} se guardó en la base de datos de demostración. No se envió a servicios oficiales.`,agentId);
      setRtype("");
      setRdesc("");
      setRSector("");
      setSelectedCoords(null);
      setCoords("Haz clic en el mapa para elegir coordenadas (opcional)");
      selectedLocationMarkerRef.current?.remove();
      selectedLocationMarkerRef.current=null;
    } catch {
      setTraceLog(previous=>[...previous,{time:nowStr(),event:"No se pudo guardar en la base de datos de demostración"}]);
      alert("No se pudo guardar el borrador en la demo. No se envió a autoridades ni servicios oficiales.");
    } finally {
      setAnalyzing(false);
    }
  },[rtype,rdesc,rSector,selectedCoords,reportListening,speak,analyzeIncident,createReport]);

  const agC = (id:AgentId)=>AGENTS[id].color;

  /* ── RENDER ── */
  return (
    <div onMouseDown={()=>{if(!audioInit.current){audioInit.current=true;}}}
      style={{fontFamily:"'Rajdhani',sans-serif",height:"100vh",overflow:"hidden",background:"#000509",color:"#C8D8E8",position:"relative"}}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap"/>
      <style>{`
        @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
        @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        @keyframes slide-in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
        @keyframes fade-up{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes scan-line{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes sec-pulse{0%,100%{box-shadow:0 0 12px rgba(255,23,68,.2)}50%{box-shadow:0 0 28px rgba(255,23,68,.4)}}
        .tab-btn{padding:0 14px;height:32px;background:none;border:none;cursor:pointer;font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:1px;transition:all .2s;white-space:nowrap;border-bottom:2px solid transparent}
        .tab-btn.active{color:#C8A84B;border-bottom-color:#C8A84B}
        .tab-btn:not(.active){color:#3A5A7A}
        .tab-btn:hover:not(.active){color:#6A90B8}
        .rselect,.rtexta{width:100%;background:rgba(0,0,0,.45);border:1px solid rgba(200,168,75,.1);border-radius:6px;padding:7px 10px;color:#C8D8E8;font-family:'Rajdhani',sans-serif;font-size:12px;outline:none;transition:border-color .2s}
        .rselect:focus,.rtexta:focus{border-color:rgba(200,168,75,.22)}
        .rselect option{background:#010D1A}
        .rtexta{resize:none}
        .rtexta::placeholder,.rselect option[value=""]{color:#3A5A7A}
        .agent-card{padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.06);cursor:pointer;transition:all .22s;display:flex;align-items:center;gap:9px;position:relative}
        .agent-card:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.12);box-shadow:0 4px 20px rgba(0,0,0,.4)}
        .folio-card{padding:8px 10px;border-radius:8px;border:1px solid rgba(200,168,75,.1);background:rgba(4,22,40,.5);margin-bottom:5px;cursor:pointer;transition:all .18s;animation:slide-in .3s ease}
        .folio-card:hover{border-color:rgba(200,168,75,.2);background:rgba(4,22,40,.7);transform:translateX(2px)}
        .mod-btn{width:100%;padding:0;background:transparent;border:none;cursor:pointer;text-align:left;margin-bottom:6px}
        .mod-inner{padding:9px 11px;border-radius:11px;border:1px solid rgba(255,255,255,.07);background:rgba(4,22,40,.4);display:flex;align-items:center;gap:10px;transition:all .22s;position:relative;overflow:hidden}
        .mod-inner::after{content:'';position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.04),transparent);transition:left .4s}
        .mod-btn:hover .mod-inner{transform:translateY(-2px) scale(1.01);border-color:rgba(200,168,75,.14)}
        .mod-btn:hover .mod-inner::after{left:100%}
        ::-webkit-scrollbar{width:2px;height:2px}
        ::-webkit-scrollbar-thumb{background:rgba(200,168,75,.1);border-radius:1px}
      `}</style>

      {/* Modals */}
      {showWelcome && (
        <div style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(0,5,9,.94)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <section role="dialog" aria-modal="true" aria-labelledby="santi-welcome-title"
            style={{width:"min(700px, 100%)",padding:"clamp(24px, 5vw, 52px)",borderRadius:20,border:"1px solid rgba(200,168,75,.35)",background:"radial-gradient(ellipse at top, rgba(200,168,75,.12), rgba(4,15,29,.98) 65%)",boxShadow:"0 24px 90px rgba(0,0,0,.55)",textAlign:"center"}}>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:"#C8A84B",letterSpacing:3,marginBottom:18}}>DEMOSTRACIÓN INTERACTIVA · DATOS SIMULADOS</div>
            <h1 id="santi-welcome-title" style={{fontFamily:"'Orbitron',monospace",fontSize:"clamp(28px, 5vw, 48px)",lineHeight:1.2,letterSpacing:2,margin:"0 0 14px",color:"#F1D47B"}}>Bienvenido a SANTI NEXUS</h1>
            <p style={{maxWidth:530,margin:"0 auto 12px",fontSize:16,lineHeight:1.6,color:"#C8D8E8"}}>
              SANTI y sus agentes son asistentes de inteligencia artificial. Esta demostración no está conectada a servicios oficiales, unidades ni alertas reales.
            </p>
            <p style={{maxWidth:530,margin:"0 auto 26px",fontSize:13,lineHeight:1.6,color:"#86A1B8"}}>
              Puedes escribir o dictar tu consulta. El micrófono solo se activa cuando lo pulsas; el navegador procesa la transcripción. No incluyas datos personales reales ni detalles de incidentes activos.
            </p>
            <div style={{display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap"}}>
              <button type="button" onClick={()=>{
                setShowWelcome(false);
                setVoiceEnabled(true);
                speak("Bienvenido a SANTI NEXUS. Esta es una demostración interactiva con asistentes de inteligencia artificial y datos simulados.", "santi", true);
              }}
                style={{padding:"12px 20px",borderRadius:9,border:"1px solid rgba(200,168,75,.65)",background:"rgba(200,168,75,.16)",color:"#F1D47B",fontFamily:"'Orbitron',monospace",fontSize:11,fontWeight:700,letterSpacing:1,cursor:"pointer"}}>
                ESCUCHAR BIENVENIDA
              </button>
              <button type="button" onClick={()=>{stopAgentSpeech();setVoiceEnabled(false);setShowWelcome(false);}}
                style={{padding:"12px 20px",borderRadius:9,border:"1px solid rgba(134,161,184,.35)",background:"rgba(8,23,39,.8)",color:"#C8D8E8",fontFamily:"'Orbitron',monospace",fontSize:11,fontWeight:700,letterSpacing:1,cursor:"pointer"}}>
                CONTINUAR EN SILENCIO
              </button>
            </div>
          </section>
        </div>
      )}
      {chatAgent && <AgentChatModal agentId={chatAgent} onClose={()=>setChatAgent(null)} speak={speak} voiceEnabled={voiceEnabled} onToggleVoice={toggleVoice}/>}
      {openModule && <DemoModuleDialog moduleId={openModule} onClose={()=>setOpenModule(null)}/>}
      {panicDemoOpen && <PanicDemoDialog onClose={()=>setPanicDemoOpen(false)}/>}

      <button type="button" onClick={()=>setPanicDemoOpen(true)} aria-label="Abrir simulación de Código Violeta"
        style={{position:"fixed",right:18,bottom:18,zIndex:1200,border:"1px solid rgba(233,30,140,.72)",borderRadius:999,padding:"12px 16px",background:"rgba(43,8,32,.96)",color:"#FFD6E5",fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,letterSpacing:.5,boxShadow:"0 4px 20px rgba(0,0,0,.45)",cursor:"pointer"}}>
        SIMULAR CÓDIGO VIOLETA
      </button>

      <div style={{height:"100vh",display:"flex",flexDirection:"column"}}>

        {/* ── HEADER ─────────────────────────────────────────── */}
        <header style={{height:52,flexShrink:0,display:"flex",alignItems:"center",padding:"0 18px",gap:16,background:"rgba(1,8,20,.97)",borderBottom:"1px solid rgba(200,168,75,.1)",position:"relative",zIndex:100}}>
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(200,168,75,.25) 30%,rgba(200,168,75,.25) 70%,transparent)"}}/>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:34,height:34,borderRadius:7,background:"linear-gradient(135deg,rgba(200,168,75,.15),rgba(10,79,212,.1))",border:"1px solid rgba(200,168,75,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🛡️</div>
            <div>
              <div style={{fontFamily:"'Orbitron',monospace",fontWeight:900,fontSize:13,letterSpacing:4,background:"linear-gradient(90deg,#C8A84B,#E2C46A)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>SANTI · C.M.O.</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2A4A6A",letterSpacing:1.5,marginTop:1}}>DEMO · SIN ENLACE INSTITUCIONAL</div>
            </div>
          </div>
          {/* Divider */}
          <div style={{width:1,height:30,background:"rgba(200,168,75,.1)",flexShrink:0}}/>
          {/* Language selector */}
          <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#7189A0"}}>IDIOMA</span>
            <select aria-label="Idioma de la demostración" title="Náhuatl y Mixteco requieren traducción revisada por hablantes"
              defaultValue="es" style={{maxWidth:150,background:"#071525",border:"1px solid rgba(200,168,75,.22)",borderRadius:6,padding:"5px 7px",color:"#C8D8E8",fontFamily:"'Share Tech Mono',monospace",fontSize:8}}>
              <option value="es">Español</option>
              <option value="nahuatl" disabled>Náhuatl · traducción pendiente</option>
              <option value="mixteco" disabled>Mixteco · traducción pendiente</option>
            </select>
          </div>
          {/* Connected-data summary */}
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            {[{v:stats.units??"—",l:"UNIDADES CONECTADAS",c:"#00E676"},{v:stats.reports,l:"REGISTROS EN BD",c:"#00E5FF"},{v:"—",l:"RIESGO",c:"#AAB8C2"}].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,color:s.c,lineHeight:1}}>{s.v}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:.5,marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
          {/* Spacer */}
          <div style={{flex:1}}/>
          <div style={{width:1,height:30,background:"rgba(200,168,75,.1)"}}/>
          {/* Clock */}
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,color:"#00E5FF",letterSpacing:2}}>{clock}</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2A4A6A",letterSpacing:.5}}>{clockDate}</div>
          </div>
          {/* Live indicator */}
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:999,background:"rgba(200,168,75,.08)",border:"1px solid rgba(200,168,75,.24)",flexShrink:0}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#C8A84B"}}/>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#C8A84B",letterSpacing:1}}>SIN SERVICIOS OFICIALES</span>
          </div>
        </header>

        {/* ── BODY ────────────────────────────────────────────── */}
        <div style={{flex:1,display:"grid",gridTemplateColumns:"256px 1fr 256px",overflow:"hidden"}}>

          {/* ── LEFT ──────────────────────────────────────────── */}
          <aside style={{display:"flex",flexDirection:"column",background:"rgba(1,8,20,.95)",borderRight:"1px solid rgba(200,168,75,.08)",overflow:"hidden"}}>
            {/* Agents */}
            <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(200,168,75,.08)",flexShrink:0}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:2,marginBottom:8,textTransform:"uppercase"}}>Agentes IA · Haz clic para consultar</div>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {(Object.entries(AGENTS) as [AgentId, typeof AGENTS[AgentId]][]).map(([id,ag])=>(
                  <div key={id} className="agent-card"
                    style={{background:`${ag.color}07`,borderColor:`${ag.color}25`}}
                    onClick={()=>{ playAgentActivated(id); setChatAgent(id); }}>
                    <div style={{width:32,height:32,borderRadius:"50%",background:`${ag.color}15`,border:`1.5px solid ${ag.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,animation:"breathe 3.5s ease-in-out infinite"}}>
                      {ag.emoji}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,color:ag.color,letterSpacing:.5}}>{ag.name}</div>
                      <div style={{fontSize:9,color:"#2A4A6A",fontFamily:"'Share Tech Mono',monospace",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ag.role}</div>
                    </div>
                    <div style={{width:5,height:5,borderRadius:"50%",background:"#00E676",boxShadow:"0 0 5px #00E676",flexShrink:0}}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Speech panel */}
            <div style={{margin:"8px 12px",padding:"9px 11px",background:"rgba(0,229,255,.04)",border:"1px solid rgba(0,229,255,.1)",borderRadius:9,flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:agC(speechAgent),boxShadow:`0 0 5px ${agC(speechAgent)}`,animation:isSpeaking?"pulse-dot .6s infinite":"none"}}/>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:agC(speechAgent),letterSpacing:1}}>{AGENTS[speechAgent].name}</span>
                {analyzing&&<span style={{marginLeft:"auto",fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#1E88E5",letterSpacing:.5}}>⚡ GEMINI PROCESANDO</span>}
              </div>
              <div style={{fontSize:11,lineHeight:1.6,color:"#8AAAC8"}}>{speechText.length>120?speechText.slice(0,120)+"...":speechText}</div>
              <button type="button" onClick={toggleVoice} aria-pressed={voiceEnabled}
                style={{marginTop:8,padding:"5px 8px",borderRadius:6,border:`1px solid ${voiceEnabled?"rgba(0,230,118,.45)":"rgba(200,168,75,.3)"}`,background:voiceEnabled?"rgba(0,230,118,.08)":"rgba(0,0,0,.22)",color:voiceEnabled?"#00E676":"#C8A84B",fontFamily:"'Share Tech Mono',monospace",fontSize:8,letterSpacing:.8,cursor:"pointer"}}>
                {voiceEnabled ? "RESPUESTAS POR VOZ ACTIVAS" : "ACTIVAR RESPUESTAS POR VOZ"}
              </button>
            </div>

            {/* Folio list */}
            <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
              <div style={{padding:"8px 12px 5px",borderTop:"1px solid rgba(200,168,75,.08)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:2}}>REGISTRO DE FOLIOS</span>
                <span style={{fontFamily:"'Orbitron',monospace",fontSize:10,color:"#C8A84B",fontWeight:700}}>{folioList.length}</span>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"0 12px 10px"}}>
                {folioList.map((f,i)=>{
                  const ag=AGENTS[f.agente];
                  return (
                    <div key={f.folio} className="folio-card" style={{animationDelay:`${i*.04}s`}}
                      onClick={()=>{ setCurrentFolio(f); setActiveTab("trace"); }}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                        <div style={{width:4,height:4,borderRadius:"50%",background:ag.color,flexShrink:0}}/>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,color:ag.color,letterSpacing:.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.folio}</div>
                      </div>
                      <div style={{fontSize:10,fontWeight:600,color:"#C8D8E8",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.tipo}</div>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2A4A6A",display:"flex",gap:8}}>
                        <span>{f.horaEntrada}</span><span>{f.sector}</span>
                      </div>
                    </div>
                  );
                })}
                {folioList.length===0&&<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#7189A0",textAlign:"center",marginTop:16,lineHeight:1.8}}>Sin borradores en esta sesión<br/>Los datos de la demo no son registros oficiales</div>}
              </div>
            </div>
          </aside>

          {/* ── CENTER ────────────────────────────────────────── */}
          <div style={{display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
            {/* Map area */}
            <div style={{flex:1,position:"relative",minHeight:0}}>
              {/* HUD */}
              <div style={{position:"absolute",top:10,left:10,display:"flex",gap:7,zIndex:400,pointerEvents:"all"}}>
                {["📍 TEMIXCO · MAPA BASE","CAPAS OPERATIVAS: NINGUNA","UBICACIÓN: SELECCIÓN MANUAL"].map(l=>(
                  <div key={l} style={{padding:"4px 10px",borderRadius:999,background:"rgba(1,8,20,.88)",border:"1px solid rgba(200,168,75,.1)",fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#6A90B8",backdropFilter:"blur(8px)",letterSpacing:.5}}>
                    {l}
                  </div>
                ))}
              </div>
              <div style={{position:"absolute",bottom:8,right:8,zIndex:400}}>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2A4A6A",background:"rgba(1,8,20,.85)",padding:"4px 9px",borderRadius:5,border:"1px solid rgba(200,168,75,.08)"}}>{coords}</div>
              </div>
              <div ref={mapRef} style={{width:"100%",height:"100%"}}/>
            </div>

            {/* ── BOTTOM TABS ─── */}
            <div style={{height:230,flexShrink:0,background:"rgba(1,8,20,.97)",borderTop:"1px solid rgba(200,168,75,.1)"}}>
              {/* Tab bar */}
              <div style={{height:34,display:"flex",alignItems:"center",borderBottom:"1px solid rgba(200,168,75,.08)",paddingLeft:4}}>
                {([["report","📋 REPORTE"],["analysis","⚡ ANÁLISIS IA"],["trace","🗺 TRAZABILIDAD"],["log","📡 BITÁCORA"]] as [typeof activeTab, string][]).map(([tab,label])=>(
                  <button key={tab} className={`tab-btn${activeTab===tab?" active":""}`} onClick={()=>setActiveTab(tab)}>{label}</button>
                ))}
              </div>
              {/* Tab content */}
              <div style={{height:196,overflow:"hidden"}}>
                {/* REPORTE */}
                {activeTab==="report"&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",height:"100%",gap:0}}>
                    <div style={{padding:"8px 12px",borderRight:"1px solid rgba(200,168,75,.08)",overflowY:"auto"}}>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        <select className="rselect" value={rtype} onChange={e=>setRtype(e.target.value)}>
                          <option value="">Tipo de incidente *</option>
                          {CRIME_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                        </select>
                        <input className="rselect" value={rSector} onChange={e=>setRSector(e.target.value)} maxLength={120} placeholder="Sector o referencia general (opcional)"/>
                        <div style={{fontSize:9,color:selectedCoords?"#77D7E7":"#7189A0",lineHeight:1.4}}>
                          {selectedCoords?"Ubicación seleccionada manualmente en el mapa.":"Sin ubicación. Puedes elegir un punto en el mapa; no se usa GPS."}
                        </div>
                        <div style={{display:"flex",gap:5,alignItems:"stretch"}}>
                          <textarea className="rtexta" rows={2} style={{fontSize:12,flex:1,minWidth:0}} placeholder="Descripción ficticia para la demostración..." value={rdesc} onChange={e=>setRdesc(e.target.value)}/>
                          <button type="button" onClick={toggleReportDictation} aria-label={reportListening?"Detener dictado del reporte":"Dictar descripción del reporte"} aria-pressed={reportListening}
                            style={{minWidth:58,padding:"6px",background:reportListening?"rgba(255,23,68,.12)":"rgba(0,229,255,.06)",border:`1px solid ${reportListening?"rgba(255,23,68,.55)":"rgba(0,229,255,.22)"}`,borderRadius:6,color:reportListening?"#FF6D6D":"#00E5FF",fontFamily:"'Share Tech Mono',monospace",fontSize:8,cursor:"pointer"}}>
                            {reportListening?"DETENER":"MIC"}
                          </button>
                        </div>
                        {reportVoiceError&&<div role="status" style={{fontSize:9,color:"#FF8C8C"}}>{reportVoiceError}</div>}
                        <div style={{fontSize:9,color:"#526A80",lineHeight:1.35}}>
                          Solo datos ficticios. Al registrar, el borrador y su descripción se guardan en la base de datos de esta demo y se envían a Gemini para un resumen neutral.
                        </div>
                        <button onClick={sendReport} disabled={analyzing||!rtype||reportListening}
                          style={{padding:"8px",background:analyzing?"rgba(200,168,75,.06)":"linear-gradient(135deg,#C8A84B,#8A6A20)",border:"none",borderRadius:6,cursor:analyzing||!rtype?"not-allowed":"pointer",fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,letterSpacing:1,color:analyzing?"#3A5A7A":"#000",transition:"all .2s",opacity:!rtype?.5:1}}>
                          {analyzing?"PROCESANDO DEMO...":"GUARDAR BORRADOR DEMO"}
                        </button>
                      </div>
                    </div>
                    <div style={{padding:"8px 12px",borderRight:"1px solid rgba(200,168,75,.08)"}}>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:7}}>LÍMITES DE LA DEMO</div>
                      <div style={{display:"flex",flexDirection:"column",gap:7,fontSize:10,color:"#8AAAC8",lineHeight:1.45}}>
                        <div>El tipo y la descripción son datos proporcionados por el usuario; no se verifican.</div>
                        <div>El resumen de IA no determina riesgo, culpabilidad ni acciones.</div>
                        <div>No se contactan autoridades ni se asignan unidades.</div>
                      </div>
                    </div>
                    <div style={{padding:"8px 12px",overflowY:"auto"}}>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:7}}>REGISTRO DE DEMOSTRACIÓN</div>
                      <div style={{fontSize:10,color:"#8AAAC8",lineHeight:1.6}}>
                        <div>ID: <span style={{color:"#C8A84B"}}>SANTI-DEMO-…</span></div>
                        <div>Conexión institucional: ninguna</div>
                        <div>Unidades: no conectadas</div>
                        <div>Evaluación de riesgo: no disponible</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ANÁLISIS */}
                {activeTab==="analysis"&&(
                  <div style={{padding:"10px 14px",overflowY:"auto",height:"100%"}}>
                    {aiAnalysis&&currentFolio?(
                      <div style={{animation:"fade-up .4s ease"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,paddingBottom:8,borderBottom:"1px solid rgba(200,168,75,.1)"}}>
                          <div style={{fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,color:"#C8A84B",letterSpacing:.5}}>{currentFolio.folio}</div>
                          <div style={{padding:"2px 8px",borderRadius:999,background:"rgba(200,168,75,.08)",border:"1px solid rgba(200,168,75,.2)",fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,color:"#C8A84B"}}>
                            DEMO · NO VERIFICADO
                          </div>
                          <div style={{marginLeft:"auto",fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:`${AGENTS[currentFolio.agente].color}`,letterSpacing:.5}}>{AGENTS[currentFolio.agente].emoji} {AGENTS[currentFolio.agente].name}</div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:10}}>
                          <div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:5}}>RESUMEN DE IA · NO VERIFICADO</div>
                            <div style={{fontSize:11,color:"#8AAAC8",lineHeight:1.65,marginBottom:8}}>{aiAnalysis.analisis}</div>
                            <div style={{fontSize:9,color:"#7189A0",lineHeight:1.5}}>El resumen no verifica hechos, evalúa riesgo ni activa servicios. Si existe una emergencia real, contacta directamente al 911.</div>
                          </div>
                          <div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:5}}>NOTAS DE SEGURIDAD</div>
                            {(aiAnalysis.accionesRecomendadas||[]).map((a:string,i:number)=>(
                              <div key={i} style={{display:"flex",gap:7,marginBottom:5,padding:"5px 8px",background:"rgba(0,0,0,.35)",border:"1px solid rgba(200,168,75,.1)",borderRadius:6}}>
                                <span style={{fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,color:"#C8A84B",flexShrink:0}}>0{i+1}</span>
                                <span style={{fontSize:10,fontWeight:600,lineHeight:1.4}}>{a}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ):(
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#2A4A6A",textAlign:"center",marginTop:30,lineHeight:1.8}}>
                        El análisis ejecutivo Gemini aparecerá aquí<br/>después de registrar un reporte
                      </div>
                    )}
                  </div>
                )}

                {/* TRAZABILIDAD */}
                {activeTab==="trace"&&(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",height:"100%",gap:0}}>
                    <div style={{padding:"8px 14px",borderRight:"1px solid rgba(200,168,75,.08)",overflowY:"auto"}}>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:7}}>ACTIVIDAD DEL BORRADOR</div>
                      {currentFolio&&traceLog.length ? (
                        <div style={{display:"flex",flexDirection:"column",gap:4}}>
                          {traceLog.map((t,i)=>(
                            <div key={i} style={{display:"flex",gap:8,padding:"4px 0",borderBottom:"1px solid rgba(200,168,75,.06)"}}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#7189A0",flexShrink:0}}>{t.time}</span>
                              <span style={{fontSize:10,color:"#8AAAC8",lineHeight:1.4}}>{t.event}</span>
                            </div>
                          ))}
                        </div>
                      ):<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#7189A0",marginTop:12}}>No hay actividad de demo para mostrar.</div>}
                    </div>
                    <div style={{padding:"8px 14px",overflowY:"auto"}}>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:7}}>DATOS DEL BORRADOR</div>
                      {currentFolio?(
                        <div style={{display:"flex",flexDirection:"column",gap:5}}>
                          {[
                            ["ID",currentFolio.folio],
                            ["Categoría",currentFolio.tipo],
                            ["Sector",currentFolio.sector],
                            ["Hora",currentFolio.horaEntrada],
                            ["Ubicación",currentFolio.lat!==undefined&&currentFolio.lng!==undefined?`${currentFolio.lat.toFixed(5)}, ${currentFolio.lng.toFixed(5)}`:"No proporcionada"],
                            ["Resumen",AGENTS[currentFolio.agente].name],
                            ["Estado","No verificado · Demo"],
                          ].map(([l,v])=>(
                            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 8px",background:"rgba(0,0,0,.3)",borderRadius:5,border:"1px solid rgba(200,168,75,.08)"}}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2A4A6A"}}>{l}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#8AAAC8",fontWeight:600}}>{v}</span>
                            </div>
                          ))}
                        </div>
                      ):<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#7189A0",marginTop:12}}>Registra un borrador para ver sus datos.</div>}
                    </div>
                  </div>
                )}

                {/* BITÁCORA */}
                {activeTab==="log"&&(
                  <div style={{padding:"8px 14px",overflowY:"auto",height:"100%"}}>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {activity.length===0?(
                        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#7189A0",textAlign:"center",marginTop:18,lineHeight:1.7}}>
                          Sin actividad registrada en la base de datos de esta demo.
                        </div>
                      ):activity.map((a,i)=>(
                        <div key={i} style={{display:"flex",gap:8,padding:"4px 0",borderBottom:"1px solid rgba(200,168,75,.05)",animation:"slide-in .2s ease"}}>
                          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2A4A6A",flexShrink:0,minWidth:32}}>{a.time}</span>
                          <div style={{width:5,height:5,borderRadius:"50%",flexShrink:0,marginTop:5,background:a.color,boxShadow:`0 0 4px ${a.color}`}}/>
                          <span style={{fontSize:11,color:"#6A90B8",lineHeight:1.4}}>{a.msg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT ─────────────────────────────────────────── */}
          <aside style={{display:"flex",flexDirection:"column",background:"rgba(1,8,20,.95)",borderLeft:"1px solid rgba(200,168,75,.08)",overflowY:"auto",scrollbarWidth:"thin"}}>
            {/* Stats */}
            <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(200,168,75,.08)",display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,flexShrink:0}}>
              {[{v:stats.units??"—",l:"UNIDADES CONECTADAS",c:"#00E676"},{v:stats.reports,l:"REGISTROS EN BD",c:"#00E5FF"},{v:"—",l:"RIESGO",c:"#AAB8C2"},{v:"—",l:"RESPUESTA",c:"#C8A84B"}].map(s=>(
                <div key={s.l} style={{background:"rgba(4,22,40,.5)",border:"1px solid rgba(200,168,75,.1)",borderRadius:9,padding:"9px 10px",textAlign:"center",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:s.c,opacity:.35}}/>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:.5,marginTop:4,lineHeight:1.2}}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Local demo modules */}
            <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(200,168,75,.08)",flexShrink:0}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:2,marginBottom:8}}>FORMULARIOS LOCALES · DEMO</div>
              {(Object.entries(DEMO_MODULES) as [DemoModuleId,typeof DEMO_MODULES[DemoModuleId]][]).map(([id,m])=>(
                <button key={id} className="mod-btn" onClick={()=>setOpenModule(id)}>
                  <div className="mod-inner">
                    <div style={{width:36,height:36,borderRadius:8,background:`${m.color}12`,border:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{m.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,color:m.color,letterSpacing:.3,marginBottom:2}}>{m.title}</div>
                      <div style={{fontSize:9,color:"#2A4A6A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.category}</div>
                    </div>
                    <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,padding:"1px 5px",borderRadius:999,background:"rgba(200,168,75,.08)",color:"#C8A84B",border:"1px solid rgba(200,168,75,.18)",flexShrink:0}}>DEMO</span>
                  </div>
                </button>
              ))}
            </div>

            <div style={{margin:"10px 12px",padding:10,background:"rgba(0,0,0,.22)",border:"1px solid rgba(200,168,75,.1)",borderRadius:8,color:"#7189A0",fontSize:10,lineHeight:1.5}}>
              No hay consultas de placas, unidades, geolocalización automática ni servicios oficiales conectados.
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
