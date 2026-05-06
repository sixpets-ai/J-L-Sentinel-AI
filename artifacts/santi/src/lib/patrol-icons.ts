export interface PatrolUnit {
  id: string;
  type: "MUN" | "SSPC" | "GN" | "SEDENA" | "MARINA" | "FGE";
  label: string;
  color: string;
  glowColor: string;
  sector: string;
  lat: number;
  lng: number;
  dlat: number;
  dlng: number;
  status: "Patrullando" | "En servicio" | "Llamado activo" | "En escena" | "Disponible";
}

export const PATROL_UNITS_CONFIG: Omit<PatrolUnit, "dlat" | "dlng">[] = [
  { id: "U-01", type: "MUN", label: "MUNICIPAL", color: "#1565C0", glowColor: "#1E88E5", sector: "CENTRO", lat: 18.848, lng: -99.236, status: "Patrullando" },
  { id: "U-03", type: "MUN", label: "MUNICIPAL", color: "#1565C0", glowColor: "#1E88E5", sector: "ACATLIPA", lat: 18.840, lng: -99.244, status: "En servicio" },
  { id: "U-07", type: "SSPC", label: "SSPC MOR", color: "#1B1B1B", glowColor: "#C8A84B", sector: "PERIFÉRICO", lat: 18.852, lng: -99.230, status: "Llamado activo" },
  { id: "U-11", type: "GN", label: "G. NACIONAL", color: "#1B5E20", glowColor: "#4CAF50", sector: "BUGAMBILIAS", lat: 18.835, lng: -99.228, status: "Patrullando" },
  { id: "U-14", type: "MARINA", label: "MARINA", color: "#0D47A1", glowColor: "#1565C0", sector: "BLVD. JUÁREZ", lat: 18.830, lng: -99.250, status: "Patrullando" },
];

export function patrolCarSvg(unit: PatrolUnit): string {
  const { color, glowColor, type, id } = unit;
  const uid = id.replace("-", "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="50" viewBox="0 0 30 50">
  <defs>
    <filter id="gf${uid}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <linearGradient id="cg${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${glowColor}" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <path d="M4,11 Q4,5 9,5 L21,5 Q26,5 26,11 L26,39 Q26,45 21,45 L9,45 Q4,45 4,39 Z"
    fill="url(#cg${uid})" filter="url(#gf${uid})"/>
  <rect x="7" y="8" width="16" height="9" rx="2"
    fill="rgba(180,225,255,0.38)" stroke="rgba(200,240,255,0.25)" stroke-width="0.5"/>
  <rect x="7" y="32" width="16" height="8" rx="2"
    fill="rgba(180,225,255,0.28)" stroke="rgba(200,240,255,0.2)" stroke-width="0.5"/>
  <rect x="8" y="2" width="14" height="4" rx="2" fill="rgba(10,10,10,0.92)"/>
  <rect x="9" y="3" width="5" height="2" rx="1" fill="#FF1744" opacity="0.95"/>
  <rect x="16" y="3" width="5" height="2" rx="1" fill="#00E5FF" opacity="0.95"/>
  <rect x="0.5" y="12" width="4" height="7" rx="2" fill="rgba(15,15,15,0.85)"/>
  <rect x="0.5" y="31" width="4" height="7" rx="2" fill="rgba(15,15,15,0.85)"/>
  <rect x="25.5" y="12" width="4" height="7" rx="2" fill="rgba(15,15,15,0.85)"/>
  <rect x="25.5" y="31" width="4" height="7" rx="2" fill="rgba(15,15,15,0.85)"/>
  <rect x="5" y="18" width="20" height="14" rx="1.5" fill="rgba(0,0,0,0.18)"/>
  <text x="15" y="25" font-family="'Share Tech Mono',monospace" font-size="5"
    font-weight="700" text-anchor="middle" fill="rgba(255,255,255,0.88)" letter-spacing="0.5">${type}</text>
  <text x="15" y="31" font-family="'Share Tech Mono',monospace" font-size="6.5"
    font-weight="700" text-anchor="middle" fill="white">${id}</text>
</svg>`;
}

export function getUnitForIncidentType(tipo: string): string {
  const map: Record<string, string> = {
    "Narcomenudeo CJNG": "U-11",
    "Homicidio / Ejecución": "U-07",
    "Disparos activos": "U-07",
    "Extorsión / Gota a Gota": "U-14",
    "Desaparición": "U-07",
    "Violencia familiar": "U-01",
    "Seguridad escolar": "U-03",
    "Robo / Asalto": "U-01",
    "Vehículo sospechoso": "U-03",
  };
  return map[tipo] || "U-01";
}

export function getFolioDependency(tipo: string): string {
  const map: Record<string, string> = {
    "Narcomenudeo CJNG": "FGR",
    "Extorsión / Gota a Gota": "FGR",
    "Homicidio / Ejecución": "SSPC",
    "Disparos activos": "SSPC",
    "Desaparición": "FGE",
  };
  return map[tipo] || "MUN";
}
