import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const patrolIcon = L.divIcon({
  className: "custom-icon",
  html: `<div style="font-size: 24px; text-shadow: 0 0 15px #00f;">🚓</div>`,
  iconSize: [30, 30],
});
const officerIcon = L.divIcon({
  className: "custom-icon",
  html: `<div style="font-size: 18px; text-shadow: 0 0 10px #0f0;">👮‍♂️</div>`,
  iconSize: [20, 20],
});

export const TacticalMap = () => {
  return (
    <div style={{ height: "100%", width: "100%", backgroundColor: "#050505" }}>
      <MapContainer
        center={[19.4326, -99.1332]}
        zoom={12}
        style={{
          height: "100%",
          width: "100%",
          filter:
            "invert(100%) hue-rotate(180deg) brightness(90%) contrast(120%)",
        }}
        zoomControl={true}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[19.4326, -99.1332]} icon={patrolIcon}>
          <Popup>Unidad 14 - En ruta</Popup>
        </Marker>
        <Marker position={[19.433, -99.134]} icon={officerIcon}>
          <Popup>Oficiales desplegados</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};
