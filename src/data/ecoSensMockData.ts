export type Station = {
  id: string;
  name: string;
  location: string;
  sensors: string[];
  status: "online" | "offline";
  createdAt: string;
  voltage: number;
  current: number;
  humidity: number;
  lastSeenMinutes: number;
};

export type Measurement = {
  id: string;
  stationId: string;
  voltage?: number;
  current?: number;
  humidity?: number;
  timestamp: number;
};

export const stations: Station[] = [
  {
    id: "EST-001",
    name: "Estación Prosperina 01",
    location: "Ubicación por confirmar",
    sensors: ["Voltaje (V)", "Corriente (A)", "Humedad (%)"],
    status: "online",
    createdAt: "2026-02-12",
    voltage: 12.6,
    current: 2.4,
    humidity: 68,
    lastSeenMinutes: 1,
  },
  {
    id: "EST-002",
    name: "Estación Prosperina 02",
    location: "Ubicación por confirmar",
    sensors: ["Voltaje (V)", "Corriente (A)", "Humedad (%)"],
    status: "online",
    createdAt: "2026-03-05",
    voltage: 12.3,
    current: 2.1,
    humidity: 74,
    lastSeenMinutes: 2,
  },
  {
    id: "EST-003",
    name: "Estación Prosperina 03",
    location: "Ubicación por confirmar",
    sensors: ["Voltaje (V)", "Corriente (A)", "Humedad (%)"],
    status: "offline",
    createdAt: "2026-04-19",
    voltage: 11.9,
    current: 1.8,
    humidity: 81,
    lastSeenMinutes: 46,
  },
  {
    id: "EST-004",
    name: "Estación Prosperina 04",
    location: "Ubicación por confirmar",
    sensors: ["Voltaje (V)", "Corriente (A)", "Humedad (%)"],
    status: "online",
    createdAt: "2026-05-22",
    voltage: 13.2,
    current: 2.6,
    humidity: 62,
    lastSeenMinutes: 3,
  },
];

const now = Date.now();

const recentMeasurements: Measurement[] = Array.from(
  { length: 4 },
  (_, index) => {
    const hourOffset = (3 - index) * 6;
    const time = new Date(now - hourOffset * 60 * 60 * 1000);
    const hour = time.getHours();
    const dayCurve = Math.sin(((hour - 6) / 24) * Math.PI * 2);

    return stations.map((station, stationIndex) => ({
      id: `measurement-${station.id}-${index + 1}`,
      stationId: station.id,
      voltage: Number(
        (station.voltage + dayCurve * 0.35 + Math.sin(index + stationIndex) * 0.12).toFixed(1),
      ),
      current: Number(
        (station.current + dayCurve * 0.42 + Math.cos(index * 0.7 + stationIndex) * 0.1).toFixed(1),
      ),
      ...(stationIndex === 3 && index === 2
        ? {}
        : {
            humidity: Math.round(
              station.humidity - dayCurve * 5 + Math.sin(index * 0.45 + stationIndex) * 2,
            ),
          }),
      timestamp: station.status === "offline" && index === 3
        ? now - station.lastSeenMinutes * 60 * 1000
        : time.getTime(),
    }));
  },
).flat();

const historicalMeasurements: Measurement[] = Array.from(
  { length: 760 },
  (_, dayIndex) => {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - (760 - dayIndex));
    const dayOfYear = Math.floor(
      (day.getTime() - new Date(day.getFullYear(), 0, 0).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    const seasonalCurve = Math.sin((dayOfYear / 365) * Math.PI * 2);

    return [0, 6, 12, 18].flatMap((hour, sampleIndex) => {
      const timestamp = new Date(day);
      timestamp.setHours(hour);
      if (timestamp.getTime() > now) return [];

      return stations.flatMap((station, stationIndex) => {
        if ((dayIndex + stationIndex * 11) % 79 === 0) return [];

        const missingHumidity = sampleIndex === 2 && (dayIndex + stationIndex * 7) % 127 === 0;
        const variation = Math.sin((dayIndex + stationIndex * 13 + sampleIndex * 3) / 9) * 0.22;

        return [{
          id: `history-${station.id}-${dayIndex}-${sampleIndex}`,
          stationId: station.id,
          voltage: Number((station.voltage + seasonalCurve * 0.32 + variation).toFixed(1)),
          current: Number((station.current + seasonalCurve * 0.28 + variation / 2).toFixed(1)),
          ...(missingHumidity
            ? {}
            : { humidity: Math.round(station.humidity - seasonalCurve * 4 + variation * 5) }),
          timestamp: timestamp.getTime(),
        }];
      });
    });
  },
).flat();

export const measurements: Measurement[] = [
  ...historicalMeasurements,
  ...recentMeasurements,
];

export type DemoAlert = {
  id: string;
  stationId: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  timestamp: number;
  resolved: boolean;
};

export const demoAlerts: DemoAlert[] = [
  {
    id: "alert-001",
    stationId: "EST-003",
    title: "Sin comunicación",
    description: "La estación no envía mediciones desde hace 46 minutos.",
    severity: "critical",
    timestamp: now - 12 * 60 * 1000,
    resolved: false,
  },
  {
    id: "alert-002",
    stationId: "EST-002",
    title: "Humedad elevada",
    description: "Evento de ejemplo para revisar las condiciones del sensor.",
    severity: "warning",
    timestamp: now - 54 * 60 * 1000,
    resolved: false,
  },
  {
    id: "alert-004",
    stationId: "EST-004",
    title: "Registro incompleto",
    description: "Una medición de ejemplo no incluye el valor de humedad.",
    severity: "warning",
    timestamp: now - 6 * 60 * 60 * 1000,
    resolved: false,
  },
  {
    id: "alert-003",
    stationId: "EST-001",
    title: "Conexión restablecida",
    description: "La estación volvió a enviar datos correctamente.",
    severity: "info",
    timestamp: now - 3 * 60 * 60 * 1000,
    resolved: true,
  },
];
