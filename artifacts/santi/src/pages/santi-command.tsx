import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useGetStats, useAnalyzeIncident, useCreateReport } from "@workspace/api-client-react";

// Fix leaflet default icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface FolioItem {
  folio: string;
  tipo: string;
  cls: string;
  time: string;
}

interface ActivityItem {
  time: string;
  color: string;
  message: string;
}

interface AnalysisResult {
  folio: string;
  agente: string;
  analisis: string;
  nivelRiesgo: string;
  accionesRecomendadas: string[];
  unidadesRequeridas: number;
  protocolo: string;
  coordinacion: string;
}

interface ProtoStep {
  t: string;
}

const AGENTS = {
  santi: { name: "SANTI", color: "#C8A84B", emoji: "🤖", role: "Coordinador Principal · IA Táctica" },
  emiliano: { name: "EMILIANO", color: "#1568FF", emoji: "👮", role: "Mando táctico" },
  maxi: { name: "MAXIMILIANO", color: "#C13AFF", emoji: "🔎", role: "Inteligencia" },
  santiago: { name: "SANTIAGO", color: "#00BFA5", emoji: "🏫", role: "Escuela Segura" },
  katering: { name: "KATERING", color: "#FF4FA3", emoji: "🦋", role: "Código Violeta" },
};

const TYPE_TO_AGENT: Record<string, keyof typeof AGENTS> = {
  "Violencia familiar": "katering",
  "Seguridad escolar": "santiago",
  "Narcomenudeo CJNG": "maxi",
  "Disparos activos": "emiliano",
  "Homicidio / Ejecución": "emiliano",
  "Extorsión / Gota a Gota": "maxi",
};

const TYPE_COLORS: Record<string, string> = {
  "Robo / Asalto": "#FF6D00",
  "Violencia familiar": "#C13AFF",
  "Narcomenudeo CJNG": "#FF1744",
  "Extorsión / Gota a Gota": "#FF6D00",
  "Disparos activos": "#FF1744",
  "Desaparición": "#C13AFF",
  "Vehículo sospechoso": "#00E5FF",
  "Seguridad escolar": "#00E5FF",
  "Homicidio / Ejecución": "#FF1744",
};

const TYPE_CLASS: Record<string, string> = {
  "Robo / Asalto": "orange",
  "Violencia familiar": "violet",
  "Narcomenudeo CJNG": "red",
  "Extorsión / Gota a Gota": "orange",
  "Disparos activos": "red",
  "Desaparición": "violet",
  "Vehículo sospechoso": "cyan",
  "Seguridad escolar": "cyan",
  "Homicidio / Ejecución": "red",
};

const PROTOS: Record<string, string[]> = {
  "Robo / Asalto": ["Aléjate del lugar de inmediato", "No muestres objetos de valor", "Espera en lugar seguro", "Llama al 911 si hay riesgo activo", "El folio es tu comprobante legal"],
  "Narcomenudeo CJNG": ["No confrontes — reporta desde distancia", "FGR notificada automáticamente", "No publiques en redes sociales", "Documenta vehículos si es seguro", "El folio activa seguimiento judicial"],
  "Violencia familiar": ["Sal del domicilio si puedes", "Busca vecino o lugar público", "Unidad especializada despachada", "IMM Temixco notificado", "Tienes derecho a orden de protección"],
  "Extorsión / Gota a Gota": ["No pagues más cuotas", "Registra números y montos", "Tu identidad queda protegida", "FGR activada de inmediato", "Evita confrontar a los cobradores"],
  "Desaparición": ["Actúa en las primeras horas", "Ten foto reciente y descripción", "DIF + FGE + colectivos notificados", "Mantén el teléfono disponible", "Protocolo Alba o AVG activado"],
};

const MODAL_DATA: Record<string, {ico: string; ttl: string; sub: string; agent: keyof typeof AGENTS; steps: {n: string; t: string; d: string}[]; alert: string}> = {
  mujer: {
    ico: "🦋", ttl: "CÓDIGO VIOLETA", sub: "PROTOCOLO AVG · KATERING ACTIVA · TEMIXCO", agent: "katering",
    steps: [
      { n: "01", t: "Busca un lugar seguro", d: "Sal del domicilio si puedes. Busca vecinos, tienda o lugar con personas." },
      { n: "02", t: "Activa el reporte", d: "KATERING coordina con IMM Temixco, DIF y unidades especializadas de género." },
      { n: "03", t: "Documenta si es seguro", d: "Fotos de lesiones, capturas de mensajes amenazantes, nombres de testigos." },
      { n: "04", t: "Orden de protección", d: "Tienes derecho a orden de restricción inmediata. El área jurídica municipal es gratuita." },
      { n: "05", t: "Líneas de apoyo", d: "INMUJERES: 800-108-4053 · IMM Temixco · DIF Morelos. Identidad 100% protegida." },
    ],
    alert: "<strong>Dato real Temixco 2024:</strong> 10 carpetas de feminicidio. Alerta de Violencia de Género activa hace 10+ años.",
  },
  extorsion: {
    ico: "🔒", ttl: "ANTIEXTORSIÓN", sub: "GOTA A GOTA · COBRO DE PISO · MAXIMILIANO ACTIVO", agent: "maxi",
    steps: [
      { n: "01", t: "No pagues más cuotas", d: "El pago refuerza el ciclo. Documenta: números, montos, fechas, descripción física." },
      { n: "02", t: "No confrontes", d: "No amenaces ni hagas acusaciones directas. Maximiliano trabaja desde inteligencia." },
      { n: "03", t: "Captura evidencia digital", d: "Pantallazos de mensajes amenazantes, números de teléfono, horarios y puntos de cobro." },
      { n: "04", t: "Reporte anónimo total", d: "Tu identidad no se vincula al folio. Reporte va directo a FGR y unidad especializada." },
      { n: "05", t: "Amenaza física activa", d: "Si hay riesgo corporal inmediato: 911 + Reporte Directo al Secretario en SANTI." },
    ],
    alert: "<strong>Dato real:</strong> Temixco entre los 6 municipios con mayor Gota a Gota en Morelos (SSPC 2025). 24 detenidos oct 2024-jul 2025.",
  },
  escuela: {
    ico: "🏫", ttl: "ESCUELA SEGURA", sub: "PERÍMETROS ESCOLARES · SANTIAGO ACTIVO", agent: "santiago",
    steps: [
      { n: "01", t: "Identifica el riesgo", d: "Persona sospechosa en perímetro, venta de sustancias, violencia entre alumnos." },
      { n: "02", t: "Reporta desde lugar seguro", d: "Santiago notifica al director del plantel y a la unidad del sector simultáneamente." },
      { n: "03", t: "No intervengas físicamente", d: "Documenta desde distancia. No confrontes. Tu seguridad primero." },
      { n: "04", t: "Horarios críticos", d: "Patrullaje reforzado: entrada (7-8:30am) y salida (1-2:30pm)." },
      { n: "05", t: "Bullying con violencia", d: "Video o foto como evidencia. El folio activa intervención de Trabajo Social municipal." },
    ],
    alert: "<strong>Dato real:</strong> Venta de sustancias y retos de autolesión documentados en planteles de zona sur de Temixco 2025.",
  },
  desaparicion: {
    ico: "🔍", ttl: "PROTOCOLO DESAPARICIÓN", sub: "PROTOCOLO ALBA · AVG · BUSCADORAS ACTIVADAS", agent: "santi",
    steps: [
      { n: "01", t: "Actúa en las primeras horas", d: "No esperes 24 horas. Repórtalo ahora. Cada hora es crítica." },
      { n: "02", t: "Datos esenciales", d: "Nombre completo, edad, foto reciente, ropa que llevaba, última ubicación." },
      { n: "03", t: "Búsqueda coordinada inmediata", d: "DIF, SIPINNA, FGE, colectivos de madres buscadoras: notificados en 3 minutos." },
      { n: "04", t: "Ficha de búsqueda automática", d: "El sistema genera ficha con foto para difusión inmediata en el municipio." },
      { n: "05", t: "Mantén comunicación", d: "Deja el teléfono disponible. La coordinación fluye por el folio registrado en SANTI." },
    ],
    alert: "<strong>Caso real — Cuentepec, Temixco, 13/03/2026:</strong> Alex Uriel Bello, 15 años. Con SANTI: coordinación en menos de 3 minutos.",
  },
  narco: {
    ico: "🎯", ttl: "NARCOMENUDEO · CJNG", sub: "CÉLULA EL TRÉBOL · MAXIMILIANO INTELIGENCIA", agent: "maxi",
    steps: [
      { n: "01", t: "No te expongas", d: "Reporta desde lugar seguro. No tomes fotos en puntos de venta activos." },
      { n: "02", t: "Información táctica", d: "Dirección exacta, horarios, descripción de personas y vehículos si es seguro." },
      { n: "03", t: "Anonimato total garantizado", d: "Tu identidad no se vincula al folio. Reporte cifrado va directo a FGR." },
      { n: "04", t: "Evita redes sociales", d: "No publiques en Facebook, WhatsApp o TikTok. Puede alertar a las células." },
      { n: "05", t: "Cámaras WiFi ilegales", d: "Si ves cámaras no institucionales en postes, repórtalo. CJNG usa WiFi ilegal en Temixco." },
    ],
    alert: "<strong>Confirmado SSPC Morelos 2025:</strong> Célula 'El Trébol' (símbolo de gallo) del CJNG activa en Bugambilias y El Mirador. 93 cámaras WiFi ilegales desmanteladas.",
  },
};

let folioCounter = 40 + Math.floor(Math.random() * 10);
function genFolio() {
  folioCounter++;
  return `TX-INC-2026-${String(folioCounter).padStart(4, "0")}`;
}

export default function SantiCommand() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const patrulsRef = useRef<{ mk: L.Marker; lat: number; lng: number; dlat: number; dlng: number }[]>([]);
  const [clock, setClock] = useState("");
  const [clockDate, setClockDate] = useState("");
  const [coords, setCoords] = useState("LAT: 18.8405 · LNG: -99.2328");
  const [speechText, setSpeechText] = useState("Sistema inicializado. Centro de Mando Operativo activo. Todas las unidades en línea.");
  const [speechAgent, setSpeechAgent] = useState<keyof typeof AGENTS>("santi");
  const [folioItems, setFolioItems] = useState<FolioItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([
    { time: "14:23", color: "#00E676", message: "U-03 · Patrullaje Bugambilias · Sin novedad" },
    { time: "14:21", color: "#FF6D00", message: "TX-INC-2026-0041 · Robo transeúnte · Blvd. Juárez" },
    { time: "14:18", color: "#FF1744", message: "ALERTA · Vehículo reportado · Carr. 95 · U-07 notificada" },
    { time: "14:15", color: "#00E5FF", message: "C2-04 · Placa ABC-1234 · Periférico Norte · IA activa" },
    { time: "14:10", color: "#00E676", message: "TX-INC-2026-0040 · Cerrado · Resuelto · U-01" },
  ]);
  const [protoSteps, setProtoSteps] = useState<ProtoStep[]>([{ t: "Selecciona un módulo o envía un reporte para activar el protocolo." }]);
  const [rtype, setRtype] = useState("");
  const [rdesc, setRdesc] = useState("");
  const [toastFolio, setToastFolio] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const [vehPlate, setVehPlate] = useState("");
  const [vehResult, setVehResult] = useState<{plate: string; detail: string; loc: string} | null>(null);
  const vehCanvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState({ units: 12, reports: 47, critical: 3 });
  const [aiAnalysis, setAiAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [talkingAgent, setTalkingAgent] = useState<string | null>(null);

  const analyzeIncident = useAnalyzeIncident();
  const createReport = useCreateReport();
  const { data: serverStats } = useGetStats({ query: { refetchInterval: 30000 } });

  // Update stats from server
  useEffect(() => {
    if (serverStats) {
      setStats({
        units: serverStats.activeUnits,
        reports: serverStats.totalReports,
        critical: serverStats.criticalAlerts,
      });
      if (serverStats.recentActivity?.length) {
        setActivity(prev => {
          const newItems = serverStats.recentActivity.filter(
            (sa) => !prev.some((p) => p.message === sa.message)
          );
          return [...newItems, ...prev].slice(0, 15);
        });
      }
    }
  }, [serverStats]);

  // Clock
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      const pad = (v: number) => String(v).padStart(2, "0");
      setClock(`${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`);
      const days = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
      const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
      setClockDate(`${days[n.getDay()]} ${pad(n.getDate())} ${months[n.getMonth()]} 2026`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto activity feed
  useEffect(() => {
    const feeds = [
      { c: "#00E676", m: "U-01 · Patrullaje Periférico Norte · Sin novedad" },
      { c: "#00E5FF", m: "C2-04 · Vehículo en tránsito registrado · Carr. 95D" },
      { c: "#FF6D00", m: "Reporte ciudadano · El Mirador · Procesando en SANTI" },
      { c: "#00E676", m: "U-11 · Bugambilias · Ronda completada · Sin novedad" },
      { c: "#FF1744", m: "ALERTA CLUSTER · 3 reportes · Acatlipa · 2 últimas horas" },
      { c: "#00E5FF", m: "IA Predictiva · Riesgo elevado · Periférico · Próximas 2h" },
      { c: "#C13AFF", m: "Maximiliano · Análisis C2 · Patrón detectado · Sector Sur" },
      { c: "#00BFA5", m: "Santiago · Escuela Secundaria #3 · Perímetro OK · 14:30" },
    ];
    let idx = 0;
    const id = setInterval(() => {
      const f = feeds[idx++ % feeds.length];
      const n = new Date();
      const tm = `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
      setActivity(prev => [{ time: tm, color: f.c, message: f.m }, ...prev].slice(0, 15));
    }, 10000);
    return () => clearInterval(id);
  }, []);

  // Map initialization
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([18.8405, -99.2328], 14);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);

    // Heatmap via plugin (loaded from CDN in index.html)
    const heatData = [
      [18.848, -99.235, 0.98], [18.849, -99.234, 0.9], [18.847, -99.236, 0.85],
      [18.842, -99.228, 0.95], [18.843, -99.229, 0.88], [18.841, -99.227, 0.8],
      [18.836, -99.241, 0.92], [18.835, -99.240, 0.85], [18.837, -99.242, 0.78],
      [18.855, -99.230, 0.88], [18.856, -99.231, 0.75],
      [18.843, -99.252, 0.72], [18.844, -99.250, 0.68],
      [18.838, -99.238, 0.65], [18.836, -99.235, 0.6],
      [18.845, -99.248, 0.7], [18.846, -99.249, 0.62],
      [18.832, -99.225, 0.45], [18.850, -99.242, 0.55],
      [18.840, -99.255, 0.5],
    ];
    // @ts-expect-error leaflet.heat is loaded globally
    if (typeof L.heatLayer === "function") {
      // @ts-expect-error leaflet.heat
      L.heatLayer(heatData, {
        radius: 30, blur: 22, maxZoom: 16,
        gradient: { 0.2: "#001F3F", 0.4: "#0A4FD4", 0.6: "#FFD166", 0.8: "#FF6D00", 1.0: "#FF1744" },
      }).addTo(map);
    }

    // Risk zones
    const zones = [
      { ll: [18.848, -99.235] as [number,number], r: 200, c: "#FF1744", n: "COL. BUGAMBILIAS", s: "Narcomenudeo CJNG · Célula El Trébol" },
      { ll: [18.842, -99.228] as [number,number], r: 170, c: "#FF1744", n: "COL. EL MIRADOR", s: "Homicidios + Narcomenudeo" },
      { ll: [18.836, -99.241] as [number,number], r: 185, c: "#FF1744", n: "ACATLIPA CENTRO", s: "Disparos documentados ene-2025" },
      { ll: [18.845, -99.248] as [number,number], r: 150, c: "#FF6D00", n: "LOMAS DE AHUATLÁN", s: "Extorsión + Violencia familiar" },
      { ll: [18.832, -99.225] as [number,number], r: 120, c: "#FFD166", n: "ZONA ESCOLAR SUR", s: "Perímetro de seguridad escolar" },
    ];
    zones.forEach((z) => {
      L.circle(z.ll, { color: z.c, fillColor: z.c, fillOpacity: 0.07, opacity: 0.25, weight: 1, radius: z.r })
        .addTo(map)
        .bindPopup(`<b style="color:${z.c}">${z.n}</b><br><small>${z.s}</small>`);
      L.marker(z.ll, {
        icon: L.divIcon({
          html: `<div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:rgba(200,168,75,.65);letter-spacing:1px;white-space:nowrap;text-shadow:0 0 6px rgba(0,0,0,.9)">${z.n}</div>`,
          className: "",
          iconSize: [160, 14],
        }),
      }).addTo(map);
    });

    // Patrol units with PNG-like styled icons
    const patrolData = [
      { ll: [18.848, -99.236] as [number,number], color: "#00E5FF", unit: "U-01", sector: "CENTRO", status: "Patrullando" },
      { ll: [18.840, -99.244] as [number,number], color: "#FFD166", unit: "U-03", sector: "ACATLIPA", status: "En servicio" },
      { ll: [18.852, -99.230] as [number,number], color: "#FF1744", unit: "U-07", sector: "PERIFÉRICO", status: "Llamado activo" },
      { ll: [18.835, -99.228] as [number,number], color: "#00E676", unit: "U-11", sector: "BUGAMBILIAS", status: "Vigilancia" },
      { ll: [18.830, -99.250] as [number,number], color: "#C13AFF", unit: "U-14", sector: "BLVD. JUÁREZ", status: "Patrullando" },
    ];

    patrulsRef.current = patrolData.map((p) => {
      const svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
          <defs>
            <filter id="glow-${p.unit}">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <circle cx="18" cy="18" r="16" fill="rgba(1,13,26,0.92)" stroke="${p.color}" stroke-width="2" filter="url(#glow-${p.unit})"/>
          <rect x="6" y="13" width="24" height="12" rx="3" fill="${p.color}" opacity="0.9"/>
          <rect x="8" y="11" width="20" height="7" rx="2" fill="${p.color}" opacity="0.7"/>
          <circle cx="11" cy="25" r="3" fill="#000" stroke="${p.color}" stroke-width="1.5"/>
          <circle cx="25" cy="25" r="3" fill="#000" stroke="${p.color}" stroke-width="1.5"/>
          <rect x="14" y="14" width="8" height="4" rx="1" fill="rgba(255,255,255,0.7)"/>
        </svg>
      `;
      const icon = L.divIcon({
        html: `
          <div style="text-align:center;filter:drop-shadow(0 0 6px ${p.color})">
            ${svgIcon}
            <div style="font-family:'Share Tech Mono',monospace;font-size:8px;color:${p.color};margin-top:1px;white-space:nowrap;text-shadow:0 0 4px rgba(0,0,0,.9);letter-spacing:1px;font-weight:700">${p.unit}</div>
          </div>`,
        className: "",
        iconSize: [40, 52],
        iconAnchor: [20, 52],
      });
      const mk = L.marker(p.ll, { icon }).addTo(map);
      mk.bindPopup(`<b style="color:${p.color}">${p.unit}</b><br>Sector: ${p.sector}<br>Estado: <span style="color:${p.color}">${p.status}</span>`);
      return {
        mk,
        lat: p.ll[0],
        lng: p.ll[1],
        dlat: (Math.random() - 0.5) * 0.00022,
        dlng: (Math.random() - 0.5) * 0.00022,
      };
    });

    // Road labels
    [[18.843, -99.258, "BLVD. JUÁREZ"], [18.830, -99.233, "CARR. FED. 95"], [18.857, -99.244, "PERIFÉRICO NORTE"]]
      .forEach(([lat, lng, txt]) => {
        L.marker([lat as number, lng as number], {
          icon: L.divIcon({
            html: `<div style="font-family:'Share Tech Mono',monospace;font-size:8px;color:rgba(200,168,75,.45);letter-spacing:1px;white-space:nowrap;text-shadow:0 0 6px rgba(0,0,0,.9)">${txt}</div>`,
            className: "",
            iconSize: [150, 12],
          }),
        }).addTo(map);
      });

    map.on("click", (e) => {
      setCoords(`LAT: ${e.latlng.lat.toFixed(4)} · LNG: ${e.latlng.lng.toFixed(4)}`);
    });

    // Patrol movement animation
    const moveInterval = setInterval(() => {
      patrulsRef.current.forEach((p) => {
        p.lat += p.dlat;
        p.lng += p.dlng;
        if (p.lat > 18.870 || p.lat < 18.820) p.dlat *= -1;
        if (p.lng > -99.200 || p.lng < -99.270) p.dlng *= -1;
        p.mk.setLatLng([p.lat, p.lng]);
      });
    }, 1600);

    return () => {
      clearInterval(moveInterval);
    };
  }, []);

  const speak = useCallback((text: string, agentId: keyof typeof AGENTS) => {
    setSpeechAgent(agentId);
    setSpeechText(text);
    setTalkingAgent(agentId);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "es-MX";
      u.rate = 0.9;
      u.pitch = agentId === "katering" ? 1.2 : agentId === "santiago" ? 1.1 : 0.95;
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang === "es-MX") || voices.find(v => v.lang.startsWith("es"));
      if (voice) u.voice = voice;
      u.onend = () => setTalkingAgent(null);
      window.speechSynthesis.speak(u);
    }
    setTimeout(() => setTalkingAgent(null), 4000);
  }, []);

  const addIncidentMarker = useCallback((lat: number, lng: number, folio: string, tipo: string, color: string) => {
    if (!mapInstanceRef.current) return;
    const circ = L.circle([lat, lng], {
      color, fillColor: color, fillOpacity: 0.2, opacity: 0.6, weight: 2, radius: 130,
    }).addTo(mapInstanceRef.current);
    circ.bindPopup(`<b style="color:${color}">${folio}</b><br>${tipo}<br><small>Ahora mismo</small>`).openPopup();
    mapInstanceRef.current.setView([lat, lng], 15, { animate: true });
  }, []);

  const addActivity = useCallback((time: string, color: string, message: string) => {
    setActivity(prev => [{ time, color, message }, ...prev].slice(0, 15));
  }, []);

  const showToastFn = useCallback((folio: string) => {
    setToastFolio(folio);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4800);
  }, []);

  const sendReport = useCallback(async () => {
    if (!rtype) { alert("Selecciona el tipo de incidente."); return; }
    const folio = genFolio();
    const agentId = (TYPE_TO_AGENT[rtype] || "santi") as keyof typeof AGENTS;
    const color = TYPE_COLORS[rtype] || "#C8A84B";
    const cls = TYPE_CLASS[rtype] || "gold";
    const n = new Date();
    const tm = `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;

    setFolioItems(prev => [{ folio, tipo: rtype, cls, time: tm }, ...prev].slice(0, 20));
    const lat = 18.8405 + (Math.random() - 0.5) * 0.02;
    const lng = -99.2328 + (Math.random() - 0.5) * 0.025;
    addIncidentMarker(lat, lng, folio, rtype, color);
    showToastFn(folio);
    addActivity(tm, color, `${folio} · ${rtype} · ${AGENTS[agentId].name} asignado · Unidad en camino`);

    const proto = PROTOS[rtype] || ["Mantén la calma", "Aléjate del área", "Unidad notificada", "Guarda tu folio"];
    setProtoSteps(proto.map(t => ({ t })));
    setStats(prev => ({ ...prev, reports: prev.reports + 1 }));

    // Get real Gemini AI analysis
    setAnalyzing(true);
    speak(`${AGENTS[agentId].name} procesando folio ${folio}. Análisis neuronal activado...`, agentId);

    try {
      const analysis = await analyzeIncident.mutateAsync({
        data: {
          tipo: rtype,
          descripcion: rdesc || undefined,
          sector: "Temixco",
          folio,
          agente: agentId,
        },
      });
      setAiAnalysis(analysis);

      // Save to DB
      createReport.mutate({
        data: {
          folio,
          tipo: rtype,
          descripcion: rdesc || undefined,
          sector: "Temixco",
          latitud: lat,
          longitud: lng,
          agente: agentId,
          nivelRiesgo: analysis.nivelRiesgo,
          analisis: analysis.analisis,
          accionesRecomendadas: analysis.accionesRecomendadas?.join(" | "),
          unidadesRequeridas: analysis.unidadesRequeridas,
          protocolo: analysis.protocolo,
          coordinacion: analysis.coordinacion,
        },
      });

      // Update protocol from AI
      if (analysis.accionesRecomendadas?.length) {
        setProtoSteps(analysis.accionesRecomendadas.map((t: string) => ({ t })));
      }

      speak(analysis.analisis, agentId);
      addActivity(tm, color, `IA GEMINI · ${folio} · Riesgo: ${analysis.nivelRiesgo} · Protocolo: ${analysis.protocolo}`);
    } catch {
      speak(`Folio ${folio} registrado. ${AGENTS[agentId].name} coordinando respuesta.`, agentId);
    } finally {
      setAnalyzing(false);
    }

    setRtype("");
    setRdesc("");
  }, [rtype, rdesc, speak, addIncidentMarker, showToastFn, addActivity, analyzeIncident, createReport]);

  const repSec = useCallback(() => {
    const folio = genFolio() + "-CRÍTICO";
    const n = new Date();
    const tm = `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
    setFolioItems(prev => [{ folio, tipo: "ALERTA MÁXIMA — Secretario", cls: "red", time: tm }, ...prev].slice(0, 20));
    const lat = 18.8405 + (Math.random() - 0.5) * 0.015;
    const lng = -99.2328 + (Math.random() - 0.5) * 0.015;
    addIncidentMarker(lat, lng, folio, "ALERTA MÁXIMA", "#FF1744");
    showToastFn(folio);
    addActivity(tm, "#FF1744", `🚨 ${folio} · ALERTA MÁXIMA · Secretario notificado · TODAS LAS UNIDADES EN ALERTA`);
    setStats(prev => ({ ...prev, critical: prev.critical + 1 }));
    speak("ALERTA MÁXIMA. Canal directo con el Secretario de Seguridad abierto. Todas las unidades disponibles en estado de alerta máxima. Coordinación táctica inmediata activada en todos los sectores.", "santi");
  }, [speak, addIncidentMarker, showToastFn, addActivity]);

  const scanVeh = useCallback(() => {
    if (!vehPlate.trim()) { alert("Ingresa una placa o descripción."); return; }
    const pl = vehPlate.trim().toUpperCase();
    const reps = Math.floor(Math.random() * 5) + 1;
    const tipos = ["Extorsión · Gota a Gota", "Narcomenudeo", "Robo a transeúnte", "Cobro de piso"];
    const zonas = ["Blvd. Juárez esq. Carr. 95", "Periférico Norte", "Col. Bugambilias", "Acatlipa Centro"];
    const tipo = tipos[Math.floor(Math.random() * tipos.length)];
    const zona = zonas[Math.floor(Math.random() * zonas.length)];
    const n = new Date();
    const tm = `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
    setVehResult({ plate: pl, detail: `Reportes: ${reps} · ${tipo}`, loc: `📍 ${zona} · Hoy ${tm}` });

    // Draw on canvas
    setTimeout(() => {
      const canvas = vehCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#050F1E"); bg.addColorStop(1, "#0A1E32");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(0,229,255,0.08)"; ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 2) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.fillStyle = "rgba(20,40,60,.85)"; ctx.beginPath(); ctx.roundRect(20, 15, W - 40, H - 20, 4); ctx.fill();
      ctx.fillStyle = "#FFFFFF"; ctx.strokeStyle = "#222"; ctx.lineWidth = 1;
      const px = W / 2 - 55, py = 20, pw = 110, ph = 20;
      ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#000"; ctx.font = "bold 12px 'Orbitron', monospace"; ctx.textAlign = "center";
      ctx.fillText(pl, W / 2, py + 14);
      ctx.fillStyle = "rgba(0,229,255,.85)"; ctx.font = '6px "Share Tech Mono"'; ctx.textAlign = "left";
      ["NITIDEZ:94%", "IA ENHANCED", "C2:ACTIVO"].forEach((t, i) => { ctx.fillText(t, 3, 9 + i * 8); });
      ctx.strokeStyle = "rgba(0,229,255,.7)"; ctx.lineWidth = 1; ctx.strokeRect(px - 3, py - 3, pw + 6, ph + 6);
    }, 50);

    if (mapInstanceRef.current) {
      const lat = 18.8405 + (Math.random() - 0.5) * 0.02;
      const lng = -99.2328 + (Math.random() - 0.5) * 0.025;
      L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style="background:#FF1744;color:#fff;font-family:'Orbitron',monospace;font-size:8px;padding:3px 8px;border-radius:4px;white-space:nowrap;box-shadow:0 0 12px #FF1744;letter-spacing:1px">${pl}</div>`,
          className: "", iconSize: [90, 20],
        }),
      }).addTo(mapInstanceRef.current).bindPopup(`<b>${pl}</b><br>${tipo}<br>${reps} reportes en C2`).openPopup();
      mapInstanceRef.current.setView([lat, lng], 15, { animate: true });
    }

    addActivity(tm, "#00E5FF", `C2 · Placa ${pl} · ${reps} reportes · ${zona} · IA mejorada activa`);
    speak(`Sistema C2 identificó vehículo placa ${pl} con ${reps} reportes previos. Categoría: ${tipo}. Última visualización: ${zona}. Imagen mejorada con inteligencia artificial. Unidad 07 notificada.`, "maxi");
  }, [vehPlate, addActivity, speak]);

  const openModal = (tipo: string) => {
    const d = MODAL_DATA[tipo];
    if (!d) return;
    setModal(tipo);
    speak(`Protocolo ${d.ttl} activado. ${d.steps[0].t}: ${d.steps[0].d}`, d.agent);
  };

  const agentColor = (id: keyof typeof AGENTS) => AGENTS[id].color;

  const folioItemColor = (cls: string) => {
    const map: Record<string, string> = { red: "#FF1744", violet: "#C13AFF", cyan: "#00E5FF", orange: "#FF6D00", gold: "#C8A84B" };
    return map[cls] || "#C8A84B";
  };

  const isFederal = (tipo: string) => ["Narcomenudeo CJNG", "Extorsión / Gota a Gota", "Disparos activos", "Homicidio / Ejecución", "Desaparición"].includes(tipo);

  return (
    <div style={{ fontFamily: "'Rajdhani', sans-serif", height: "100vh", overflow: "hidden", background: "#000509", color: "#D0E8FF", cursor: "default", position: "relative" }}>
      {/* Load external resources */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap" />
      <style>{`
        @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
        @keyframes av-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
        @keyframes av-ring{0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.15);opacity:.1}}
        @keyframes av-talk{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
        @keyframes patrol-pulse{0%,100%{box-shadow:0 0 8px currentColor}50%{box-shadow:0 0 18px currentColor,0 0 30px currentColor}}
        @keyframes sec-warn{0%,100%{box-shadow:0 0 16px rgba(255,23,68,.3)}50%{box-shadow:0 0 30px rgba(255,23,68,.55),0 0 60px rgba(255,23,68,.15)}}
        @keyframes sec-scan{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes modal-in{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:none}}
        @keyframes slide-in{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes toast-in{from{transform:translateX(-50%) translateY(-80px)}to{transform:translateX(-50%) translateY(0)}}
        @keyframes ai-pulse{0%,100%{opacity:.7}50%{opacity:1}}
        ::-webkit-scrollbar{width:2px}
        ::-webkit-scrollbar-thumb{background:rgba(200,168,75,.12);border-radius:1px}
        .hex-bg{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath d='M28 0l28 50-28 50L0 50z' fill='none' stroke='%23C8A84B' stroke-width='0.5'/%3E%3C/svg%3E");background-size:56px 100px}
        .scanlines{position:fixed;inset:0;pointer-events:none;z-index:9999;background:repeating-linear-gradient(0deg,transparent,transparent 1px,rgba(0,229,255,0.013) 1px,rgba(0,229,255,0.013) 2px)}
        .leaflet-container{background:#010D1A!important}
        .leaflet-popup-content-wrapper{background:rgba(4,22,40,.97)!important;border:1px solid rgba(200,168,75,.25)!important;color:#D0E8FF!important;font-family:'Rajdhani',sans-serif!important;border-radius:10px!important}
        .leaflet-popup-tip{background:rgba(4,22,40,.97)!important}
        .leaflet-popup-content b{color:#C8A84B}
        .tac-btn{width:100%;margin-bottom:8px;padding:0;background:transparent;border:none;cursor:pointer;text-align:left;position:relative}
        .tac-inner{padding:12px 14px;border-radius:14px;border:1px solid;position:relative;overflow:hidden;transition:all .3s cubic-bezier(.34,1.56,.64,1);display:flex;align-items:center;gap:12px}
        .tac-inner::before{content:'';position:absolute;inset:0;opacity:0;transition:opacity .3s}
        .tac-btn:hover .tac-inner{transform:translateY(-3px) scale(1.02)}
        .tac-btn:hover .tac-inner::before{opacity:1}
        .tac-btn:active .tac-inner{transform:translateY(0) scale(.98)}
        .folio-item{padding:9px 11px;border-radius:10px;border:1px solid rgba(200,168,75,.12);background:rgba(4,22,40,.6);margin-bottom:6px;cursor:pointer;transition:all .2s;animation:slide-in .3s ease both;position:relative;overflow:hidden}
        .folio-item::before{content:'';position:absolute;top:0;left:0;bottom:0;width:3px;border-radius:3px 0 0 3px}
        .folio-item:hover{border-color:rgba(200,168,75,.25);transform:translateX(3px)}
        .rselect,.rtextarea{background:rgba(0,0,0,.4);border:1px solid rgba(200,168,75,.12);border-radius:6px;padding:6px 10px;color:#D0E8FF;font-family:'Rajdhani',sans-serif;font-size:12px;outline:none;width:100%;transition:border-color .2s}
        .rselect:focus,.rtextarea:focus{border-color:rgba(200,168,75,.25)}
        .rselect option{background:#010D1A}
        .rtextarea{resize:none}
        .rtextarea::placeholder{color:#3A5A7A}
        .rbtn{padding:8px;border:none;border-radius:6px;cursor:pointer;font-family:'Orbitron',monospace;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:linear-gradient(135deg,#C8A84B,#8A6A20);color:#000;transition:all .2s;width:100%}
        .rbtn:hover{box-shadow:0 0 20px rgba(200,168,75,.3);transform:translateY(-1px)}
        .rbtn:disabled{opacity:.6;cursor:not-allowed;transform:none}
      `}</style>

      {/* Background layers */}
      <div className="hex-bg" />
      <div className="scanlines" />

      {/* Corner brackets */}
      {[["0","0","0","0","100%","2px","2px","100%"],["0","auto","0","0","100%","2px","2px","100%"],["auto","0","0","0","100%","2px","2px","100%"],["auto","auto","0","0","100%","2px","2px","100%"]].map((_,i)=>(
        <div key={i} style={{position:"fixed",width:48,height:48,pointerEvents:"none",zIndex:3,...[[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}][i]][0]}}>
          <div style={{position:"absolute",...[{top:0,left:0,width:"100%",height:2},{top:0,right:0,width:"100%",height:2},{bottom:0,left:0,width:"100%",height:2},{bottom:0,right:0,width:"100%",height:2}][i],background:"#C8A84B"}}/>
          <div style={{position:"absolute",...[{top:0,left:0,width:2,height:"100%"},{top:0,right:0,width:2,height:"100%"},{bottom:0,left:0,width:2,height:"100%"},{bottom:0,right:0,width:2,height:"100%"}][i],background:"#C8A84B"}}/>
        </div>
      ))}

      {/* Toast */}
      {showToast && (
        <div style={{position:"fixed",top:64,left:"50%",transform:"translateX(-50%)",background:"rgba(0,230,118,.08)",border:"1px solid rgba(0,230,118,.3)",borderRadius:999,padding:"10px 20px",display:"flex",alignItems:"center",gap:9,zIndex:2000,whiteSpace:"nowrap",backdropFilter:"blur(16px)",animation:"toast-in .4s cubic-bezier(.34,1.56,.64,1)"}}>
          <span style={{fontSize:16}}>⚡</span>
          <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#6A9"}}>FOLIO GENERADO ·</span>
          <span style={{fontFamily:"'Orbitron',monospace",fontSize:12,fontWeight:700,color:"#00E676",letterSpacing:1}}>{toastFolio}</span>
        </div>
      )}

      {/* Modal */}
      {modal && MODAL_DATA[modal] && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }} style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,.8)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#041628",border:"1px solid rgba(200,168,75,.25)",borderRadius:20,padding:24,maxWidth:480,width:"90%",maxHeight:"82vh",overflowY:"auto",animation:"modal-in .35s cubic-bezier(.34,1.56,.64,1)",position:"relative"}}>
            <div style={{position:"absolute",top:0,left:"20%",right:"20%",height:1,background:"linear-gradient(90deg,transparent,#C8A84B,transparent)"}}/>
            <div style={{display:"flex",alignItems:"flex-start",gap:13,marginBottom:16,paddingBottom:13,borderBottom:"1px solid rgba(200,168,75,.12)"}}>
              <span style={{fontSize:28}}>{MODAL_DATA[modal].ico}</span>
              <div>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:16,fontWeight:700,letterSpacing:.5}}>{MODAL_DATA[modal].ttl}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A",letterSpacing:1,marginTop:4}}>{MODAL_DATA[modal].sub}</div>
              </div>
              <button onClick={() => setModal(null)} style={{marginLeft:"auto",background:"none",border:"none",color:"#3A5A7A",fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            {MODAL_DATA[modal].steps.map((s, i) => (
              <div key={i} style={{display:"flex",gap:10,marginBottom:8,padding:"10px",background:"rgba(0,0,0,.3)",border:"1px solid rgba(200,168,75,.12)",borderRadius:10}}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:900,color:"#C8A84B",flexShrink:0}}>{s.n}</div>
                <div><div style={{fontWeight:700,fontSize:13,marginBottom:2}}>{s.t}</div><div style={{fontSize:11,color:"#3A5A7A",lineHeight:1.5}}>{s.d}</div></div>
              </div>
            ))}
            <div style={{background:"rgba(255,23,68,.06)",border:"1px solid rgba(255,23,68,.2)",borderRadius:10,padding:"10px 12px",marginTop:10,fontSize:11,color:"#6A90B8",lineHeight:1.6}} dangerouslySetInnerHTML={{__html:`<strong style="color:#FF1744">⚠️</strong> ${MODAL_DATA[modal].alert}`}}/>
          </div>
        </div>
      )}

      {/* Shell */}
      <div style={{position:"relative",zIndex:1,height:"100vh",display:"flex",flexDirection:"column"}}>

        {/* Header */}
        <header style={{height:54,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 22px",background:"rgba(1,13,26,0.98)",borderBottom:"1px solid rgba(200,168,75,.12)",backdropFilter:"blur(20px)",position:"relative"}}>
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,#C8A84B,transparent)"}}/>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:38,height:38,borderRadius:8,background:"linear-gradient(135deg,rgba(200,168,75,.2),rgba(10,79,212,.15))",border:"1px solid rgba(200,168,75,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:"0 0 16px rgba(200,168,75,.15)"}}>🛡️</div>
            <div>
              <div style={{fontFamily:"'Orbitron',monospace",fontWeight:900,fontSize:15,letterSpacing:5,textTransform:"uppercase",background:"linear-gradient(90deg,#C8A84B,#E2C46A,#F5DFA0)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>SANTI · CENTRO DE MANDO</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#6A90B8",letterSpacing:2,marginTop:1}}>SECRETARÍA DE SEGURIDAD PÚBLICA · TEMIXCO, MORELOS · 2026</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            {[["#00E676", stats.units, "UNIDADES"], ["#FF6D00", stats.reports, "REPORTES HOY"], ["#FF1744", stats.critical, "ALERTAS"], ["#00E5FF", "8m", "RESP. PROM."]].map(([color, val, lbl]) => (
              <div key={lbl as string} style={{textAlign:"center"}}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,fontWeight:700,color:color as string}}>{val}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#3A5A7A",letterSpacing:1}}>{lbl as string}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:999,background:"rgba(0,230,118,.08)",border:"1px solid rgba(0,230,118,.2)"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"#00E676",boxShadow:"0 0 8px #00E676",animation:"pulse-dot 1.5s infinite"}}/>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,fontWeight:700,color:"#00E676",letterSpacing:1}}>EN VIVO</span>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,color:"#00E5FF",letterSpacing:2}}>{clock}</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A",letterSpacing:1}}>{clockDate}</div>
            </div>
          </div>
        </header>

        {/* Body grid */}
        <div style={{flex:1,display:"grid",gridTemplateColumns:"300px 1fr 280px",overflow:"hidden"}}>

          {/* LEFT PANEL */}
          <aside style={{display:"flex",flexDirection:"column",background:"rgba(2,15,31,.97)",borderRight:"1px solid rgba(200,168,75,.12)",overflow:"hidden"}}>
            {/* Agents */}
            <div style={{padding:"12px 14px 10px",borderBottom:"1px solid rgba(200,168,75,.12)",flexShrink:0}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A",letterSpacing:2,textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:16,height:1,background:"rgba(200,168,75,.5)",display:"inline-block"}}/>Agentes IA Activos
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                {/* SANTI - full width */}
                {Object.entries(AGENTS).map(([id, ag], i) => (
                  <div key={id}
                    onClick={() => speak(`${ag.name} en línea. Listo para coordinar.`, id as keyof typeof AGENTS)}
                    style={{
                      borderRadius:10,border:`1px solid ${agentColor(id as keyof typeof AGENTS)}40`,
                      background:`${agentColor(id as keyof typeof AGENTS)}08`,
                      padding:"9px 10px",cursor:"pointer",position:"relative",overflow:"hidden",
                      display:"flex",alignItems:"center",gap:9,gridColumn:i===0?"1/-1":undefined,
                      transition:"all .25s",
                    }}
                  >
                    <div style={{
                      width:36,height:36,borderRadius:"50%",
                      background:`${agentColor(id as keyof typeof AGENTS)}18`,
                      border:`1.5px solid ${agentColor(id as keyof typeof AGENTS)}50`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,
                      animation:talkingAgent===id?"av-talk .5s ease-in-out infinite":"av-breathe 3s ease-in-out infinite",
                    }}>
                      {ag.emoji}
                    </div>
                    <div>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,letterSpacing:1,color:agentColor(id as keyof typeof AGENTS)}}>{ag.name}</div>
                      <div style={{fontSize:9,color:"#3A5A7A",fontFamily:"'Share Tech Mono',monospace",marginTop:1}}>{ag.role}</div>
                    </div>
                    <div style={{position:"absolute",top:8,right:8,width:5,height:5,borderRadius:"50%",background:"#00E676",boxShadow:"0 0 5px #00E676"}}/>
                  </div>
                ))}
              </div>
            </div>

            {/* Speech panel */}
            <div style={{margin:"10px 14px",padding:"10px 12px",background:"rgba(0,229,255,.04)",border:"1px solid rgba(0,229,255,.12)",borderRadius:10,flexShrink:0,minHeight:60,position:"relative"}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,letterSpacing:1,marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:agentColor(speechAgent),boxShadow:`0 0 6px ${agentColor(speechAgent)}`,animation:"pulse-dot 1.2s infinite"}}/>
                <span style={{color:agentColor(speechAgent),letterSpacing:1}}>{AGENTS[speechAgent].name}</span>
                {analyzing && <span style={{color:"#00E5FF",fontSize:7,animation:"ai-pulse 1s infinite",marginLeft:"auto"}}>⚡ GEMINI IA ANALIZANDO...</span>}
              </div>
              <div style={{fontSize:12,lineHeight:1.6,color:"#D0E8FF"}}>
                {speechText}<span style={{display:"inline-block",width:2,height:12,background:"#00E5FF",animation:"blink .7s steps(1) infinite",verticalAlign:"middle",marginLeft:1}}/>
              </div>
            </div>

            {/* AI Analysis Panel */}
            {aiAnalysis && (
              <div style={{margin:"0 14px 8px",padding:"10px 12px",background:"rgba(10,79,212,.05)",border:"1px solid rgba(10,79,212,.25)",borderRadius:10,flexShrink:0}}>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#1568FF",letterSpacing:2,marginBottom:6}}>⚡ ANÁLISIS GEMINI IA · TIEMPO REAL</div>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,marginBottom:4,color:{CRÍTICO:"#FF1744",ALTO:"#FF6D00",MEDIO:"#FFD166",BAJO:"#00E676"}[aiAnalysis.nivelRiesgo]||"#C8A84B"}}>
                  RIESGO: {aiAnalysis.nivelRiesgo} · {aiAnalysis.protocolo}
                </div>
                <div style={{fontSize:10,color:"#6A90B8",lineHeight:1.5,marginBottom:6}}>{aiAnalysis.analisis}</div>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A"}}>{aiAnalysis.coordinacion}</div>
              </div>
            )}

            {/* Folio list */}
            <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
              <div style={{padding:"10px 14px 6px",borderTop:"1px solid rgba(200,168,75,.12)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A",letterSpacing:2,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{width:16,height:1,background:"rgba(200,168,75,.5)",display:"inline-block"}}/>Registro de Folios
                </div>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:10,color:"#C8A84B",fontWeight:700}}>{folioItems.length}</div>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:"0 14px 10px",scrollbarWidth:"thin"}}>
                {folioItems.map((f, i) => (
                  <div key={f.folio} className="folio-item" style={{animationDelay:`${i*.04}s`}}>
                    <div style={{position:"absolute",top:0,left:0,bottom:0,width:3,borderRadius:"3px 0 0 3px",background:folioItemColor(f.cls)}}/>
                    <div style={{fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:3,color:folioItemColor(f.cls)}}>{f.folio}</div>
                    <div style={{fontSize:11,color:"#D0E8FF",marginBottom:2,fontWeight:600}}>
                      {f.tipo}
                      <span style={{display:"inline-flex",padding:"1px 5px",borderRadius:999,fontSize:7,fontWeight:800,letterSpacing:.5,marginLeft:6,background:isFederal(f.tipo)?"rgba(255,23,68,.15)":"rgba(200,168,75,.12)",color:isFederal(f.tipo)?"#FF1744":"#C8A84B",border:`1px solid ${isFederal(f.tipo)?"rgba(255,23,68,.25)":"rgba(200,168,75,.2)"}`}}>
                        {isFederal(f.tipo)?"FEDERAL":"COMÚN"}
                      </span>
                    </div>
                    <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A",display:"flex",gap:8}}>
                      <span>{f.time}</span><span>En proceso</span>
                    </div>
                  </div>
                ))}
                {folioItems.length === 0 && (
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#3A5A7A",textAlign:"center",marginTop:20}}>Sin folios registrados</div>
                )}
              </div>
            </div>
          </aside>

          {/* MAP CENTER */}
          <div style={{position:"relative",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{flex:1,position:"relative",minHeight:0}}>
              {/* Map HUD */}
              <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:400}}>
                <div style={{position:"absolute",top:12,left:12,display:"flex",gap:8,pointerEvents:"all"}}>
                  {["📍 TEMIXCO","🔥 ZONAS CALOR","🚨 CRÍTICO","🏫 ESCUELAS","🚔 PATRULLAS"].map(label => (
                    <div key={label} style={{padding:"5px 12px",borderRadius:999,background:"rgba(1,13,26,.9)",border:"1px solid rgba(200,168,75,.12)",fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#C8A84B",backdropFilter:"blur(12px)",letterSpacing:.5,cursor:"pointer",transition:"all .2s"}}>
                      {label}
                    </div>
                  ))}
                </div>
                <div style={{position:"absolute",bottom:12,right:12}}>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#3A5A7A",background:"rgba(1,13,26,.85)",padding:"5px 10px",borderRadius:6,border:"1px solid rgba(200,168,75,.12)"}}>{coords}</div>
                </div>
              </div>
              <div ref={mapRef} style={{width:"100%",height:"100%"}} />
            </div>

            {/* Bottom strip */}
            <div style={{height:200,flexShrink:0,background:"rgba(1,13,26,.97)",borderTop:"1px solid rgba(200,168,75,.12)",display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
              {/* Report form */}
              <div style={{padding:"12px 14px",borderRight:"1px solid rgba(200,168,75,.12)"}}>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A",letterSpacing:2,textTransform:"uppercase",marginBottom:9,display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:4,height:4,borderRadius:"50%",background:"#C8A84B",display:"inline-block"}}/>Reporte Rápido
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <select className="rselect" value={rtype} onChange={e => setRtype(e.target.value)}>
                    <option value="">Tipo de incidente...</option>
                    <option value="Robo / Asalto">🏃 Robo / Asalto</option>
                    <option value="Violencia familiar">🦋 Violencia familiar</option>
                    <option value="Narcomenudeo CJNG">🎯 Narcomenudeo / CJNG</option>
                    <option value="Extorsión / Gota a Gota">🔒 Extorsión / Gota a Gota</option>
                    <option value="Disparos activos">⚡ Disparos activos</option>
                    <option value="Desaparición">🔍 Desaparición</option>
                    <option value="Vehículo sospechoso">🚗 Vehículo sospechoso</option>
                    <option value="Seguridad escolar">🏫 Seguridad escolar</option>
                    <option value="Homicidio / Ejecución">💀 Homicidio</option>
                  </select>
                  <textarea className="rtextarea" rows={2} placeholder="Descripción del incidente..." value={rdesc} onChange={e => setRdesc(e.target.value)}/>
                  <button className="rbtn" onClick={sendReport} disabled={analyzing}>
                    {analyzing ? "⚡ ANALIZANDO CON GEMINI..." : "⚡ REGISTRAR REPORTE"}
                  </button>
                </div>
              </div>

              {/* Protocol */}
              <div style={{padding:"12px 14px",borderRight:"1px solid rgba(200,168,75,.12)"}}>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A",letterSpacing:2,textTransform:"uppercase",marginBottom:9,display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:4,height:4,borderRadius:"50%",background:"#C8A84B",display:"inline-block"}}/>Protocolo Activo
                </div>
                <div style={{overflowY:"auto",maxHeight:155}}>
                  {protoSteps.map((s, i) => (
                    <div key={i} style={{display:"flex",gap:7,marginBottom:7,padding:"7px 9px",background:"rgba(4,22,40,.5)",border:"1px solid rgba(200,168,75,.12)",borderRadius:6}}>
                      <span style={{fontFamily:"'Orbitron',monospace",fontSize:11,fontWeight:700,color:"#C8A84B",flexShrink:0}}>{String(i+1).padStart(2,"0")}</span>
                      <div style={{fontSize:11,fontWeight:700}}>{s.t}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity */}
              <div style={{padding:"12px 14px"}}>
                <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A",letterSpacing:2,textTransform:"uppercase",marginBottom:9,display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:4,height:4,borderRadius:"50%",background:"#C8A84B",display:"inline-block"}}/>Bitácora en Vivo
                </div>
                <div style={{overflowY:"auto",maxHeight:155}}>
                  {activity.map((a, i) => (
                    <div key={i} style={{display:"flex",gap:7,padding:"3px 0",borderBottom:"1px solid rgba(200,168,75,.04)",animation:"slide-in .25s ease"}}>
                      <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A",flexShrink:0}}>{a.time}</span>
                      <div style={{width:5,height:5,borderRadius:"50%",flexShrink:0,marginTop:4,background:a.color}}/>
                      <span style={{fontSize:10,color:"#6A90B8",lineHeight:1.4}}>{a.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <aside style={{display:"flex",flexDirection:"column",background:"rgba(2,15,31,.97)",borderLeft:"1px solid rgba(200,168,75,.12)",overflowY:"auto",scrollbarWidth:"thin"}}>
            {/* Stats */}
            <div style={{padding:14,borderBottom:"1px solid rgba(200,168,75,.12)",display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,flexShrink:0}}>
              {[
                { val: stats.units, lbl: "UNIDADES ACTIVAS", color: "#00E676", accent: "#00E676" },
                { val: stats.critical, lbl: "ALERTAS CRÍTICAS", color: "#FF1744", accent: "#FF1744" },
                { val: stats.reports, lbl: "REPORTES HOY", color: "#00E5FF", accent: "#00E5FF" },
                { val: "89%", lbl: "ATENCIÓN", color: "#C8A84B", accent: "#C8A84B" },
              ].map(s => (
                <div key={s.lbl} style={{background:"rgba(4,22,40,.6)",border:"1px solid rgba(200,168,75,.12)",borderRadius:10,padding:10,textAlign:"center",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",bottom:0,left:0,right:0,height:1,background:s.accent}}/>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:20,fontWeight:900,color:s.color,lineHeight:1}}>{s.val}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#3A5A7A",letterSpacing:1,marginTop:4}}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Tactical modules */}
            <div style={{padding:"10px 14px",flexShrink:0}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A",letterSpacing:2,textTransform:"uppercase",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:16,height:1,background:"rgba(10,79,212,.6)",display:"inline-block"}}/>Módulos Tácticos
              </div>

              {[
                { id:"mujer", color:"#C13AFF", ico:"🦋", title:"CÓDIGO VIOLETA", desc:"Protocolo AVG · Geolocalización género", badge:"FEDERAL", badgeC:"#FF1744" },
                { id:"extorsion", color:"#FF6D00", ico:"🔒", title:"ANTIEXTORSIÓN", desc:"Gota a Gota · Cobro de piso · Captura", badge:"FEDERAL", badgeC:"#FF1744" },
                { id:"escuela", color:"#00E5FF", ico:"🏫", title:"ESCUELA SEGURA", desc:"Perímetros · Cuadrantes · Alertas", badge:"COMÚN", badgeC:"#C8A84B" },
                { id:"desaparicion", color:"#00BFA5", ico:"🔍", title:"DESAPARICIÓN", desc:"Protocolo Alba · AVG · Buscadoras", badge:"FEDERAL", badgeC:"#FF1744" },
                { id:"narco", color:"#C8A84B", ico:"🎯", title:"NARCOMENUDEO", desc:"CJNG · Células · Denuncia anónima", badge:"FEDERAL", badgeC:"#FF1744" },
              ].map(mod => (
                <button key={mod.id} className="tac-btn" onClick={() => openModal(mod.id)}>
                  <div className="tac-inner" style={{borderColor:`${mod.color}40`,background:`${mod.color}08`}}>
                    <div style={{width:42,height:42,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:21,flexShrink:0,background:`${mod.color}15`,border:"1px solid rgba(255,255,255,.06)"}}>
                      {mod.ico}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,letterSpacing:.5,marginBottom:3,color:mod.color}}>{mod.title}</div>
                      <div style={{fontSize:10,color:"#3A5A7A",lineHeight:1.4}}>{mod.desc}</div>
                    </div>
                    <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,fontWeight:800,padding:"2px 6px",borderRadius:999,letterSpacing:.5,alignSelf:"flex-start",flexShrink:0,background:`${mod.badgeC}18`,color:mod.badgeC,border:`1px solid ${mod.badgeC}30`}}>{mod.badge}</span>
                  </div>
                </button>
              ))}

              {/* Secretary alert */}
              <button onClick={repSec} style={{width:"100%",padding:14,border:"2px solid #FF1744",borderRadius:14,cursor:"pointer",background:"linear-gradient(135deg,rgba(255,23,68,.18),rgba(140,0,26,.12))",fontFamily:"'Orbitron',monospace",fontSize:11,fontWeight:900,letterSpacing:2,color:"#fff",textTransform:"uppercase",position:"relative",overflow:"hidden",animation:"sec-warn 2.5s ease-in-out infinite",marginBottom:8,transition:"all .25s"}}>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(255,23,68,.12),transparent)",transform:"translateX(-100%)",animation:"sec-scan 2.5s ease-in-out infinite"}}/>
                🚨 &nbsp;REPORTE DIRECTO AL SECRETARIO
              </button>
            </div>

            {/* Vehicle scan */}
            <div style={{padding:"10px 14px",borderTop:"1px solid rgba(200,168,75,.12)"}}>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3A5A7A",letterSpacing:2,textTransform:"uppercase",marginBottom:8,display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:"#00E5FF",boxShadow:"0 0 6px #00E5FF",display:"inline-block"}}/>Reconocimiento Vehicular · C2 + IA
              </div>
              <input
                value={vehPlate}
                onChange={e => setVehPlate(e.target.value)}
                onKeyDown={e => e.key === "Enter" && scanVeh()}
                placeholder="Ingresa placa..."
                style={{width:"100%",background:"rgba(0,0,0,.4)",border:"1px solid rgba(0,229,255,.2)",borderRadius:6,padding:"7px 10px",color:"#D0E8FF",fontFamily:"'Share Tech Mono',monospace",fontSize:11,letterSpacing:2,textTransform:"uppercase",outline:"none",marginBottom:6}}
              />
              <button onClick={scanVeh} style={{width:"100%",padding:8,background:"rgba(0,229,255,.08)",border:"1px solid rgba(0,229,255,.3)",borderRadius:6,color:"#00E5FF",fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,letterSpacing:1,cursor:"pointer",transition:"all .2s",marginBottom:8}}>
                ⚡ ESCANEAR EN RED C2
              </button>
              {vehResult && (
                <div style={{padding:9,background:"rgba(255,23,68,.05)",border:"1px solid rgba(255,23,68,.2)",borderRadius:6,animation:"slide-in .3s ease"}}>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:900,color:"#FF1744",letterSpacing:3}}>{vehResult.plate}</div>
                  <div style={{fontSize:10,color:"#6A90B8",marginTop:3,lineHeight:1.5}}>{vehResult.detail}</div>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#00E5FF",marginTop:4}}>{vehResult.loc}</div>
                  <canvas ref={vehCanvasRef} width={240} height={60} style={{width:"100%",height:60,background:"rgba(0,0,0,.4)",borderRadius:6,marginTop:6,border:"1px solid rgba(200,168,75,.12)"}}/>
                  <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#00E5FF",marginTop:4,letterSpacing:.5}}>IA: MEJORA APLICADA · NITIDEZ 94% · C2 VERIFICADO</div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
