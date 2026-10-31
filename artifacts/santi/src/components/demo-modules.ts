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
