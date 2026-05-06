import { pgTable, serial, text, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const incidentReports = pgTable("incident_reports", {
  id: serial("id").primaryKey(),
  folio: text("folio").notNull().unique(),
  tipo: text("tipo").notNull(),
  descripcion: text("descripcion"),
  sector: text("sector"),
  latitud: real("latitud"),
  longitud: real("longitud"),
  agente: text("agente").notNull().default("santi"),
  nivelRiesgo: text("nivel_riesgo"),
  analisis: text("analisis"),
  accionesRecomendadas: text("acciones_recomendadas"),
  unidadesRequeridas: integer("unidades_requeridas"),
  protocolo: text("protocolo"),
  coordinacion: text("coordinacion"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertIncidentReportSchema = createInsertSchema(incidentReports).omit({
  id: true,
  createdAt: true,
});

export type IncidentReport = typeof incidentReports.$inferSelect;
export type InsertIncidentReport = z.infer<typeof insertIncidentReportSchema>;
