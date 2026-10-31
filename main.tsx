import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// 1. Importar el CSS del mapa (Obligatorio para que se vea bien)
import "leaflet/dist/leaflet.css";

// 2. Fix para los iconos de Leaflet (Evita que las patrullas se vean rotas)
import L from "leaflet";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// 3. Importar QueryClient y QueryClientProvider
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// 4. Crear una instancia del cliente
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* 5. Envolver la App con el Provider */}
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
