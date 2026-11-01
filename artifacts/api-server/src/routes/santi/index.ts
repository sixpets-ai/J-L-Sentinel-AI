import { Router } from "express";
import { db } from "@workspace/db";
import { incidentReports } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  AnalyzeIncidentBody,
  CreateReportBody,
  TranslateSantiUiBody,
  TranslateSantiUiResponse,
} from "@workspace/api-zod";
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

const LANGUAGE_NAMES: Record<string, string> = {
  es: "español de México",
  en: "inglés",
  fr: "francés",
  de: "alemán",
  zh: "chino mandarín simplificado",
  ru: "ruso",
  nahuatl: "náhuatl (variante no especificada)",
  maya: "maya (variante no especificada)",
  mixteco: "mixteco (variante no especificada)",
  zapoteco: "zapoteco (variante no especificada)",
  totonaco: "totonaco (variante no especificada)",
};

router.post("/analyze", async (req, res) => {
  const parsed = AnalyzeIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const { tipo, descripcion, sector, folio, agente, languageCode = "es" } = parsed.data;
  const languageName = LANGUAGE_NAMES[languageCode] ?? LANGUAGE_NAMES.es;

  const prompt = `Consulta enviada a una demostración de SANTI:
FOLIO: ${folio}
TIPO INDICADO: ${tipo}
SECTOR INDICADO: ${sector || "Sin especificar"}
DESCRIPCIÓN NO VERIFICADA: ${descripcion || "Sin descripción adicional"}
AGENTE DE DEMOSTRACIÓN: ${agente || "SANTI"}

Resume de forma neutral solo los datos proporcionados. No los trates como hechos confirmados.
Escribe el resumen en ${languageName}.`;

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
  const languageCode = body?.languageCode ?? "es";

  if (
    typeof agentId !== "string" ||
    !Object.hasOwn(AGENT_CHAT_PROMPTS, agentId) ||
    typeof userMessage !== "string" ||
    !userMessage.trim() ||
    userMessage.length > 2000 ||
    typeof languageCode !== "string" ||
    !Object.hasOwn(LANGUAGE_NAMES, languageCode)
  ) {
    res.status(400).json({ error: "Consulta inválida. Escribe un mensaje de hasta 2,000 caracteres." });
    return;
  }

  const systemPrompt = AGENT_CHAT_PROMPTS[agentId];
  const languageName = LANGUAGE_NAMES[languageCode];
  const indigenousLanguage = ["nahuatl", "maya", "mixteco", "zapoteco", "totonaco"].includes(languageCode);
  const outputInstructions = indigenousLanguage
    ? `Responde de forma breve en ${languageName}, con una traducción asistida y sin inventar una variante regional. Devuelve JSON válido con dos propiedades: "response" con la respuesta en la lengua seleccionada y "speechText" con el equivalente en español de México para lectura de voz. No imites acentos indígenas ni afirmes que la traducción fue validada por hablantes.`
    : `Responde de forma breve en ${languageName}. Devuelve JSON válido con dos propiedades: "response" con tu respuesta y "speechText" con el mismo texto para lectura de voz.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userMessage.trim() }] }],
      config: {
        systemInstruction: `${systemPrompt}\n\n${outputInstructions}`,
        responseMimeType: "application/json",
      },
    });

    let generated: { response?: unknown; speechText?: unknown };
    try {
      generated = JSON.parse(response.text ?? "") as typeof generated;
    } catch {
      throw new Error("Gemini devolvió una respuesta no válida.");
    }
    if (typeof generated.response !== "string" || !generated.response.trim()) {
      throw new Error("Gemini no devolvió una respuesta traducida.");
    }

    res.json({
      response: generated.response.trim().slice(0, 2000),
      speechText: typeof generated.speechText === "string"
        ? generated.speechText.trim().slice(0, 2000)
        : generated.response.trim().slice(0, 2000),
      translationAssisted: indigenousLanguage,
    });
  } catch (err) {
    req.log.error({ err }, "Agent chat failed");
    res.status(500).json({ error: "Error de conexión con el agente IA" });
  }
});

router.post("/translate-ui", async (req, res): Promise<void> => {
  const parsed = TranslateSantiUiBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Idioma o textos de interfaz no válidos." });
    return;
  }

  const { languageCode, strings } = parsed.data;
  const languageName = LANGUAGE_NAMES[languageCode];
  if (!languageName || Object.keys(strings).length === 0) {
    res.status(400).json({ error: "Se requiere un idioma y al menos un texto." });
    return;
  }

  const indigenousLanguage = ["nahuatl", "maya", "mixteco", "zapoteco", "totonaco"].includes(languageCode);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{ text: JSON.stringify(strings) }],
      }],
      config: {
        systemInstruction: indigenousLanguage
          ? `Traduce los valores de este objeto de interfaz al ${languageName}. Mantén exactamente las claves JSON, las cifras y los marcadores de posición. La variante indígena no está especificada: no inventes una variante ni imites acentos; si no puedes traducir una frase con confianza, conserva su valor original. Devuelve únicamente JSON válido con la forma {"translations":{...}}.`
          : `Traduce los valores de este objeto de interfaz al ${languageName}. Mantén exactamente las claves JSON, las cifras y los marcadores de posición. Devuelve únicamente JSON válido con la forma {"translations":{...}}.`,
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
      },
    });

    const generated = JSON.parse(response.text ?? "") as { translations?: unknown };
    const validated = TranslateSantiUiResponse.safeParse(generated);
    if (!validated.success) {
      throw new Error("Gemini devolvió una estructura de traducción no válida.");
    }

    const expectedKeys = Object.keys(strings);
    const translations = validated.data.translations;
    const missingKeys = expectedKeys.filter((key) => !translations[key]?.trim());
    if (missingKeys.length > 0) {
      throw new Error("Gemini omitió algunos textos de la interfaz.");
    }

    res.json({ translations: Object.fromEntries(
      expectedKeys.map((key) => [key, translations[key].trim().slice(0, 500)]),
    ) });
  } catch (err) {
    req.log.error({ err }, "SANTI interface translation failed");
    res.status(502).json({ error: "No se pudo traducir la interfaz. Inténtalo de nuevo con conexión." });
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
      "Robo / Asalto": "#FF6D00", "Observación comunitaria": "#C8A84B",
      "Violencia familiar": "#E91E8C", "Disparos activos": "#FF1744",
      "Extorsión": "#FF6D00", "Persona no localizada": "#9C27B0",
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
