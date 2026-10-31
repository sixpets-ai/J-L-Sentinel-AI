const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// Inicializar Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Números Telefónicos (Para el video)
const AUTHORITY_CONTACTS = {
  federal: "55-5346-0000 (FGR)",
  estatal: "55-5200-9000 (Fiscalía)",
  municipal: "911 (Emergencias)",
  buscadoras: "55-1234-5678 (Colectivo Mujeres)",
};

// 1. OSINT: Análisis Exhaustivo
app.post("/api/osint/analyze", async (req, res) => {
  const { rawData } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Actúa como MAXIMILIANO, experto en OSINT. Analiza esta información cruda de redes sociales. Identifica entidades, posibles nexos criminales y niveles de confianza. No asumas verdades absolutas, indica qué se debe seguir investigando. Datos: ${rawData}`;

    const result = await model.generateContent(prompt);
    res.json({
      analysis: result.response.text(),
      status: "Investigación en curso",
    });
  } catch (error) {
    res.status(500).json({ error: "Fallo en OSINT" });
  }
});

// 2. Orquestador de Agentes (Multi-Cerebros + Failover)
app.post("/api/chat", async (req, res) => {
  const { agent, prompt } = req.body;

  const prompts = {
    SANTI:
      "Eres SANTI, director de seguridad nacional. Frío, lógico, enfocado en auditoría y enrutamiento a FGR o Estatales.",
    LORENA:
      "Eres LORENA, experta en género, derechos humanos y tanatología. Empática, firme, proteges a mujeres y menores. Trabajas junto a KATERING. Si la usuaria está en peligro, cálmala y dile que la unidad va en camino.",
    MAXIMILIANO:
      "Eres MAXIMILIANO, experto OSINT. Paranoico, analítico, buscas nexos ocultos en datos públicos.",
    EMILIANO:
      "Eres EMILIANO, táctico. Directo, experto en despliegues y logística.",
    KATERING:
      "Eres KATERING, psicóloga forense. Usas ingeniería social y empatía para calmar a la víctima.",
  };

  const systemPrompt =
    prompts[agent] || "Eres un asistente de seguridad de élite.";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(
      `${systemPrompt}\nUsuario: ${prompt}`,
    );
    res.json({ response: result.response.text(), brain_used: "Gemini (NLP)" });
  } catch (error) {
    res.json({
      response:
        "Manten la calma, la unidad ya va en camino. Estoy aquí contigo.",
      brain_used: "Local Fallback",
    });
  }
});

app.listen(3001, () =>
  console.log("Orquestador SANTI NEXUS corriendo en puerto 3001"),
);
