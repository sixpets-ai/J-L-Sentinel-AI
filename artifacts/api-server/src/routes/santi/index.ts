import { Router } from "express";
import { db } from "@workspace/db";
import { incidentReports } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { AnalyzeIncidentBody, CreateReportBody } from "@workspace/api-zod";
import { desc, count, eq } from "drizzle-orm";

const router = Router();

const SANTI_SYSTEM_PROMPT = `Eres SANTI, asistente de inteligencia artificial de una demostración interactiva. Los datos enviados por el usuario no están verificados y pueden ser ficticios. No determines culpabilidad, identidad, nivel de riesgo ni credibilidad; no inventes hechos, antecedentes o fuentes. No recomiendes vigilancia, seguimiento, intervención, despliegue de unidades, uso de armas ni decisiones sobre personas. Resume únicamente lo que el usuario escribió, de forma neutral, sin añadir inferencias. Si hay peligro inmediato descrito, limita la respuesta a recomendar que la persona contacte al 911 o a las autoridades correspondientes. Responde únicamente con JSON válido y una propiedad "analisis" de hasta dos oraciones.`;

const AGENT_CHAT_PROMPTS: Record<string, string> = {
  santi: `Eres SANTI, un asistente de inteligencia artificial de una demostración. Habla con calidez, claridad y frases breves; escucha sin juzgar y, cuando ayude, formula una sola pregunta de seguimiento que no solicite datos personales. No finjas ser una persona ni una autoridad. No afirmes tener acceso a bases de datos, cámaras, OSINT, placas, ubicaciones, unidades, alertas o sistemas oficiales en tiempo real. No inventes hechos ni presentes información no verificada como cierta. No des instrucciones de vigilancia, identificación, seguimiento, despliegue de unidades, uso de armas o tácticas operativas. No uses PNL, presión ni engaño para obtener confianza o información. Si hay una emergencia real, indica que contacten directamente al 911 o a las autoridades correspondientes. No solicites datos de incidentes activos. Máximo 3 oraciones, sin markdown.`,
  emiliano: `Eres EMILIANO, un asistente de IA de demostración con tono sereno, directo y respetuoso. Responde brevemente, reconoce la pregunta y haz una sola aclaración no sensible si hace falta. No simules ser agente humano, no afirmes controlar unidades ni tener datos en vivo. No proporciones tácticas, instrucciones de despliegue, vigilancia, seguimiento o uso de armas. No uses PNL, presión ni engaño. Ante una emergencia real, recomienda contactar directamente al 911 o a las autoridades. Máximo 3 oraciones, sin markdown.`,
  maxi: `Eres MAXIMILIANO, un asistente de IA de demostración que explica límites y analiza información con cautela. Habla con naturalidad y brevedad; pregunta solo lo necesario, sin pedir datos personales. No finjas acceso a OSINT, redes sociales, cámaras, placas, expedientes o sistemas oficiales; no inventes patrones ni atribuyas delitos a personas o grupos. No des instrucciones para vigilar, identificar, rastrear o investigar personas. No uses PNL, presión ni engaño. Máximo 3 oraciones, sin markdown.`,
  santiago: `Eres SANTIAGO, un asistente de IA de demostración que habla con claridad, calidez y enfoque preventivo. Responde brevemente y haz una pregunta de seguimiento solo si ayuda a entender una consulta general. No afirmes monitorear escuelas o personas ni tener acceso a datos en vivo. No perfiles ni señales a personas. No uses PNL, presión ni engaño. Ante riesgo inmediato, recomienda contactar directamente al 911 o a las autoridades escolares competentes. Máximo 3 oraciones, sin markdown.`,
  katering: `Eres KATERING, una asistente de IA de demostración con tono cálido, empático y respetuoso. Escucha sin juzgar, usa frases breves y ofrece a la persona elegir si desea continuar; no insistas ni pidas información sensible. No diagnostiques, manipules ni finjas ser psicóloga o personal de emergencia. No uses PNL, presión ni engaño. Si existe peligro inmediato, sugiere contactar directamente al 911 o a un servicio profesional. Máximo 4 oraciones, sin markdown.`,
};

router.post("/analyze", async (req, res) => {
  const parsed = AnalyzeIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const { tipo, descripcion, sector, folio, agente } = parsed.data;

  const prompt = `Consulta enviada a una demostración de SANTI:
FOLIO: ${folio}
TIPO INDICADO: ${tipo}
SECTOR INDICADO: ${sector || "Sin especificar"}
DESCRIPCIÓN NO VERIFICADA: ${descripcion || "Sin descripción adicional"}
AGENTE DE DEMOSTRACIÓN: ${agente || "SANTI"}

Resume de forma neutral solo los datos proporcionados. No los trates como hechos confirmados.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction: SANTI_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
      },
    });

    const rawText = response.text ?? "{}";
    let analysis;
    try {
      const parsed = JSON.parse(rawText) as { analisis?: unknown };
      analysis = typeof parsed.analisis === "string" && parsed.analisis.trim()
        ? parsed.analisis.trim().slice(0, 1000)
        : "No se generó un resumen verificable. Esta demostración no produce decisiones operativas.";
    } catch {
      analysis = "No se generó un resumen verificable. Esta demostración no produce decisiones operativas.";
    }

    res.json({
      folio,
      agente: agente || "santi",
      analisis: analysis,
      nivelRiesgo: "NO EVALUADO",
      accionesRecomendadas: [
        "La información mostrada es una simulación y no está verificada.",
        "Ante una emergencia real, contacta al 911 o a las autoridades correspondientes.",
      ],
      unidadesRequeridas: 0,
      protocolo: "No aplica — demostración",
      coordinacion: "Esta pantalla no inicia coordinación ni despacho real.",
    });
  } catch (err) {
    req.log.error({ err }, "Gemini analysis failed");
    res.status(500).json({ error: "Error al procesar análisis de IA" });
  }
});

/* ── Agent Chat ── */
router.post("/agent-chat", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown> | null;
  const agentId = body?.agentId;
  const userMessage = body?.userMessage;

  if (
    typeof agentId !== "string" ||
    !Object.hasOwn(AGENT_CHAT_PROMPTS, agentId) ||
    typeof userMessage !== "string" ||
    !userMessage.trim() ||
    userMessage.length > 2000
  ) {
    res.status(400).json({ error: "Consulta inválida. Escribe un mensaje de hasta 2,000 caracteres." });
    return;
  }

  const systemPrompt = AGENT_CHAT_PROMPTS[agentId];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userMessage.trim() }] }],
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 512,
      },
    });

    res.json({ response: response.text?.trim() || "Sin respuesta del sistema neuronal." });
  } catch (err) {
    req.log.error({ err }, "Agent chat failed");
    res.status(500).json({ error: "Error de conexión con el agente IA" });
  }
});

/* ── Reports ── */
router.get("/reports", async (req, res) => {
  try {
    const reports = await db.select().from(incidentReports).orderBy(desc(incidentReports.createdAt)).limit(50);
    res.json(reports);
  } catch (err) {
    req.log.error({ err }, "Failed to list reports");
    res.status(500).json({ error: "Error al obtener reportes" });
  }
});

router.post("/reports", async (req, res) => {
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }
  try {
    const [report] = await db.insert(incidentReports).values(parsed.data).returning();
    res.status(201).json(report);
  } catch (err) {
    req.log.error({ err }, "Failed to create report");
    res.status(500).json({ error: "Error al crear reporte" });
  }
});

/* ── Stats ── */
router.get("/stats", async (req, res) => {
  try {
    const [totalResult] = await db.select({ count: count() }).from(incidentReports);
    const [criticalResult] = await db.select({ count: count() }).from(incidentReports).where(eq(incidentReports.nivelRiesgo, "CRÍTICO"));
    const total = totalResult?.count ?? 0;
    const critical = criticalResult?.count ?? 0;
    const recentReports = await db.select().from(incidentReports).orderBy(desc(incidentReports.createdAt)).limit(5);
    const colorMap: Record<string, string> = {
      "Robo / Asalto": "#FF6D00", "Narcomenudeo": "#FF1744",
      "Violencia familiar": "#E91E8C", "Disparos activos": "#FF1744",
      "Extorsión": "#FF6D00", "Desaparición": "#9C27B0",
      "Vehículo sospechoso": "#00E5FF", "Seguridad escolar": "#00E5FF",
      "Amenazas": "#FF1744",
    };
    const recentActivity = recentReports.map((r) => {
      const t = new Date(r.createdAt);
      const hh = String(t.getHours()).padStart(2, "0");
      const mm = String(t.getMinutes()).padStart(2, "0");
      return { time: `${hh}:${mm}`, color: colorMap[r.tipo] || "#C8A84B", message: `${r.folio} · ${r.tipo} · ${r.agente?.toUpperCase()}` };
    });
    res.json({
      totalReports: Number(total),
      criticalAlerts: Number(critical),
      activeUnits: null,
      resolvedToday: null,
      avgResponseMinutes: null,
      topIncidentType: recentReports[0]?.tipo || null,
      recentActivity,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

export default router;
