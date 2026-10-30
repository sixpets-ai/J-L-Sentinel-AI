import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getGetStatsQueryKey, useGetStats, useAnalyzeIncident, useCreateReport } from "@workspace/api-client-react";
import {
  PATROL_UNITS_CONFIG, patrolCarSvg, getUnitForIncidentType, getFolioDependency,
  type PatrolUnit,
} from "@/lib/patrol-icons";
import { playNewReport, playProximityAlert, playCriticalAlert, playAgentActivated, playUnitArrival } from "@/lib/audio";
import {
  speakAsAgent, stopAgentSpeech,
} from "@/lib/agent-speech";
import { useSpeechDictation } from "@/hooks/use-speech-dictation";

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;

/* ─── CONSTANTS ────────────────────────────────────────────── */

const QUADRANTS = ["NORTE", "SUR", "ORIENTE", "PONIENTE", "CENTRO", "BUGAMBILIAS", "EL MIRADOR", "ACATLIPA", "BLVD. JUÁREZ"];

const AGENTS = {
  santi:    { name: "SANTI",       emoji: "👮", color: "#C8A84B", role: "Coordinación · Asistente IA", lang: "Español · Náhuatl" },
  emiliano: { name: "EMILIANO",    emoji: "⚔️",  color: "#1E88E5", role: "Operaciones · Simulación", lang: "Español" },
  maxi:     { name: "MAXIMILIANO", emoji: "🔎", color: "#9C27B0", role: "Análisis general · Demo", lang: "Español · Inglés" },
  santiago: { name: "SANTIAGO",    emoji: "🏫", color: "#00897B", role: "Prevención general · Demo", lang: "Español · Náhuatl" },
  katering: { name: "KATERING",    emoji: "🦋", color: "#E91E8C", role: "Apoyo preventivo · Género", lang: "Español · Náhuatl" },
} as const;
type AgentId = keyof typeof AGENTS;

const CRIME_TYPES = [
  "Robo / Asalto", "Violencia familiar", "Narcomenudeo CJNG",
  "Extorsión / Gota a Gota", "Disparos activos", "Desaparición",
  "Vehículo sospechoso", "Seguridad escolar", "Homicidio / Ejecución",
];

const RISK_COLOR: Record<string, string> = {
  CRÍTICO: "#FF1744", ALTO: "#FF6D00", MEDIO: "#FFD166", BAJO: "#00E676",
};

const TYPE_AGENT: Record<string, AgentId> = {
  "Violencia familiar": "katering", "Seguridad escolar": "santiago",
  "Narcomenudeo CJNG": "maxi", "Disparos activos": "emiliano",
  "Homicidio / Ejecución": "emiliano", "Extorsión / Gota a Gota": "maxi",
  "Desaparición": "santi",
};

let _folioN = 47 + Math.floor(Math.random() * 5);
function genFolio(tipo: string) {
  _folioN++;
  const dep = getFolioDependency(tipo);
  return `${dep}-TMX-2026-${String(_folioN).padStart(4, "0")}`;
}

function nowStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
}

interface FolioEntry {
  folio: string; tipo: string; agente: AgentId;
  denunciante: string; cuadrante: string; horaEntrada: string;
  lat: number; lng: number; status: string; unitAsigned: string;
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

/* ─── MODAL: TACTICAL MODULE ─────────────────────────────────── */
interface TacModule { ico:string; ttl:string; sub:string; agent:AgentId; steps:{n:string;t:string;d:string}[]; alert:string }
const MODULES: Record<string, TacModule> = {
  mujer: { ico:"🦋", ttl:"CÓDIGO VIOLETA", sub:"PROTOCOLO AVG · KATERING", agent:"katering", steps:[
    {n:"01",t:"Lugar seguro",d:"Sal del domicilio. Busca vecinos, tiendas o espacios públicos concurridos."},
    {n:"02",t:"Activa el reporte",d:"KATERING coordina con IMM Temixco, DIF Municipal y unidades especializadas de género."},
    {n:"03",t:"Documenta",d:"Fotos de lesiones, capturas de mensajes, testigos. Sin riesgo personal."},
    {n:"04",t:"Orden de protección",d:"Derecho a orden de restricción inmediata. Asesoría jurídica municipal gratuita."},
    {n:"05",t:"Líneas de apoyo",d:"INMUJERES 800-108-4053 · IMM Temixco · DIF Morelos. Identidad protegida."},
  ], alert:"<strong>2024:</strong> 10 carpetas de feminicidio en Temixco. AVG activa 10+ años." },
  extorsion: { ico:"🔒", ttl:"ANTIEXTORSIÓN", sub:"GOTA A GOTA · COBRO DE PISO · MAXIMILIANO", agent:"maxi", steps:[
    {n:"01",t:"No pagues más",d:"El pago alimenta el ciclo. Documenta: números, montos, fechas y descripción."},
    {n:"02",t:"Sin confrontación",d:"Maximiliano opera desde inteligencia. No amenaces ni acuses directamente."},
    {n:"03",t:"Evidencia digital",d:"Pantallazos de mensajes, números de teléfono, horarios y puntos de cobro."},
    {n:"04",t:"Reporte anónimo",d:"Tu identidad NO se vincula al folio. Va directo a FGR y unidad especializada."},
    {n:"05",t:"Riesgo físico",d:"Si hay amenaza corporal inmediata: 911 + Reporte Directo al Secretario en SANTI."},
  ], alert:"<strong>2025:</strong> Temixco entre los 6 municipios con mayor Gota a Gota en Morelos. 24 detenidos." },
  escuela: { ico:"🏫", ttl:"ESCUELA SEGURA", sub:"PERÍMETROS · CUADRANTES · SANTIAGO", agent:"santiago", steps:[
    {n:"01",t:"Identifica el riesgo",d:"Persona sospechosa en perímetro, sustancias, violencia entre alumnos."},
    {n:"02",t:"Reporta con seguridad",d:"Santiago notifica al director y a la unidad del sector simultáneamente."},
    {n:"03",t:"Sin intervención física",d:"Documenta desde distancia. Tu seguridad es prioridad."},
    {n:"04",t:"Horarios críticos",d:"Patrullaje reforzado: entrada 7-8:30 AM y salida 1-2:30 PM."},
    {n:"05",t:"Evidencia",d:"Folio activa intervención de Trabajo Social municipal. Video como prueba."},
  ], alert:"<strong>2025:</strong> Venta de sustancias y autolesiones documentadas en zona sur de Temixco." },
  desaparicion: { ico:"🔍", ttl:"DESAPARICIÓN", sub:"PROTOCOLO ALBA · AVG · BUSCADORAS", agent:"santi", steps:[
    {n:"01",t:"Actúa YA",d:"No esperes 24 horas. Cada hora es crítica. Repórtalo ahora."},
    {n:"02",t:"Datos esenciales",d:"Nombre, edad, foto reciente, ropa, última ubicación conocida."},
    {n:"03",t:"Búsqueda coordinada",d:"DIF, SIPINNA, FGE y colectivos de madres buscadoras: notificados en 3 min."},
    {n:"04",t:"Ficha automática",d:"El sistema genera ficha con foto para difusión inmediata."},
    {n:"05",t:"Mantén comunicación",d:"Teléfono disponible. Coordinación por folio en SANTI."},
  ], alert:"<strong>13/03/2026:</strong> Alex Uriel Bello, 15 años, Cuentepec. Con SANTI: coordinación en menos de 3 min." },
  narco: { ico:"🎯", ttl:"NARCOMENUDEO · CJNG", sub:"CÉLULA EL TRÉBOL · MAXIMILIANO", agent:"maxi", steps:[
    {n:"01",t:"Sin exposición",d:"Reporta desde lugar seguro. No fotografíes puntos activos de venta."},
    {n:"02",t:"Información táctica",d:"Dirección exacta, horarios, vehículos y personas si es seguro."},
    {n:"03",t:"Anonimato total",d:"Identidad NO vinculada al folio. Reporte cifrado va a FGR."},
    {n:"04",t:"Sin redes sociales",d:"No publiques en Facebook/WhatsApp/TikTok. Puede alertar a las células."},
    {n:"05",t:"Cámaras WiFi ilegales",d:"Cámaras no institucionales en postes = red CJNG. Repórtalo."},
  ], alert:"<strong>Confirmado SSPC 2025:</strong> Célula 'El Trébol' en Bugambilias y El Mirador. 93 cámaras WiFi ilegales desmanteladas." },
};

function ModuleModal({ moduleId, onClose, speak }: { moduleId: string; onClose: () => void; speak: (t:string,a:AgentId)=>void }) {
  const m = MODULES[moduleId];
  const ag = AGENTS[m.agent];
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{position:"fixed",inset:0,zIndex:1500,background:"rgba(0,0,0,.8)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:460,maxHeight:"80vh",overflowY:"auto",background:"#040F1D",border:`1px solid ${ag.color}30`,borderRadius:16,padding:22,boxShadow:`0 0 40px ${ag.color}15`}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,paddingBottom:14,borderBottom:`1px solid ${ag.color}15`}}>
          <span style={{fontSize:28}}>{m.ico}</span>
          <div><div style={{fontFamily:"'Orbitron',monospace",fontSize:15,fontWeight:700,letterSpacing:.5}}>{m.ttl}</div>
          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A",marginTop:3,letterSpacing:1}}>{m.sub}</div></div>
          <button onClick={onClose} style={{marginLeft:"auto",background:"none",border:"none",color:"#3A5A7A",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        {m.steps.map((s,i)=>(
          <div key={i} style={{display:"flex",gap:10,marginBottom:8,padding:"10px 11px",background:"rgba(0,0,0,.35)",border:`1px solid ${ag.color}15`,borderRadius:10}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:900,color:ag.color,flexShrink:0}}>{s.n}</div>
            <div><div style={{fontWeight:700,fontSize:13,marginBottom:2}}>{s.t}</div><div style={{fontSize:11,color:"#3A5A7A",lineHeight:1.5}}>{s.d}</div></div>
          </div>
        ))}
        <div style={{background:"rgba(255,23,68,.05)",border:"1px solid rgba(255,23,68,.18)",borderRadius:10,padding:"10px 12px",marginTop:10,fontSize:11,color:"#6A90B8",lineHeight:1.6}} dangerouslySetInnerHTML={{__html:`<strong style="color:#FF1744">⚠️</strong> ${m.alert}`}}/>
        <button onClick={()=>speak(`Protocolo ${m.ttl} activado. ${m.steps[0].t}: ${m.steps[0].d}`,m.agent)} style={{width:"100%",marginTop:12,padding:"10px",background:`${ag.color}12`,border:`1px solid ${ag.color}40`,borderRadius:8,color:ag.color,fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,letterSpacing:1,cursor:"pointer"}}>
          🔊 ACTIVAR PROTOCOLO DE VOZ
        </button>
      </div>
    </div>
  );
}

/* ─── MAIN COMPONENT ────────────────────────────────────────── */
export default function SantiCommand() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInst = useRef<L.Map|null>(null);
  const patrolsRef = useRef<Map<string, { marker: L.Marker; unit: PatrolUnit }>>(new Map());
  const incidentMarkersRef = useRef<L.Circle[]>([]);
  const audioInit = useRef(false);

  const [clock, setClock] = useState("");
  const [clockDate, setClockDate] = useState("");
  const [coords, setCoords] = useState("LAT: 18.8405 · LNG: -99.2328");

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
  const [openModule, setOpenModule] = useState<string|null>(null);

  /* Report form */
  const [rtype, setRtype] = useState("");
  const [rdesc, setRdesc] = useState("");
  const [rDenunciante, setRDenunciante] = useState("");
  const [rContacto, setRContacto] = useState("");
  const [rCuadrante, setRCuadrante] = useState("");
  const [rReportantes, setRReportantes] = useState("1");
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
  const [assignedUnit, setAssignedUnit] = useState<string>("");
  const [unitStatus, setUnitStatus] = useState<string>("");

  /* Stats */
  const [stats, setStats] = useState({ units: 12, reports: 47, critical: 3 });
  const [activity, setActivity] = useState([
    { time:"14:23", color:"#00E676", msg:"U-03 · Patrullaje Bugambilias · Sin novedad" },
    { time:"14:21", color:"#FF6D00", msg:"MUN-TMX-2026-0041 · Robo transeúnte · Blvd. Juárez" },
    { time:"14:18", color:"#FF1744", msg:"ALERTA · Vehículo reportado · Carr. 95 · U-07 notificada" },
    { time:"14:15", color:"#00E5FF", msg:"C2-04 · Placa ABC-1234 · Periférico Norte · IA activa" },
    { time:"14:10", color:"#00E676", msg:"MUN-TMX-2026-0040 · Caso cerrado · U-01 disponible" },
  ]);
  const [folioList, setFolioList] = useState<FolioEntry[]>([]);

  /* Vehicle scan */
  const [vehPlate, setVehPlate] = useState("");
  const [vehResult, setVehResult] = useState<{plate:string;hits:number;tipo:string;loc:string}|null>(null);

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
      setClockDate(`${days[n.getDay()]} ${p(n.getDate())} ${months[n.getMonth()]} 2026`);
    };
    tick(); const id = setInterval(tick,1000); return ()=>clearInterval(id);
  },[]);
  useEffect(() => () => stopAgentSpeech(), []);

  /* ── Server stats ── */
  useEffect(()=>{
    if(!serverStats) return;
    setStats({ units:serverStats.activeUnits, reports:serverStats.totalReports, critical:serverStats.criticalAlerts });
    if(serverStats.recentActivity?.length){
      setActivity(prev=>[...serverStats.recentActivity.map(a=>({time:a.time,color:a.color,msg:a.message})),...prev].slice(0,20));
    }
  },[serverStats]);

  /* ── Auto activity feed ── */
  useEffect(()=>{
    const feeds=[
      {c:"#00E676",m:"U-01 · Patrullaje Periférico Norte · Sin novedad"},
      {c:"#00E5FF",m:"C2-04 · Vehículo en tránsito registrado · Carr. 95D"},
      {c:"#FF6D00",m:"Ciudadano · El Mirador · Reporte en proceso · SANTI IA"},
      {c:"#00E676",m:"U-11 · GN · Bugambilias · Ronda completada · Sin novedad"},
      {c:"#FF1744",m:"ALERTA CLUSTER · 3 reportes · Acatlipa · Últimas 2h"},
      {c:"#9C27B0",m:"Maximiliano · Análisis C2 · Patrón detectado · Sector Sur"},
      {c:"#00897B",m:"Santiago · Secundaria #3 · Perímetro OK · Horario escolar"},
    ];
    let idx=0;
    const id=setInterval(()=>{
      const f=feeds[idx++%feeds.length];
      setActivity(prev=>[{time:nowStr(),color:f.c,msg:f.m},...prev].slice(0,20));
    },12000);
    return ()=>clearInterval(id);
  },[]);

  /* ── Map ── */
  useEffect(()=>{
    if(!mapRef.current||mapInst.current) return;
    const map=L.map(mapRef.current,{zoomControl:false,attributionControl:false}).setView([18.8405,-99.2328],14);
    mapInst.current=map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:19,subdomains:"abcd"}).addTo(map);

    // Heat layer
    const heatData=[[18.848,-99.235,.98],[18.849,-99.234,.9],[18.842,-99.228,.95],[18.843,-99.229,.88],
      [18.836,-99.241,.92],[18.835,-99.240,.85],[18.855,-99.230,.78],[18.845,-99.248,.7],[18.838,-99.238,.6]];
    // @ts-expect-error leaflet.heat CDN
    if(typeof L.heatLayer==="function") L.heatLayer(heatData,{radius:28,blur:20,maxZoom:16,gradient:{0.2:"#001F3F",0.5:"#0A4FD4",0.75:"#FF6D00",1:"#FF1744"}}).addTo(map);

    // Risk zones
    [[18.848,-99.235,200,"#FF1744","BUGAMBILIAS · CJNG EL TRÉBOL"],
     [18.842,-99.228,170,"#FF1744","EL MIRADOR · NARCOMENUDEO"],
     [18.836,-99.241,180,"#FF6D00","ACATLIPA · DISPAROS 2025"],
     [18.845,-99.248,145,"#FF8C00","LOMAS AHUATLÁN · EXTORSIÓN"],
     [18.832,-99.225,120,"#1565C0","ZONA ESCOLAR SUR"]].forEach(([la,ln,r,c,n])=>{
      L.circle([la as number,ln as number],{color:c as string,fillColor:c as string,fillOpacity:.06,opacity:.2,weight:1,radius:r as number}).addTo(map)
        .bindPopup(`<b style="color:${c}">${n}</b>`);
      L.marker([la as number,ln as number],{icon:L.divIcon({html:`<div style="font-family:'Share Tech Mono',monospace;font-size:8px;color:${c}80;letter-spacing:.8px;white-space:nowrap;text-shadow:0 0 8px rgba(0,0,0,.9)">${n}</div>`,className:"",iconSize:[180,12]})}).addTo(map);
    });

    // Patrol units
    PATROL_UNITS_CONFIG.forEach(cfg=>{
      const unit:PatrolUnit={...cfg,dlat:(Math.random()-.5)*.00018,dlng:(Math.random()-.5)*.00022};
      const iconHtml=`<div style="filter:drop-shadow(0 0 5px ${unit.glowColor})">${patrolCarSvg(unit)}</div>`;
      const icon=L.divIcon({html:iconHtml,className:"",iconSize:[30,50],iconAnchor:[15,50]});
      const marker=L.marker([unit.lat,unit.lng],{icon}).addTo(map);
      marker.bindPopup(`<b style="color:${unit.glowColor}">${unit.id}</b> · ${unit.label}<br>Sector: ${unit.sector}<br>Estado: <span style="color:${unit.glowColor}">${unit.status}</span>`);
      patrolsRef.current.set(unit.id,{marker,unit});
    });

    // Road labels
    [[18.843,-99.258,"BLVD. JUÁREZ"],[18.830,-99.233,"CARR. FED. 95"],[18.857,-99.244,"PERIFÉRICO NORTE"]].forEach(([la,ln,t])=>{
      L.marker([la as number,ln as number],{icon:L.divIcon({html:`<div style="font-family:'Share Tech Mono',monospace;font-size:8px;color:rgba(200,168,75,.35);letter-spacing:.8px;white-space:nowrap">${t}</div>`,className:"",iconSize:[160,12]})}).addTo(map);
    });

    map.on("click",e=>setCoords(`LAT: ${e.latlng.lat.toFixed(4)} · LNG: ${e.latlng.lng.toFixed(4)}`));
    map.on("mousemove",e=>setCoords(`LAT: ${e.latlng.lat.toFixed(4)} · LNG: ${e.latlng.lng.toFixed(4)}`));

    // Patrol movement loop
    const moveId=setInterval(()=>{
      patrolsRef.current.forEach(({marker,unit})=>{
        if(unit.status==="En escena"||unit.status==="Llamado activo") return;
        unit.lat+=unit.dlat; unit.lng+=unit.dlng;
        if(unit.lat>18.870||unit.lat<18.820) unit.dlat*=-1;
        if(unit.lng>-99.200||unit.lng<-99.280) unit.dlng*=-1;
        marker.setLatLng([unit.lat,unit.lng]);
      });
    },1800);
    return ()=>clearInterval(moveId);
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

  /* ── Animate unit to incident ── */
  const animateUnitTo=useCallback((unitId:string, targetLat:number, targetLng:number, folio:string)=>{
    const entry=patrolsRef.current.get(unitId);
    if(!entry||!mapInst.current) return;
    const {marker,unit}=entry;
    unit.status="Llamado activo";
    const startLat=unit.lat, startLng=unit.lng;
    const steps=20, interval=600;
    let step=0;
    const tid=setInterval(()=>{
      step++;
      const t=step/steps;
      unit.lat=startLat+(targetLat-startLat)*t;
      unit.lng=startLng+(targetLng-startLng)*t;
      marker.setLatLng([unit.lat,unit.lng]);
      if(step>=steps){
        clearInterval(tid);
        unit.status="En escena";
        setUnitStatus("EN ESCENA");
        const tm=nowStr();
        setTraceLog(p=>[...p,{time:tm,event:`${unitId} · EN ESCENA · ${folio}`}]);
        setActivity(p=>[{time:tm,color:"#00E676",msg:`${unitId} (${unit.label}) · EN ESCENA · ${folio}`},...p].slice(0,20));
        playUnitArrival();
        playProximityAlert();
        speak(`Unidad ${unitId} ha llegado al lugar del evento. Folio ${folio}. Unidad en escena.`,"santi");
        mapInst.current?.setView([targetLat,targetLng],15,{animate:true});
        // Mark available after 15 min (simulated as 90s)
        setTimeout(()=>{unit.status="Disponible"; setUnitStatus("CASO CERRADO");
          const t2=nowStr();
          setTraceLog(p=>[...p,{time:t2,event:`${unitId} · CASO CERRADO · ${folio}`}]);
          setActivity(p=>[{time:t2,color:"#00E676",msg:`${unitId} · CASO CERRADO · ${folio} · Unidad disponible`},...p].slice(0,20));
        },90000);
      }
    },interval);
  },[speak]);

  /* ── Add incident on map ── */
  const addIncidentOnMap=useCallback((lat:number,lng:number,folio:string,tipo:string,color:string)=>{
    if(!mapInst.current) return;
    const c=L.circle([lat,lng],{color,fillColor:color,fillOpacity:.15,opacity:.55,weight:2,radius:120}).addTo(mapInst.current);
    c.bindPopup(`<b style="color:${color}">${folio}</b><br>${tipo}<br><small>${nowStr()}</small>`).openPopup();
    incidentMarkersRef.current.push(c);
    mapInst.current.setView([lat,lng],15,{animate:true});
  },[]);

  /* ── Send Report ── */
  const sendReport=useCallback(async()=>{
    if(reportListening){alert("Detén el dictado antes de registrar el reporte.");return;}
    if(!rtype){ alert("Selecciona el tipo de incidente."); return; }
    if(!audioInit.current){ audioInit.current=true; }
    playNewReport();
    const folio=genFolio(rtype);
    const agentId:AgentId=TYPE_AGENT[rtype]||"santi";
    const ag=AGENTS[agentId];
    const colorMap:Record<string,string>={"Robo / Asalto":"#FF6D00","Violencia familiar":"#C13AFF","Narcomenudeo CJNG":"#FF1744","Extorsión / Gota a Gota":"#FF6D00","Disparos activos":"#FF1744","Desaparición":"#9C27B0","Vehículo sospechoso":"#00E5FF","Seguridad escolar":"#00E5FF","Homicidio / Ejecución":"#FF1744"};
    const color=colorMap[rtype]||"#C8A84B";
    const lat=18.8405+(Math.random()-.5)*.018;
    const lng=-99.2328+(Math.random()-.5)*.022;
    const tm=nowStr();
    const unitId=getUnitForIncidentType(rtype);
    const entry:FolioEntry={folio,tipo:rtype,agente:agentId,denunciante:rDenunciante||"S/D",cuadrante:rCuadrante||"CENTRO",horaEntrada:tm,lat,lng,status:"En proceso",unitAsigned:unitId};
    setCurrentFolio(entry);
    setAssignedUnit(unitId);
    setUnitStatus("NOTIFICADA");
    setTraceLog([
      {time:tm,event:`${folio} · FOLIO GENERADO · ${ag.name} asignado`},
      {time:tm,event:`${unitId} · NOTIFICADA · En camino`},
    ]);
    setFolioList(p=>[entry,...p].slice(0,30));
    setStats(p=>({...p,reports:p.reports+1}));
    addIncidentOnMap(lat,lng,folio,rtype,color);
    setActivity(p=>[{time:tm,color,msg:`${folio} · ${rtype} · ${ag.name} · ${unitId} despachada`},...p].slice(0,20));
    setActiveTab("analysis");
    setAnalyzing(true);
    speak(`${ag.name} procesando folio ${folio}. ${rtype} en ${rCuadrante||"sector centro"}. Análisis neuronal Gemini activado.`,agentId);

    try {
      const analysis=await analyzeIncident.mutateAsync({ data:{tipo:rtype,descripcion:rdesc||undefined,sector:rCuadrante||"Temixco",folio,agente:agentId} });
      setAiAnalysis(analysis);
      createReport.mutate({data:{folio,tipo:rtype,descripcion:rdesc||undefined,sector:rCuadrante||"Temixco",latitud:lat,longitud:lng,agente:agentId,nivelRiesgo:analysis.nivelRiesgo,analisis:analysis.analisis}});
      if(analysis.nivelRiesgo==="CRÍTICO"){ playCriticalAlert(); setStats(p=>({...p,critical:p.critical+1})); }
      speak(analysis.analisis,agentId);
      setActivity(p=>[{time:nowStr(),color:RISK_COLOR[analysis.nivelRiesgo]||"#C8A84B",msg:`GEMINI IA · ${folio} · Riesgo: ${analysis.nivelRiesgo} · ${analysis.protocolo}`},...p].slice(0,20));
      // Animate unit
      setTimeout(()=>{ animateUnitTo(unitId,lat,lng,folio); setUnitStatus("EN CAMINO"); setTraceLog(p=>[...p,{time:nowStr(),event:`${unitId} · EN CAMINO`}]); },3000);
    } catch(e) {
      speak(`Folio ${folio} registrado. ${ag.name} coordinando respuesta táctica. Unidad ${unitId} en camino.`,agentId);
      setTimeout(()=>animateUnitTo(unitId,lat,lng,folio),3000);
    } finally { setAnalyzing(false); }
    setRtype(""); setRdesc(""); setRDenunciante(""); setRContacto(""); setRCuadrante(""); setRReportantes("1");
  },[rtype,rdesc,rDenunciante,rContacto,rCuadrante,rReportantes,reportListening,speak,addIncidentOnMap,animateUnitTo,analyzeIncident,createReport]);

  /* ── Secretary Alert ── */
  const repSec=useCallback(()=>{
    playCriticalAlert();
    const folio=genFolio("Disparos activos")+"-CRÍTICO";
    const tm=nowStr();
    setActivity(p=>[{time:tm,color:"#FF1744",msg:`🚨 ${folio} · ALERTA MÁXIMA · Secretario notificado · TODAS LAS UNIDADES`},...p].slice(0,20));
    setStats(p=>({...p,critical:p.critical+1}));
    speak("ALERTA MÁXIMA activada. Canal directo con el Secretario de Seguridad abierto. Todas las unidades en estado de alerta máxima. Protocolo de respuesta extraordinaria activado en todos los sectores de Temixco.","santi");
  },[speak]);

  /* ── Vehicle Scan ── */
  const scanVeh=useCallback(()=>{
    if(!vehPlate.trim()){ alert("Ingresa una placa."); return; }
    const pl=vehPlate.trim().toUpperCase();
    const hits=Math.floor(Math.random()*6)+1;
    const tipos=["Extorsión · Gota a Gota","Narcomenudeo","Robo a transeúnte","Cobro de piso","Portación de arma"];
    const zonas=["Blvd. Juárez esq. Carr. 95","Periférico Norte","Col. Bugambilias","Acatlipa Centro"];
    const tipo=tipos[Math.floor(Math.random()*tipos.length)];
    const zona=zonas[Math.floor(Math.random()*zonas.length)];
    setVehResult({plate:pl,hits,tipo,loc:zona});
    const tm=nowStr();
    setActivity(p=>[{time:tm,color:"#00E5FF",msg:`C2 · Placa ${pl} · ${hits} reportes · ${zona} · IA mejorada`},...p].slice(0,20));
    if(mapInst.current){
      const la=18.8405+(Math.random()-.5)*.018, ln=-99.2328+(Math.random()-.5)*.022;
      L.marker([la,ln],{icon:L.divIcon({html:`<div style="background:#FF1744;color:#fff;font-family:'Share Tech Mono',monospace;font-size:9px;padding:3px 9px;border-radius:4px;white-space:nowrap;box-shadow:0 0 14px #FF1744;letter-spacing:1px">${pl}</div>`,className:"",iconSize:[100,20]})}).addTo(mapInst.current).bindPopup(`<b>${pl}</b><br>${tipo}<br>${hits} reportes C2`).openPopup();
      mapInst.current.setView([la,ln],15,{animate:true});
    }
    speak(`Sistema C2 identificó vehículo placa ${pl} con ${hits} reportes previos. Categoría: ${tipo}. Última ubicación: ${zona}. Unidad 07 notificada.`,"maxi");
  },[vehPlate,speak]);

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
      {openModule && <ModuleModal moduleId={openModule} onClose={()=>setOpenModule(null)} speak={speak}/>}

      <div style={{height:"100vh",display:"flex",flexDirection:"column"}}>

        {/* ── HEADER ─────────────────────────────────────────── */}
        <header style={{height:52,flexShrink:0,display:"flex",alignItems:"center",padding:"0 18px",gap:16,background:"rgba(1,8,20,.97)",borderBottom:"1px solid rgba(200,168,75,.1)",position:"relative",zIndex:100}}>
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(200,168,75,.25) 30%,rgba(200,168,75,.25) 70%,transparent)"}}/>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:34,height:34,borderRadius:7,background:"linear-gradient(135deg,rgba(200,168,75,.15),rgba(10,79,212,.1))",border:"1px solid rgba(200,168,75,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🛡️</div>
            <div>
              <div style={{fontFamily:"'Orbitron',monospace",fontWeight:900,fontSize:13,letterSpacing:4,background:"linear-gradient(90deg,#C8A84B,#E2C46A)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>SANTI · C.M.O.</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2A4A6A",letterSpacing:1.5,marginTop:1}}>SECRETARÍA SEG. PÚBLICA · TEMIXCO, MORELOS</div>
            </div>
          </div>
          {/* Divider */}
          <div style={{width:1,height:30,background:"rgba(200,168,75,.1)",flexShrink:0}}/>
          {/* Stats */}
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            {[{v:stats.units,l:"UNIDADES",c:"#00E676"},{v:stats.reports,l:"REPORTES",c:"#00E5FF"},{v:stats.critical,l:"ALERTAS",c:"#FF1744"},{v:"8m",l:"T.RESPUESTA",c:"#C8A84B"}].map(s=>(
              <div key={s.l} style={{textAlign:"center"}}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,color:s.c,lineHeight:1}}>{s.v}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:.5,marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
          {/* Spacer */}
          <div style={{flex:1}}/>
          {/* Secretary phone */}
          <div style={{display:"flex",alignItems:"center",gap:7,padding:"5px 12px",borderRadius:999,background:"rgba(255,23,68,.06)",border:"1px solid rgba(255,23,68,.18)"}}>
            <span style={{fontSize:13}}>📞</span>
            <div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#FF1744",letterSpacing:.5}}>SECRETARIO SEG. PÚB.</div>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,color:"#FF1744",letterSpacing:1}}>564-096-7363</div>
            </div>
          </div>
          <div style={{width:1,height:30,background:"rgba(200,168,75,.1)"}}/>
          {/* Clock */}
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,color:"#00E5FF",letterSpacing:2}}>{clock}</div>
            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2A4A6A",letterSpacing:.5}}>{clockDate}</div>
          </div>
          {/* Live indicator */}
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:999,background:"rgba(200,168,75,.08)",border:"1px solid rgba(200,168,75,.24)",flexShrink:0}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#C8A84B"}}/>
            <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#C8A84B",letterSpacing:1}}>SIMULACIÓN</span>
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
                        <span>{f.horaEntrada}</span><span>{f.cuadrante}</span><span style={{color:ag.color}}>{f.unitAsigned}</span>
                      </div>
                    </div>
                  );
                })}
                {folioList.length===0&&<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#2A4A6A",textAlign:"center",marginTop:16,lineHeight:1.8}}>Sin folios registrados<br/>Envía un reporte para comenzar</div>}
              </div>
            </div>
          </aside>

          {/* ── CENTER ────────────────────────────────────────── */}
          <div style={{display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
            {/* Map area */}
            <div style={{flex:1,position:"relative",minHeight:0}}>
              {/* HUD */}
              <div style={{position:"absolute",top:10,left:10,display:"flex",gap:7,zIndex:400,pointerEvents:"all"}}>
                {["📍 TEMIXCO","🔥 ZONAS CALOR","🚨 ALERTAS","🚔 PATRULLAS"].map(l=>(
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
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                          <input className="rselect" value={rDenunciante} onChange={e=>setRDenunciante(e.target.value)} placeholder="Denunciante (S/D)"/>
                          <input className="rselect" value={rContacto} onChange={e=>setRContacto(e.target.value)} placeholder="Teléfono (S/D)"/>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                          <select className="rselect" value={rCuadrante} onChange={e=>setRCuadrante(e.target.value)}>
                            <option value="">Cuadrante...</option>
                            {QUADRANTS.map(q=><option key={q} value={q}>{q}</option>)}
                          </select>
                          <input className="rselect" type="number" min="1" value={rReportantes} onChange={e=>setRReportantes(e.target.value)} placeholder="# Reportantes"/>
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
                          Demo: usa datos ficticios. Al registrar, el texto se guarda y se procesa con IA.
                        </div>
                        <button onClick={sendReport} disabled={analyzing||!rtype||reportListening}
                          style={{padding:"8px",background:analyzing?"rgba(200,168,75,.06)":"linear-gradient(135deg,#C8A84B,#8A6A20)",border:"none",borderRadius:6,cursor:analyzing||!rtype?"not-allowed":"pointer",fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,letterSpacing:1,color:analyzing?"#3A5A7A":"#000",transition:"all .2s",opacity:!rtype?.5:1}}>
                          {analyzing?"⚡ ANALIZANDO CON GEMINI IA...":"⚡ REGISTRAR REPORTE"}
                        </button>
                      </div>
                    </div>
                    <div style={{padding:"8px 12px",borderRight:"1px solid rgba(200,168,75,.08)"}}>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:7}}>PROTOCOLO SEGÚN TIPO</div>
                      {rtype ? (
                        <div style={{display:"flex",flexDirection:"column",gap:5}}>
                          {(["Mantén la calma","Aléjate del área peligrosa","Espera en lugar seguro","El folio te identifica como denunciante","La unidad asignada está en camino"] as string[]).map((s,i)=>(
                            <div key={i} style={{display:"flex",gap:7,padding:"5px 8px",background:"rgba(0,0,0,.3)",border:"1px solid rgba(200,168,75,.1)",borderRadius:6}}>
                              <span style={{fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,color:"#C8A84B",flexShrink:0}}>0{i+1}</span>
                              <span style={{fontSize:10,fontWeight:600}}>{s}</span>
                            </div>
                          ))}
                        </div>
                      ):<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#2A4A6A",marginTop:8}}>Selecciona un tipo de incidente</div>}
                    </div>
                    <div style={{padding:"8px 12px",overflowY:"auto"}}>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:7}}>FOLIO POR DEPENDENCIA</div>
                      <div style={{fontSize:10,color:"#6A90B8",lineHeight:1.8,fontFamily:"'Share Tech Mono',monospace"}}>
                        <div><span style={{color:"#FF1744"}}>FGR-TMX-2026-XXXX</span> — Narco · Extorsión</div>
                        <div><span style={{color:"#FF6D00"}}>SSPC-TMX-2026-XXXX</span> — Disparos · Homicidio</div>
                        <div><span style={{color:"#9C27B0"}}>FGE-TMX-2026-XXXX</span> — Desaparición</div>
                        <div><span style={{color:"#1E88E5"}}>MUN-TMX-2026-XXXX</span> — Municipal · Común</div>
                      </div>
                      <div style={{marginTop:10,fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1}}>UNIDAD POR TIPO</div>
                      <div style={{marginTop:5,fontSize:10,color:"#6A90B8",lineHeight:1.8,fontFamily:"'Share Tech Mono',monospace"}}>
                        {rtype&&<div style={{color:"#00E676",animation:"fade-up .3s ease"}}>→ {getUnitForIncidentType(rtype)} asignada a este tipo</div>}
                        <div><span style={{color:"#1565C0"}}>U-01/03</span> — Municipal</div>
                        <div><span style={{color:"#C8A84B"}}>U-07</span> — SSPC Morelos</div>
                        <div><span style={{color:"#2E7D32"}}>U-11</span> — G. Nacional</div>
                        <div><span style={{color:"#0D47A1"}}>U-14</span> — Marina</div>
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
                          <div style={{padding:"2px 8px",borderRadius:999,background:`${RISK_COLOR[aiAnalysis.nivelRiesgo]||"#C8A84B"}18`,border:`1px solid ${RISK_COLOR[aiAnalysis.nivelRiesgo]||"#C8A84B"}40`,fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,color:RISK_COLOR[aiAnalysis.nivelRiesgo]||"#C8A84B"}}>
                            RIESGO: {aiAnalysis.nivelRiesgo}
                          </div>
                          <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#6A90B8"}}>{aiAnalysis.protocolo}</div>
                          <div style={{marginLeft:"auto",fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:`${AGENTS[currentFolio.agente].color}`,letterSpacing:.5}}>{AGENTS[currentFolio.agente].emoji} {AGENTS[currentFolio.agente].name}</div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:10}}>
                          <div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:5}}>ANÁLISIS EJECUTIVO · GEMINI 2.5</div>
                            <div style={{fontSize:11,color:"#8AAAC8",lineHeight:1.65,marginBottom:8}}>{aiAnalysis.analisis}</div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:5}}>COORDINACIÓN INSTITUCIONAL</div>
                            <div style={{fontSize:10,color:"#6A90B8",lineHeight:1.5}}>{aiAnalysis.coordinacion}</div>
                          </div>
                          <div>
                            <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:5}}>ACCIONES RECOMENDADAS</div>
                            {(aiAnalysis.accionesRecomendadas||[]).map((a:string,i:number)=>(
                              <div key={i} style={{display:"flex",gap:7,marginBottom:5,padding:"5px 8px",background:"rgba(0,0,0,.35)",border:"1px solid rgba(200,168,75,.1)",borderRadius:6}}>
                                <span style={{fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,color:"#C8A84B",flexShrink:0}}>0{i+1}</span>
                                <span style={{fontSize:10,fontWeight:600,lineHeight:1.4}}>{a}</span>
                              </div>
                            ))}
                            <div style={{marginTop:6,fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A"}}>
                              Unidades requeridas: <span style={{color:"#00E5FF",fontWeight:700}}>{aiAnalysis.unidadesRequeridas}</span>
                            </div>
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
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:7}}>TRAZABILIDAD DE UNIDAD</div>
                      {currentFolio?(
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9,padding:"6px 9px",background:"rgba(0,0,0,.35)",borderRadius:7,border:"1px solid rgba(200,168,75,.12)"}}>
                            <div style={{fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,color:PATROL_UNITS_CONFIG.find(u=>u.id===assignedUnit)?.glowColor||"#C8A84B"}}>{assignedUnit}</div>
                            <div style={{fontSize:10,color:"#6A90B8"}}>{PATROL_UNITS_CONFIG.find(u=>u.id===assignedUnit)?.label||"UNIDAD"}</div>
                            <div style={{marginLeft:"auto",padding:"2px 7px",borderRadius:999,background:unitStatus==="EN ESCENA"?"rgba(0,230,118,.12)":unitStatus==="EN CAMINO"?"rgba(0,229,255,.1)":"rgba(200,168,75,.08)",border:`1px solid ${unitStatus==="EN ESCENA"?"rgba(0,230,118,.3)":unitStatus==="EN CAMINO"?"rgba(0,229,255,.25)":"rgba(200,168,75,.2)"}`,fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:unitStatus==="EN ESCENA"?"#00E676":unitStatus==="EN CAMINO"?"#00E5FF":"#C8A84B",letterSpacing:.5}}>
                              {unitStatus||"NOTIFICADA"}
                            </div>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {traceLog.map((t,i)=>(
                              <div key={i} style={{display:"flex",gap:8,padding:"4px 0",borderBottom:"1px solid rgba(200,168,75,.06)",animation:"slide-in .2s ease"}}>
                                <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2A4A6A",flexShrink:0}}>{t.time}</span>
                                <div style={{width:1,background:"rgba(200,168,75,.15)",flexShrink:0}}/>
                                <span style={{fontSize:10,color:"#8AAAC8",lineHeight:1.4}}>{t.event}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ):<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#2A4A6A",marginTop:12}}>Sin incidente activo</div>}
                    </div>
                    <div style={{padding:"8px 14px",overflowY:"auto"}}>
                      <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:7}}>DATOS DEL REPORTE</div>
                      {currentFolio?(
                        <div style={{display:"flex",flexDirection:"column",gap:5}}>
                          {[["Folio",currentFolio.folio],["Tipo",currentFolio.tipo],["Denunciante",currentFolio.denunciante],["Cuadrante",currentFolio.cuadrante],["Hora entrada",currentFolio.horaEntrada],["Agente IA",AGENTS[currentFolio.agente].name],["Unidad",currentFolio.unitAsigned]].map(([l,v])=>(
                            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 8px",background:"rgba(0,0,0,.3)",borderRadius:5,border:"1px solid rgba(200,168,75,.08)"}}>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2A4A6A"}}>{l}</span>
                              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#8AAAC8",fontWeight:600}}>{v}</span>
                            </div>
                          ))}
                        </div>
                      ):<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#2A4A6A",marginTop:12}}>Registra un reporte para ver la trazabilidad</div>}
                    </div>
                  </div>
                )}

                {/* BITÁCORA */}
                {activeTab==="log"&&(
                  <div style={{padding:"8px 14px",overflowY:"auto",height:"100%"}}>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {activity.map((a,i)=>(
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
              {[{v:stats.units,l:"UNIDADES",c:"#00E676"},{v:stats.critical,l:"ALERTAS CRÍTICAS",c:"#FF1744"},{v:stats.reports,l:"REPORTES HOY",c:"#00E5FF"},{v:"89%",l:"ATENCIÓN",c:"#C8A84B"}].map(s=>(
                <div key={s.l} style={{background:"rgba(4,22,40,.5)",border:"1px solid rgba(200,168,75,.1)",borderRadius:9,padding:"9px 10px",textAlign:"center",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:s.c,opacity:.35}}/>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:.5,marginTop:4,lineHeight:1.2}}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Tactical modules */}
            <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(200,168,75,.08)",flexShrink:0}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:2,marginBottom:8}}>MÓDULOS TÁCTICOS</div>
              {[
                {id:"mujer",  c:"#E91E8C",ico:"🦋",t:"CÓDIGO VIOLETA",  d:"Protocolo AVG · Género",       badge:"FEDERAL"},
                {id:"extorsion",c:"#FF6D00",ico:"🔒",t:"ANTIEXTORSIÓN",  d:"Gota a Gota · Cobro de piso",  badge:"FEDERAL"},
                {id:"escuela",c:"#00E5FF",ico:"🏫",t:"ESCUELA SEGURA",  d:"Perímetros · Cuadrantes",       badge:"COMÚN"},
                {id:"desaparicion",c:"#00897B",ico:"🔍",t:"DESAPARICIÓN",d:"Protocolo Alba · AVG",          badge:"FEDERAL"},
                {id:"narco",  c:"#C8A84B",ico:"🎯",t:"NARCOMENUDEO",   d:"CJNG · Denuncia anónima",       badge:"FEDERAL"},
              ].map(m=>(
                <button key={m.id} className="mod-btn" onClick={()=>setOpenModule(m.id)}>
                  <div className="mod-inner">
                    <div style={{width:36,height:36,borderRadius:8,background:`${m.c}12`,border:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{m.ico}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,color:m.c,letterSpacing:.3,marginBottom:2}}>{m.t}</div>
                      <div style={{fontSize:9,color:"#2A4A6A",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.d}</div>
                    </div>
                    <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,padding:"1px 5px",borderRadius:999,background:m.badge==="FEDERAL"?"rgba(255,23,68,.1)":"rgba(200,168,75,.08)",color:m.badge==="FEDERAL"?"#FF1744":"#C8A84B",border:`1px solid ${m.badge==="FEDERAL"?"rgba(255,23,68,.22)":"rgba(200,168,75,.18)"}`,flexShrink:0}}>{m.badge}</span>
                  </div>
                </button>
              ))}
              {/* Secretary button */}
              <button onClick={repSec} style={{width:"100%",padding:"11px 12px",border:"1px solid rgba(255,23,68,.35)",borderRadius:10,cursor:"pointer",background:"linear-gradient(135deg,rgba(255,23,68,.12),rgba(120,0,20,.08))",fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:900,letterSpacing:1.5,color:"#FF6D6D",position:"relative",overflow:"hidden",animation:"sec-pulse 2.5s ease-in-out infinite",transition:"all .25s",marginBottom:8}}>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(255,23,68,.07),transparent)",animation:"scan-line 2.5s ease-in-out infinite"}}/>
                🚨 ALERTA SECRETARIO
              </button>
            </div>

            {/* Vehicle scan */}
            <div style={{padding:"10px 12px"}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:2,marginBottom:7}}>RECONOCIMIENTO VEHICULAR · C2</div>
              <div style={{display:"flex",gap:5,marginBottom:6}}>
                <input value={vehPlate} onChange={e=>setVehPlate(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&scanVeh()}
                  placeholder="PLACA..."
                  style={{flex:1,background:"rgba(0,0,0,.4)",border:"1px solid rgba(0,229,255,.15)",borderRadius:6,padding:"6px 10px",color:"#C8D8E8",fontFamily:"'Share Tech Mono',monospace",fontSize:11,letterSpacing:2,textTransform:"uppercase",outline:"none"}}/>
                <button onClick={scanVeh} style={{padding:"6px 10px",background:"rgba(0,229,255,.07)",border:"1px solid rgba(0,229,255,.22)",borderRadius:6,color:"#00E5FF",fontFamily:"'Orbitron',monospace",fontSize:8,fontWeight:700,cursor:"pointer",letterSpacing:.5}}>
                  SCAN
                </button>
              </div>
              {vehResult&&(
                <div style={{padding:"9px 10px",background:"rgba(255,23,68,.05)",border:"1px solid rgba(255,23,68,.18)",borderRadius:8,animation:"fade-up .3s ease"}}>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:900,color:"#FF1744",letterSpacing:3,marginBottom:4}}>{vehResult.plate}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#6A90B8",lineHeight:1.6}}>
                    <div>Reportes: <span style={{color:"#FF1744",fontWeight:700}}>{vehResult.hits}</span></div>
                    <div>Tipo: {vehResult.tipo}</div>
                    <div>Últ. ubicación: {vehResult.loc}</div>
                    <div style={{color:"#00E5FF",marginTop:3}}>C2 VERIFICADO · IA MEJORADA · 94%</div>
                  </div>
                </div>
              )}
              {/* Unit legend */}
              <div style={{marginTop:10,borderTop:"1px solid rgba(200,168,75,.08)",paddingTop:8}}>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2A4A6A",letterSpacing:1.5,marginBottom:6}}>LEYENDA DE UNIDADES</div>
                {PATROL_UNITS_CONFIG.map(u=>(
                  <div key={u.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                    <div style={{width:8,height:8,borderRadius:2,background:u.color,boxShadow:`0 0 4px ${u.glowColor}`,flexShrink:0}}/>
                    <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#C8A84B",minWidth:28}}>{u.id}</span>
                    <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2A4A6A"}}>{u.label}</span>
                    <span style={{marginLeft:"auto",fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:u.status==="En escena"?"#00E676":u.status==="Llamado activo"?"#FF1744":"#3A5A7A"}}>{u.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
