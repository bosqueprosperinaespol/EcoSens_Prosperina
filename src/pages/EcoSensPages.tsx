import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  demoAlerts,
  measurements,
  stations,
  type DemoAlert,
  type Measurement,
  type Station,
} from "../data/ecoSensMockData";

type MetricKey = "voltage" | "current" | "humidity";
type HeatmapMetric = "power" | "voltage" | "current" | "records";

const metricDetails: Record<MetricKey, { label: string; unit: string; color: string }> = {
  voltage: { label: "Voltaje", unit: "V", color: "#168452" },
  current: { label: "Corriente", unit: "A", color: "#4389d1" },
  humidity: { label: "Humedad", unit: "%", color: "#d7a63b" },
};

function formatTime(timestamp: number, withDate = false) {
  return new Intl.DateTimeFormat("es-EC", {
    ...(withDate ? { day: "2-digit" as const, month: "2-digit" as const, year: "2-digit" as const } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function dateInputValue(timestamp: number) {
  const date = new Date(timestamp);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function formatRelativeTime(minutes: number) {
  if (minutes < 2) return "Hace un minuto";
  return `Hace ${minutes} min`;
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="eco-page-heading">
      <div>
        <p className="eco-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="eco-description">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`eco-panel ${className}`}>
      <div className="eco-panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ online }: { online: boolean }) {
  return (
    <span className={`eco-status ${online ? "is-online" : "is-offline"}`}>
      <span />
      {online ? "Conectada" : "Sin conexión"}
    </span>
  );
}

function MetricCard({
  label,
  value,
  unit,
  tone,
  note,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  tone: "green" | "blue" | "gold" | "slate";
  note: string;
  icon: string;
}) {
  return (
    <article className="eco-metric-card">
      <div className={`eco-metric-icon tone-${tone}`} aria-hidden="true">
        {icon}
      </div>
      <p className="eco-metric-label">{label}</p>
      <div className="eco-metric-value">
        {value}
        {unit && <span>{unit}</span>}
      </div>
      <p className="eco-metric-note">{note}</p>
    </article>
  );
}

function TrendChart({
  data,
  metric,
  compact = false,
}: {
  data: Measurement[];
  metric: MetricKey;
  compact?: boolean;
}) {
  const details = metricDetails[metric];
  const validData = data.filter((item) => Number.isFinite(item[metric]));
  const values = validData.map((item) => item[metric] as number);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 90 - ((value - min) / range) * 74;
    return `${x},${y}`;
  });
  const areaPath = points.length
    ? `M ${points[0]} L ${points.slice(1).join(" L ")} L 100,100 L 0,100 Z`
    : "";
  const linePath = points.length ? `M ${points.join(" L ")}` : "";
  const latest = values[values.length - 1];
  const firstTimestamp = validData[0]?.timestamp;
  const lastTimestamp = validData[validData.length - 1]?.timestamp;
  const showDate = firstTimestamp !== undefined && lastTimestamp !== undefined &&
    lastTimestamp - firstTimestamp > 3 * 24 * 60 * 60 * 1000;
  const axisLabels = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
    const reading = validData[Math.round(fraction * (validData.length - 1))];
    return reading ? new Intl.DateTimeFormat("es-EC", showDate
      ? { day: "2-digit", month: "short" }
      : { hour: "2-digit", minute: "2-digit" }).format(reading.timestamp) : "—";
  });

  return (
    <div className={`eco-chart ${compact ? "eco-chart-compact" : ""}`}>
      <div className="eco-chart-summary">
        <strong>{latest ?? "—"} <span>{details.unit}</span></strong>
        <span>{validData.length ? `${validData.length} registros` : "Sin datos"}</span>
      </div>
      <svg
        className="eco-chart-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Gráfico de ${details.label.toLowerCase()} en las últimas 24 horas`}
      >
        {[20, 45, 70, 95].map((y) => (
          <line key={y} x1="0" x2="100" y1={y} y2={y} className="eco-chart-grid" />
        ))}
        {validData.length > 0 && <path d={areaPath} fill={details.color} opacity="0.09" />}
        {validData.length > 0 && <path d={linePath} fill="none" stroke={details.color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="eco-chart-axis">
        {axisLabels.map((label, index) => <span key={index}>{label}</span>)}
      </div>
    </div>
  );
}

function metricStats(data: Measurement[], metric: MetricKey) {
  const values = data
    .map((item) => item[metric])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (!values.length) return { count: 0, average: null, min: null, max: null };
  return {
    count: values.length,
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function percentChange(previous: number | null, current: number | null) {
  if (previous === null || current === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatChange(change: number | null) {
  if (change === null) return "No disponible";
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function periodMeasurements(start: Date, end: Date, stationId?: string) {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return measurements.filter((reading) =>
    reading.timestamp >= startTime &&
    reading.timestamp < endTime &&
    (!stationId || reading.stationId === stationId),
  );
}

function ComparisonLineChart({
  first,
  second,
  metric,
}: {
  first: Measurement[];
  second: Measurement[];
  metric: MetricKey;
}) {
  const valuesA = first.map((item) => item[metric]).filter((value): value is number => typeof value === "number");
  const valuesB = second.map((item) => item[metric]).filter((value): value is number => typeof value === "number");
  if (!valuesA.length && !valuesB.length) {
    return <p className="eco-empty">No hay mediciones completas para comparar en los periodos elegidos.</p>;
  }
  const max = Math.max(...valuesA, ...valuesB);
  const min = Math.min(...valuesA, ...valuesB);
  const range = max - min || 1;
  const makePath = (values: number[]) => values.map((value, index) => {
    const x = values.length <= 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 90 - ((value - min) / range) * 74;
    return `${index === 0 ? "M" : "L"} ${x},${y}`;
  }).join(" ");

  return (
    <div className="eco-comparison-chart">
      <div className="eco-chart-legend">
        <span><i className="legend-green" /> Periodo A</span>
        <span><i className="legend-blue" /> Periodo B</span>
      </div>
      <svg className="eco-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Comparación de ${metricDetails[metric].label.toLowerCase()} entre dos conjuntos`}>
        {[20, 45, 70, 95].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} className="eco-chart-grid" />)}
        {valuesA.length > 0 && <path d={makePath(valuesA)} fill="none" stroke="#168452" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        {valuesB.length > 0 && <path d={makePath(valuesB)} fill="none" stroke="#4389d1" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  );
}

function StationRows({ data = stations }: { data?: Station[] }) {
  return (
    <div className="eco-table-wrap">
      <table className="eco-table">
        <thead>
          <tr>
            <th>Estación</th>
            <th>Ubicación</th>
            <th>Variables</th>
            <th>Estado</th>
            <th>Última comunicación</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.map((station) => (
            <tr key={station.id}>
              <td>
                <Link className="eco-station-name" to={`/stations/${station.id}`}>
                  <span className="eco-station-avatar">⌁</span>
                  <span>{station.name}<small>{station.id}</small></span>
                </Link>
              </td>
              <td>{station.location}</td>
              <td>{station.sensors.join(" · ")}</td>
              <td><StatusBadge online={station.status === "online"} /></td>
              <td>{formatRelativeTime(station.lastSeenMinutes)}</td>
              <td><Link className="eco-text-link" to={`/stations/${station.id}`}>Ver detalle ↗</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MeasurementRows({
  data,
  metric = "all",
}: {
  data: Measurement[];
  metric?: MetricKey | "all";
}) {
  const metrics = metric === "all" ? (["voltage", "current", "humidity"] as MetricKey[]) : [metric];

  return (
    <div className="eco-table-wrap">
      <table className="eco-table">
        <thead>
          <tr><th>Estación</th><th>Fecha y hora</th>{metrics.map((key) => <th key={key}>{metricDetails[key].label}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((reading) => (
            <tr key={reading.id}>
              <td>{reading.stationId}</td>
              <td>{formatTime(reading.timestamp, true)}</td>
              {metrics.map((key) => <td key={key}>{reading[key] ?? "—"} {metricDetails[key].unit}</td>)}
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={metrics.length + 2}>No hay mediciones en este periodo.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function LatestReadings({ data = measurements }: { data?: Measurement[] }) {
  const latest = [...data].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  return (
    <div className="eco-table-wrap">
      <table className="eco-table">
        <thead><tr><th>Estación</th><th>Voltaje</th><th>Corriente</th><th>Humedad</th><th>Fecha y hora</th></tr></thead>
        <tbody>
          {latest.map((reading) => {
            const station = stations.find((item) => item.id === reading.stationId);
            return (
              <tr key={reading.id}>
                <td>{station?.id ?? reading.stationId}</td>
                <td>{reading.voltage ?? "—"} V</td>
                <td>{reading.current ?? "—"} A</td>
                <td>{reading.humidity ?? "—"}%</td>
                <td>{formatTime(reading.timestamp)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function exportCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadMeasurements(data: Measurement[], filename = "ecosens-mediciones.csv") {
  exportCsv(filename, [
    ["stationId", "voltage", "current", "humidity", "timestamp"],
    ...data.map((item) => [
      item.stationId,
      item.voltage ?? "",
      item.current ?? "",
      item.humidity ?? "",
      new Date(item.timestamp).toISOString(),
    ]),
  ]);
}

export function EcoDashboard() {
  const onlineStations = stations.filter((station) => station.status === "online");
  const average = (key: MetricKey) =>
    (onlineStations.reduce((sum, station) => sum + station[key], 0) / onlineStations.length).toFixed(1);
  const firstStationMeasurements = measurements.filter((item) =>
    item.stationId === "EST-001" && item.timestamp >= Date.now() - 24 * 60 * 60 * 1000,
  );
  const recent = [...measurements]
    .filter((item) => item.timestamp >= Date.now() - 24 * 60 * 60 * 1000)
    .sort((a, b) => b.timestamp - a.timestamp);
  const incompleteCount = recent.filter((reading) =>
    (["voltage", "current", "humidity"] as MetricKey[]).some((key) => reading[key] === undefined),
  ).length;

  return (
    <div className="eco-page">
      <PageHeading
        eyebrow={new Intl.DateTimeFormat("es-EC", { weekday: "long", day: "numeric", month: "long" }).format(Date.now())}
        title="Resumen general"
        description="Una vista rápida del estado de las estaciones y sus últimas mediciones."
        action={<span className="eco-demo-label"><span /> Datos simulados</span>}
      />
      <div className="eco-metric-grid">
        <MetricCard label="Estaciones registradas" value={String(stations.length)} tone="green" note="En el sistema" icon="⌖" />
        <MetricCard label="Estaciones conectadas" value={`${onlineStations.length} de ${stations.length}`} tone="blue" note="Actualización reciente" icon="◉" />
        <MetricCard label="Voltaje promedio" value={average("voltage")} unit="V" tone="gold" note="Estaciones conectadas" icon="ϟ" />
        <MetricCard label="Corriente promedio" value={average("current")} unit="A" tone="blue" note="Estaciones conectadas" icon="↗" />
        <MetricCard label="Humedad promedio" value={average("humidity")} unit="%" tone="slate" note="Estaciones conectadas" icon="≈" />
      </div>

      <div className="eco-dashboard-grid">
        <Panel title="Tendencia de mediciones" subtitle="Estación Prosperina 01 · últimas 24 horas" className="eco-panel-chart">
          <div className="eco-chart-legend">
            <span><i className="legend-green" /> Voltaje</span>
            <span><i className="legend-blue" /> Corriente</span>
            <span><i className="legend-gold" /> Humedad</span>
          </div>
          <div className="eco-trend-grid">
            {(["voltage", "current", "humidity"] as MetricKey[]).map((metric) => (
              <div key={metric} className="eco-mini-trend">
                <p>{metricDetails[metric].label}</p>
                <TrendChart data={firstStationMeasurements} metric={metric} compact />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Resumen de estaciones" subtitle="Estado de comunicación">
          <div className="eco-station-list">
            {stations.map((station) => (
              <Link to={`/stations/${station.id}`} className="eco-station-list-item" key={station.id}>
                <span className={`eco-station-symbol ${station.status === "online" ? "" : "offline"}`}>⌁</span>
                <span className="eco-station-list-info"><strong>{station.name}</strong><small>{station.location}</small></span>
                <StatusBadge online={station.status === "online"} />
              </Link>
            ))}
          </div>
          <Link className="eco-panel-link" to="/stations">Ver todas las estaciones <span>→</span></Link>
        </Panel>
        <Panel title="Mediciones recientes" subtitle="Últimos datos recibidos" className="eco-panel-wide">
          <LatestReadings data={recent.slice(0, 5)} />
        </Panel>
        <Link className="eco-system-summary" to="/insights">
          <span className="eco-system-summary-icon">✳</span>
          <span><strong>Estado general del sistema</strong><small>{onlineStations.length} de {stations.length} estaciones conectadas · {incompleteCount} registros incompletos en las últimas 24 horas</small></span>
          <span className="eco-system-summary-action">Ver resumen →</span>
        </Link>
      </div>
    </div>
  );
}

export function StationsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = stations.filter((station) => {
    const matchesText = `${station.name} ${station.id} ${station.location}`.toLowerCase().includes(query.toLowerCase());
    return matchesText && (status === "all" || station.status === status);
  });

  return (
    <div className="eco-page">
      <PageHeading eyebrow="Inventario · datos demostrativos" title="Estaciones" description="Consulta el identificador, la ubicación registrada, las variables disponibles y el estado de conexión." action={<span className="eco-count-label">{stations.length} estaciones de ejemplo</span>} />
      <Panel title="Todas las estaciones" subtitle="Las ubicaciones se completarán cuando se registren los datos de las estaciones reales">
        <div className="eco-filters">
          <input className="eco-input eco-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, código o ubicación" aria-label="Buscar estaciones" />
          <select className="eco-input" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por estado">
            <option value="all">Todos los estados</option><option value="online">Conectadas</option><option value="offline">Sin conexión</option>
          </select>
        </div>
        <StationRows data={filtered} />
      </Panel>
      {filtered.length === 0 && <p className="eco-empty">No se encontraron estaciones.</p>}
    </div>
  );
}

export function StationDetailPage() {
  const { stationId = "" } = useParams();
  const navigate = useNavigate();
  const station = stations.find((item) => item.id === stationId);
  if (!station) {
    return <div className="eco-page"><PageHeading eyebrow="Estaciones" title="Estación no encontrada" description="No existe una estación con ese código en los datos de demostración." /><Link className="eco-button" to="/stations">Volver a estaciones</Link></div>;
  }
  const readings = measurements.filter((item) => item.stationId === station.id).sort((a, b) => b.timestamp - a.timestamp);
  const latest = readings[0];
  const recentTrend = readings.filter((item) => item.timestamp >= Date.now() - 24 * 60 * 60 * 1000).reverse();
  return (
    <div className="eco-page">
      <button className="eco-back-button" onClick={() => navigate("/stations")}>← Volver a estaciones</button>
      <PageHeading eyebrow={station.id} title={station.name} description={station.location} action={<StatusBadge online={station.status === "online"} />} />
      <div className="eco-metric-grid">
        <MetricCard label={station.status === "online" ? "Voltaje actual" : "Último voltaje"} value={String(latest?.voltage ?? station.voltage)} unit="V" tone="green" note={station.status === "online" ? "Última lectura" : `Antes de la desconexión · ${formatRelativeTime(station.lastSeenMinutes)}`} icon="ϟ" />
        <MetricCard label={station.status === "online" ? "Corriente actual" : "Última corriente"} value={String(latest?.current ?? station.current)} unit="A" tone="blue" note={station.status === "online" ? "Última lectura" : `Antes de la desconexión · ${formatRelativeTime(station.lastSeenMinutes)}`} icon="↗" />
        <MetricCard label={station.status === "online" ? "Humedad actual" : "Última humedad"} value={String(latest?.humidity ?? station.humidity)} unit="%" tone="gold" note={station.status === "online" ? "Última lectura" : `Antes de la desconexión · ${formatRelativeTime(station.lastSeenMinutes)}`} icon="≈" />
        <MetricCard label="Sensores activos" value={String(station.sensors.length)} tone="slate" note="Configurados en estación" icon="◉" />
      </div>
      <Panel title="Tendencia de mediciones" subtitle="Últimas 24 horas">
        <div className="eco-detail-charts">
          {(["voltage", "current", "humidity"] as MetricKey[]).map((metric) => (
            <div className="eco-detail-chart" key={metric}><h3>{metricDetails[metric].label}</h3><TrendChart data={recentTrend} metric={metric} /></div>
          ))}
        </div>
      </Panel>
      <Panel title="Historial reciente" subtitle="Registros asociados a esta estación">
        <MeasurementRows data={readings.slice(0, 8)} />
      </Panel>
    </div>
  );
}

export function MonitoringPage() {
  const [stationId, setStationId] = useState("EST-001");
  const station = stations.find((item) => item.id === stationId) ?? stations[0];
  const readings = measurements.filter((item) => item.stationId === station.id).sort((a, b) => b.timestamp - a.timestamp);
  const latest = readings[0];
  const recentTrend = readings.filter((item) => item.timestamp >= Date.now() - 24 * 60 * 60 * 1000).reverse();

  return (
    <div className="eco-page">
      <PageHeading eyebrow="Datos simulados" title="Monitoreo en tiempo real" description="Consulta las últimas lecturas de una estación y revisa sus tendencias recientes." action={<span className="eco-live-indicator"><i /> Prototipo de demostración</span>} />
      <div className="eco-monitor-toolbar">
        <label htmlFor="monitor-station">Estación seleccionada</label>
        <select id="monitor-station" className="eco-input" value={stationId} onChange={(event) => setStationId(event.target.value)}>
          {stations.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}
        </select>
        <StatusBadge online={station.status === "online"} />
        <span className="eco-updated">Última actualización: {formatTime(latest?.timestamp ?? Date.now())}</span>
      </div>
      <div className="eco-metric-grid">
        <MetricCard label={station.status === "online" ? "Voltaje actual" : "Último voltaje"} value={String(latest?.voltage ?? station.voltage)} unit="V" tone="green" note={station.status === "online" ? "Última lectura" : `Antes de la desconexión · ${formatRelativeTime(station.lastSeenMinutes)}`} icon="ϟ" />
        <MetricCard label={station.status === "online" ? "Corriente actual" : "Última corriente"} value={String(latest?.current ?? station.current)} unit="A" tone="blue" note={station.status === "online" ? "Última lectura" : `Antes de la desconexión · ${formatRelativeTime(station.lastSeenMinutes)}`} icon="↗" />
        <MetricCard label={station.status === "online" ? "Humedad actual" : "Última humedad"} value={String(latest?.humidity ?? station.humidity)} unit="%" tone="gold" note={station.status === "online" ? "Última lectura" : `Antes de la desconexión · ${formatRelativeTime(station.lastSeenMinutes)}`} icon="≈" />
        <MetricCard label="Comunicación" value={station.status === "online" ? "Activa" : "Interrumpida"} tone="slate" note={`Última señal · ${formatRelativeTime(station.lastSeenMinutes)}`} icon="◉" />
      </div>
      <Panel title={`Tendencia · ${station.name}`} subtitle="Valores simulados para las últimas 24 horas">
        <div className="eco-detail-charts">
          {(["voltage", "current", "humidity"] as MetricKey[]).map((metric) => (
            <div className="eco-detail-chart" key={metric}><h3>{metricDetails[metric].label}</h3><TrendChart data={recentTrend} metric={metric} /></div>
          ))}
        </div>
      </Panel>
      <Panel title="Últimas mediciones" subtitle="Registros más recientes recibidos">
        <MeasurementRows data={readings.slice(0, 6)} />
      </Panel>
    </div>
  );
}

export function HistoryPage() {
  const [stationId, setStationId] = useState("all");
  const [metric, setMetric] = useState<MetricKey | "all">("all");
  const [granularity, setGranularity] = useState("custom");
  const [startDate, setStartDate] = useState(() => dateInputValue(Date.now() - 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(() => dateInputValue(Date.now()));
  const [heatmapMetric, setHeatmapMetric] = useState<HeatmapMetric>("power");
  const [heatmapMonth, setHeatmapMonth] = useState(() => dateInputValue(Date.now()).slice(0, 7));
  const filtered = useMemo(() => measurements.filter((item) => {
    const date = dateInputValue(item.timestamp);
    return (stationId === "all" || item.stationId === stationId) && date >= startDate && date <= endDate;
  }).sort((a, b) => b.timestamp - a.timestamp), [stationId, startDate, endDate]);
  const heatmapMonthDate = new Date(`${heatmapMonth}-01T12:00:00`);
  const heatmapYear = heatmapMonthDate.getFullYear();
  const heatmapMonthIndex = heatmapMonthDate.getMonth();
  const heatmapDaysInMonth = new Date(heatmapYear, heatmapMonthIndex + 1, 0).getDate();
  const heatmapCells = Array.from({ length: heatmapDaysInMonth }, (_, index) => {
    const date = new Date(heatmapYear, heatmapMonthIndex, index + 1, 12);
    const dateString = dateInputValue(date.getTime());
    const readings = measurements.filter((item) =>
      dateInputValue(item.timestamp) === dateString &&
      (stationId === "all" || item.stationId === stationId),
    );
    const voltageValues = readings.map((item) => item.voltage).filter((value): value is number => typeof value === "number");
    const currentValues = readings.map((item) => item.current).filter((value): value is number => typeof value === "number");
    const powerValues = readings
      .filter((item) => typeof item.voltage === "number" && typeof item.current === "number")
      .map((item) => (item.voltage as number) * (item.current as number));
    const average = (values: number[]) => values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
    const value = heatmapMetric === "power"
      ? average(powerValues)
      : heatmapMetric === "voltage"
        ? average(voltageValues)
        : heatmapMetric === "current"
          ? average(currentValues)
          : readings.length;
    return {
      date,
      dateString,
      count: readings.length,
      value,
      future: date.getTime() > Date.now(),
    };
  });
  const heatmapValues = heatmapCells
    .map((cell) => cell.value)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const heatmapMax = heatmapValues.length ? Math.max(...heatmapValues) : 1;
  const heatmapLevel = (value: number | null) => {
    if (value === null || value <= 0) return 0;
    const ratio = value / heatmapMax;
    if (ratio >= 0.8) return 5;
    if (ratio >= 0.58) return 4;
    if (ratio >= 0.38) return 3;
    if (ratio >= 0.2) return 2;
    return 1;
  };
  const heatmapMetricLabels: Record<HeatmapMetric, string> = {
    power: "Índice de potencia",
    voltage: "Voltaje promedio",
    current: "Corriente promedio",
    records: "Cantidad de registros",
  };
  const heatmapUnit = heatmapMetric === "power"
    ? "W estimados"
    : heatmapMetric === "voltage"
      ? "V"
      : heatmapMetric === "current"
        ? "A"
        : "registros";
  const applyGranularity = (value: string) => {
    setGranularity(value);
    if (value === "custom") return;
    const today = new Date();
    const end = dateInputValue(today.getTime());
    let start = end;
    if (value === "day") {
      setStartDate(end);
      setEndDate(end);
      return;
    }
    if (value === "week") {
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
      start = dateInputValue(monday.getTime());
    }
    if (value === "month") start = dateInputValue(new Date(today.getFullYear(), today.getMonth(), 1).getTime());
    if (value === "year") start = dateInputValue(new Date(today.getFullYear(), 0, 1).getTime());
    setStartDate(start);
    setEndDate(end);
  };
  const selectCalendarDay = (date: string) => {
    setGranularity("custom");
    setStartDate(date);
    setEndDate(date);
  };
  const incompleteCount = filtered.filter((reading) =>
    (["voltage", "current", "humidity"] as MetricKey[]).some((key) => reading[key] === undefined),
  ).length;

  return (
    <div className="eco-page">
      <PageHeading eyebrow="Explorador de datos" title="Historial y calendario" description="Consulta registros por día, semana, mes o año; revisa qué días tienen datos y filtra por estación y variable." action={<div className="eco-report-actions"><span className="eco-demo-label"><span /> Datos simulados</span><button className="eco-button" onClick={() => downloadMeasurements(filtered)}>↓ Exportar CSV</button></div>} />
      <Panel title="Filtros de consulta" subtitle="Selecciona las estaciones y el periodo de interés">
        <div className="eco-filters eco-history-filters">
          <label>Estación<select className="eco-input" value={stationId} onChange={(event) => setStationId(event.target.value)}><option value="all">Todas las estaciones</option>{stations.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label>
          <label>Variable<select className="eco-input" value={metric} onChange={(event) => setMetric(event.target.value as MetricKey | "all")}><option value="all">Todas las variables</option><option value="voltage">Voltaje</option><option value="current">Corriente</option><option value="humidity">Humedad</option></select></label>
          <label>Periodo<select className="eco-input" value={granularity} onChange={(event) => applyGranularity(event.target.value)}><option value="day">Hoy</option><option value="week">Esta semana</option><option value="month">Este mes</option><option value="year">Este año</option><option value="custom">Personalizado</option></select></label>
          <label>Desde<input className="eco-input" type="date" value={startDate} max={endDate} onChange={(event) => { setGranularity("custom"); setStartDate(event.target.value); }} /></label>
          <label>Hasta<input className="eco-input" type="date" value={endDate} min={startDate} onChange={(event) => { setGranularity("custom"); setEndDate(event.target.value); }} /></label>
        </div>
      </Panel>
      <div className="eco-history-grid">
        <Panel
          title="Calendario de intensidad mensual"
          subtitle={new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric" }).format(heatmapMonthDate)}
          action={<div className="eco-calendar-controls">
            <button
              aria-label="Mes anterior"
              onClick={() => setHeatmapMonth(dateInputValue(addMonths(heatmapMonthDate, -1).getTime()).slice(0, 7))}
            >←</button>
            <input
              type="month"
              className="eco-input eco-month-picker"
              value={heatmapMonth}
              max={dateInputValue(Date.now()).slice(0, 7)}
              onChange={(event) => setHeatmapMonth(event.target.value)}
              aria-label="Seleccionar mes"
            />
            <button
              aria-label="Mes siguiente"
              disabled={heatmapMonth >= dateInputValue(Date.now()).slice(0, 7)}
              onClick={() => setHeatmapMonth(dateInputValue(addMonths(heatmapMonthDate, 1).getTime()).slice(0, 7))}
            >→</button>
          </div>}
          className="eco-calendar-panel eco-month-heatmap-panel"
        >
          <div className="eco-month-toolbar">
            <label className="eco-heatmap-select">
              <span>Medir por</span>
              <select className="eco-input" value={heatmapMetric} onChange={(event) => setHeatmapMetric(event.target.value as HeatmapMetric)}>
                <option value="power">Índice de potencia</option>
                <option value="voltage">Voltaje promedio</option>
                <option value="current">Corriente promedio</option>
                <option value="records">Cantidad de registros</option>
              </select>
            </label>
            <span>{heatmapCells.filter((cell) => cell.count > 0).length} días con registros</span>
          </div>
          <div className="eco-month-calendar">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
              <span className="eco-month-weekday" key={day}>{day}</span>
            ))}
            {Array.from({ length: (new Date(heatmapYear, heatmapMonthIndex, 1).getDay() + 6) % 7 }, (_, index) => (
              <span className="eco-month-empty" key={`empty-${index}`} />
            ))}
            {heatmapCells.map((cell) => (
              <button
                key={cell.dateString}
                disabled={cell.future}
                className={`eco-month-day heatmap-level-${cell.future ? 0 : heatmapLevel(cell.value)} ${cell.dateString === startDate && startDate === endDate ? "is-selected" : ""}`}
                onClick={() => selectCalendarDay(cell.dateString)}
                aria-label={`${cell.dateString}: ${cell.value === null ? "sin datos" : `${cell.value.toFixed(heatmapMetric === "records" ? 0 : 1)} ${heatmapUnit}`}`}
                title={cell.future
                  ? "Fecha futura"
                  : `${new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", year: "numeric" }).format(cell.date)} · ${cell.value === null ? "Sin datos" : `${heatmapMetricLabels[heatmapMetric]}: ${cell.value.toFixed(heatmapMetric === "records" ? 0 : 1)} ${heatmapUnit}`} · ${cell.count} registro(s)`}
              >
                <span className="eco-month-day-number">{cell.date.getDate()}</span>
                <strong>
                  {cell.value === null ? "—" : `${cell.value.toFixed(heatmapMetric === "records" ? 0 : 1)}${heatmapMetric === "records" ? "" : ` ${heatmapUnit}`}`}
                </strong>
                <small>{cell.count ? `${cell.count} lecturas` : cell.future ? "" : "Sin datos"}</small>
              </button>
            ))}
          </div>
          <div className="eco-heatmap-footer">
            <div className="eco-calendar-legend">
              <span><i className="heatmap-level-0" /> Sin datos</span>
              <span><i className="heatmap-level-1" /> Menor</span>
              <span><i className="heatmap-level-5" /> Mayor</span>
              <span>Color: {heatmapMetricLabels[heatmapMetric]}</span>
            </div>
            <div className="eco-heatmap-scale" aria-label="Escala de intensidad">{[0, 1, 2, 3, 4, 5].map((level) => <i key={level} className={`heatmap-level-${level}`} />)}</div>
          </div>
          <p className="eco-calendar-note">
            {heatmapMetric === "power"
              ? "El índice diario usa V×A como referencia de potencia instantánea; no equivale a energía acumulada en Wh hasta integrar la medición durante el tiempo."
              : "La escala se calcula entre los valores disponibles del periodo seleccionado. Cada celda representa el promedio diario."}
          </p>
        </Panel>
        <Panel title="Disponibilidad del periodo" subtitle={`${filtered.length} registros · ${incompleteCount} incompletos`}>
          <div className="eco-availability-number">{filtered.length}<span>registros</span></div>
          <div className="eco-availability-track"><span style={{ width: filtered.length ? "100%" : "0%" }} /></div>
          <div className="eco-availability-legend"><span>Registros completos</span><strong>{filtered.length - incompleteCount}</strong></div>
          <div className="eco-availability-legend"><span>Registros incompletos</span><strong className={incompleteCount ? "is-warning" : ""}>{incompleteCount}</strong></div>
          <p className="eco-calendar-note">El porcentaje frente a lecturas esperadas estará disponible al definir la frecuencia de muestreo de cada estación.</p>
        </Panel>
      </div>
      <Panel title={`Tendencia histórica · ${metric === "all" ? "Voltaje" : metricDetails[metric].label}`} subtitle={`${filtered.length} registros en el rango`}>
        <TrendChart data={[...filtered].reverse()} metric={metric === "all" ? "voltage" : metric} />
      </Panel>
      <Panel title="Registros" subtitle="Las mediciones incompletas muestran el campo faltante como —">
        <MeasurementRows data={filtered} metric={metric} />
      </Panel>
    </div>
  );
}

export function AnalysisPage() {
  const [mode, setMode] = useState("months");
  const [metric, setMetric] = useState<MetricKey>("voltage");
  const [stationA, setStationA] = useState(stations[0].id);
  const [stationB, setStationB] = useState(stations[1].id);
  const [rangeStart, setRangeStart] = useState(() => dateInputValue(Date.now() - 29 * 24 * 60 * 60 * 1000));
  const [rangeEnd, setRangeEnd] = useState(() => dateInputValue(Date.now()));
  const [periodAStart, setPeriodAStart] = useState(() => dateInputValue(Date.now() - 59 * 24 * 60 * 60 * 1000));
  const [periodAEnd, setPeriodAEnd] = useState(() => dateInputValue(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [periodBStart, setPeriodBStart] = useState(() => dateInputValue(Date.now() - 29 * 24 * 60 * 60 * 1000));
  const [periodBEnd, setPeriodBEnd] = useState(() => dateInputValue(Date.now()));
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const previousMonthStart = addMonths(currentMonthStart, -1);
  const previousMonthEnd = new Date(previousMonthStart);
  previousMonthEnd.setDate(Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate()) + 1);

  const dateWindow = (start: string, end: string) => {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    endDate.setDate(endDate.getDate() + 1);
    return { start: startDate, end: endDate };
  };
  const periodA = mode === "months"
    ? periodMeasurements(previousMonthStart, previousMonthEnd, stationA)
    : mode === "custom"
      ? (() => {
          const window = dateWindow(periodAStart, periodAEnd);
          return periodMeasurements(window.start, window.end, stationA);
        })()
      : (() => {
          const window = dateWindow(rangeStart, rangeEnd);
          return periodMeasurements(window.start, window.end, stationA);
        })();
  const periodB = mode === "months"
    ? periodMeasurements(currentMonthStart, tomorrow, stationA)
    : mode === "custom"
      ? (() => {
          const window = dateWindow(periodBStart, periodBEnd);
          return periodMeasurements(window.start, window.end, stationA);
        })()
      : (() => {
          const window = dateWindow(rangeStart, rangeEnd);
          return periodMeasurements(window.start, window.end, stationB);
        })();
  const statsA = metricStats(periodA, metric);
  const statsB = metricStats(periodB, metric);
  const change = percentChange(statsA.average, statsB.average);
  const periodLabels = mode === "months"
    ? [
        new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric" }).format(previousMonthStart),
        new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric" }).format(currentMonthStart),
      ]
    : mode === "custom"
      ? [`${periodAStart} — ${periodAEnd}`, `${periodBStart} — ${periodBEnd}`]
      : [`${stations.find((item) => item.id === stationA)?.name} · ${rangeStart} — ${rangeEnd}`, `${stations.find((item) => item.id === stationB)?.name} · ${rangeStart} — ${rangeEnd}`];
  const labelA = mode === "stations" ? stations.find((item) => item.id === stationA)?.name ?? "Estación A" : "Periodo A";
  const labelB = mode === "stations" ? stations.find((item) => item.id === stationB)?.name ?? "Estación B" : "Periodo B";
  const downloadComparison = () => {
    const metrics = (["voltage", "current", "humidity"] as MetricKey[]).map((key) => {
      const a = metricStats(periodA, key);
      const b = metricStats(periodB, key);
      return [
        metricDetails[key].label,
        metricDetails[key].unit,
        a.average?.toFixed(2) ?? "",
        b.average?.toFixed(2) ?? "",
        formatChange(percentChange(a.average, b.average)),
      ];
    });
    exportCsv("ecosens-comparacion.csv", [
      ["Variable", "Unidad", labelA, labelB, "Variación porcentual"],
      ...metrics,
    ]);
  };

  return (
    <div className="eco-page">
      <PageHeading
        eyebrow="Análisis histórico"
        title="Análisis y comparaciones"
        description="Compara meses, periodos personalizados o estaciones mediante promedios, extremos, variaciones y tendencias."
        action={<button className="eco-button" onClick={downloadComparison}>↓ Exportar comparación CSV</button>}
      />
      <Panel title="Definir comparación" subtitle="Elige qué periodos o estaciones quieres contrastar">
        <div className="eco-filters eco-analysis-filters">
          <label>Tipo de comparación
            <select className="eco-input" value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="months">Mes actual vs mes anterior</option>
              <option value="custom">Periodos personalizados</option>
              <option value="stations">Comparar estaciones</option>
            </select>
          </label>
          <label>Variable
            <select className="eco-input" value={metric} onChange={(event) => setMetric(event.target.value as MetricKey)}>
              <option value="voltage">Voltaje (V)</option><option value="current">Corriente (A)</option><option value="humidity">Humedad (%)</option>
            </select>
          </label>
          {mode !== "custom" && <>
            <label>{mode === "stations" ? "Estación A" : "Estación"}
              <select className="eco-input" value={stationA} onChange={(event) => setStationA(event.target.value)}>{stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select>
            </label>
            {mode === "stations" && <label>Estación B
              <select className="eco-input" value={stationB} onChange={(event) => setStationB(event.target.value)}>{stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select>
            </label>}
          </>}
          {mode === "custom" && <div className="eco-custom-periods">
            <fieldset><legend>Periodo A</legend><label>Desde<input className="eco-input" type="date" value={periodAStart} max={periodAEnd} onChange={(event) => setPeriodAStart(event.target.value)} /></label><label>Hasta<input className="eco-input" type="date" value={periodAEnd} min={periodAStart} onChange={(event) => setPeriodAEnd(event.target.value)} /></label></fieldset>
            <fieldset><legend>Periodo B</legend><label>Desde<input className="eco-input" type="date" value={periodBStart} max={periodBEnd} onChange={(event) => setPeriodBStart(event.target.value)} /></label><label>Hasta<input className="eco-input" type="date" value={periodBEnd} min={periodBStart} onChange={(event) => setPeriodBEnd(event.target.value)} /></label></fieldset>
          </div>}
          {mode === "stations" && <div className="eco-analysis-range"><label>Desde<input className="eco-input" type="date" value={rangeStart} max={rangeEnd} onChange={(event) => setRangeStart(event.target.value)} /></label><label>Hasta<input className="eco-input" type="date" value={rangeEnd} min={rangeStart} onChange={(event) => setRangeEnd(event.target.value)} /></label></div>}
        </div>
      </Panel>
      <div className="eco-comparison-heading"><span><i className="legend-green" /> {labelA}: {periodLabels[0]}</span><b>VS</b><span><i className="legend-blue" /> {labelB}: {periodLabels[1]}</span><span className="eco-demo-label"><span /> Datos simulados</span></div>
      <Panel title={`Comparación de ${metricDetails[metric].label.toLowerCase()}`} subtitle={`Promedios de ${statsA.count} y ${statsB.count} mediciones completas`}>
        <div className="eco-detail-charts eco-analysis-content">
          <ComparisonLineChart first={periodA} second={periodB} metric={metric} />
          <div className="eco-comparison-result">
            <p>Variación del promedio</p>
            <strong className={change !== null && change > 0 ? "is-positive" : change !== null && change < 0 ? "is-negative" : ""}>{formatChange(change)}</strong>
            <span>{change === null ? "No se puede calcular con la referencia disponible." : change > 0 ? "El promedio del periodo B aumentó." : change < 0 ? "El promedio del periodo B disminuyó." : "No se observa variación entre promedios."}</span>
          </div>
        </div>
      </Panel>
      <Panel title="Resumen estadístico" subtitle="Los valores se calculan con las mediciones disponibles para la variable seleccionada">
        <div className="eco-table-wrap"><table className="eco-table eco-comparison-table">
          <thead><tr><th>Estadística</th><th>{labelA}</th><th>{labelB}</th><th>Variación</th></tr></thead>
          <tbody>
            {([
              ["Promedio", statsA.average, statsB.average],
              ["Máximo", statsA.max, statsB.max],
              ["Mínimo", statsA.min, statsB.min],
            ] as const).map(([name, valueA, valueB]) => <tr key={name}><td>{name}</td><td>{valueA?.toFixed(2) ?? "—"} {metricDetails[metric].unit}</td><td>{valueB?.toFixed(2) ?? "—"} {metricDetails[metric].unit}</td><td>{formatChange(percentChange(valueA, valueB))}</td></tr>)}
          </tbody>
        </table></div>
      </Panel>
      <p className="eco-note">Las comparaciones mensuales contrastan el mes anterior y el actual hasta el mismo día del mes. Si el promedio de referencia es cero o no hay datos, la variación porcentual no se define.</p>
    </div>
  );
}

export function InsightsPage() {
  const now = new Date();
  const currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const currentStart = new Date(currentEnd);
  currentStart.setDate(currentStart.getDate() - 30);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - 30);
  const previousEnd = currentStart;
  const currentMeasurements = periodMeasurements(currentStart, currentEnd);
  const previousMeasurements = periodMeasurements(previousStart, previousEnd);

  const summaries = stations.map((station) => {
    const current = currentMeasurements.filter((item) => item.stationId === station.id);
    const previous = previousMeasurements.filter((item) => item.stationId === station.id);
    const incomplete = current.filter((item) =>
      (["voltage", "current", "humidity"] as MetricKey[]).some((key) => item[key] === undefined),
    ).length;
    const readings = (["voltage", "current", "humidity"] as MetricKey[]).map((key) => {
      const before = metricStats(previous, key);
      const after = metricStats(current, key);
      return {
        key,
        ...after,
        change: percentChange(before.average, after.average),
      };
    });
    return { station, current, previous, incomplete, readings };
  });

  return (
    <div className="eco-page">
      <PageHeading
        eyebrow="Síntesis estadística · Prototipo"
        title="Resumen inteligente"
        description="Resumen automático por reglas estadísticas: tendencias, variaciones, incidencias y completitud de registros."
        action={<span className="eco-demo-label"><span /> Reglas estadísticas · sin IA</span>}
      />
      <Panel title="Resumen del periodo" subtitle={`${dateInputValue(currentStart.getTime())} — ${dateInputValue(currentEnd.getTime() - 1)} frente a los 30 días anteriores`}>
        <div className="eco-insight-grid">
          {summaries.map(({ station, current, incomplete, readings }) => (
            <article className="eco-insight-card" key={station.id}>
              <div className="eco-insight-card-heading"><span className={`eco-station-symbol ${station.status === "online" ? "" : "offline"}`}>⌁</span><div><h3>{station.name}</h3><span>{station.id} · <StatusBadge online={station.status === "online"} /></span></div></div>
              <p className="eco-insight-summary">
                {current.length
                  ? `Se recibieron ${current.length} mediciones en el periodo. ${incomplete ? `${incomplete} registro(s) presentan campos incompletos.` : "Los registros del periodo incluyen las variables previstas."}`
                  : "No se encontraron mediciones en el periodo seleccionado."}
                {" "}{station.status === "offline" ? "La estación figura sin comunicación." : "La estación figura conectada."}
              </p>
              <div className="eco-insight-metrics">
                {readings.map((item) => <div key={item.key}><span>{metricDetails[item.key].label}</span><strong>{item.average?.toFixed(1) ?? "—"} {metricDetails[item.key].unit}</strong><small>{item.change === null ? "Sin referencia comparable" : `${formatChange(item.change)} frente al periodo anterior`}</small></div>)}
              </div>
            </article>
          ))}
        </div>
      </Panel>
      <div className="eco-insight-footer">
        <span>Las conclusiones comparan promedios; no implican causalidad ni aplican umbrales técnicos.</span>
        <Link className="eco-text-link" to="/analysis">Abrir análisis comparativo →</Link>
      </div>
    </div>
  );
}

function severityText(severity: DemoAlert["severity"]) {
  return severity === "critical" ? "Crítica" : severity === "warning" ? "Advertencia" : "Informativa";
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState(demoAlerts);
  const [filter, setFilter] = useState("active");
  const [stationId, setStationId] = useState(stations[0].id);
  const [startDate, setStartDate] = useState(() => dateInputValue(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(() => dateInputValue(Date.now()));
  const [intervalMinutes, setIntervalMinutes] = useState("");
  const filtered = alerts.filter((alert) => filter === "all" || (filter === "active" ? !alert.resolved : alert.resolved));
  const availabilityReadings = measurements.filter((reading) => {
    const date = dateInputValue(reading.timestamp);
    return reading.stationId === stationId && date >= startDate && date <= endDate;
  });
  const incompleteReadings = availabilityReadings.filter((reading) =>
    (["voltage", "current", "humidity"] as MetricKey[]).some((key) => reading[key] === undefined),
  ).length;
  const interval = Number(intervalMinutes);
  const periodDays = Math.floor(
    (new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) /
      (24 * 60 * 60 * 1000),
  ) + 1;
  const expectedReadings = interval > 0 ? Math.ceil(periodDays * 24 * 60 / interval) : null;
  const availabilityPercent = expectedReadings ? availabilityReadings.length / expectedReadings * 100 : null;
  const resolveAlert = (id: string) => setAlerts((current) => current.map((alert) => alert.id === id ? { ...alert, resolved: true } : alert));

  return (
    <div className="eco-page">
      <PageHeading eyebrow="Centro de eventos" title="Alertas" description="Revisa eventos de comunicación y condiciones que requieren atención. Los eventos son ejemplos." action={<span className="eco-count-label">{alerts.filter((alert) => !alert.resolved).length} pendientes</span>} />
      <div className="eco-alert-summary">
        <div><strong>{alerts.filter((alert) => !alert.resolved && alert.severity === "critical").length}</strong><span>Críticas pendientes</span></div>
        <div><strong>{alerts.filter((alert) => !alert.resolved && alert.severity === "warning").length}</strong><span>Advertencias pendientes</span></div>
        <div><strong>{alerts.filter((alert) => alert.resolved).length}</strong><span>Resueltas</span></div>
      </div>
      <Panel title="Disponibilidad de datos" subtitle="Configura la frecuencia esperada según la estación; no se presupone un intervalo técnico">
        <div className="eco-filters eco-availability-filters">
          <label>Estación<select className="eco-input" value={stationId} onChange={(event) => setStationId(event.target.value)}>{stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label>
          <label>Desde<input className="eco-input" type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label>Hasta<input className="eco-input" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          <label>Frecuencia esperada (minutos)<input className="eco-input" type="number" min="1" step="1" placeholder="Configurar" value={intervalMinutes} onChange={(event) => setIntervalMinutes(event.target.value)} /></label>
        </div>
        <div className="eco-availability-result">
          <div><strong>{availabilityReadings.length}</strong><span>mediciones recibidas</span></div>
          <div><strong>{expectedReadings ?? "—"}</strong><span>mediciones esperadas</span></div>
          <div><strong>{incompleteReadings}</strong><span>registros incompletos</span></div>
          <div><strong>{availabilityPercent === null ? "—" : `${availabilityPercent.toFixed(1)}%`}</strong><span>disponibilidad calculada</span></div>
        </div>
        <p className="eco-calendar-note">Disponibilidad = mediciones recibidas ÷ esperadas × 100. Sin frecuencia definida no se calcula el porcentaje; una configuración no coincidente puede producir valores superiores al 100%.</p>
      </Panel>
      <Panel title="Registro de alertas" subtitle="No se han aplicado umbrales técnicos reales">
        <div className="eco-filters">
          <select className="eco-input" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar alertas"><option value="active">Pendientes</option><option value="resolved">Resueltas</option><option value="all">Todas las alertas</option></select>
        </div>
        <div className="eco-alert-list">
          {filtered.map((alert) => {
            const station = stations.find((item) => item.id === alert.stationId);
            return (
              <article className={`eco-alert-item severity-${alert.severity}`} key={alert.id}>
                <span className="eco-alert-symbol">{alert.severity === "critical" ? "!" : alert.severity === "warning" ? "△" : "i"}</span>
                <div className="eco-alert-body"><div className="eco-alert-title"><strong>{alert.title}</strong><span>{severityText(alert.severity)}</span></div><p>{alert.description}</p><small>{station?.id} · {station?.name} · {formatTime(alert.timestamp, true)}</small></div>
                {alert.resolved ? <span className="eco-resolved">Resuelta</span> : <button className="eco-button eco-button-light" onClick={() => resolveAlert(alert.id)}>Marcar resuelta</button>}
              </article>
            );
          })}
          {filtered.length === 0 && <p className="eco-empty">No hay alertas para este filtro.</p>}
        </div>
      </Panel>
      <p className="eco-note">Los límites para voltaje, corriente y humedad deberán definirse con base en los sensores y las condiciones reales de operación.</p>
    </div>
  );
}

export function ReportsPage() {
  const [stationId, setStationId] = useState("EST-001");
  const [period, setPeriod] = useState("month");
  const [month, setMonth] = useState(() => dateInputValue(Date.now()).slice(0, 7));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [customStart, setCustomStart] = useState(() => dateInputValue(Date.now() - 29 * 24 * 60 * 60 * 1000));
  const [customEnd, setCustomEnd] = useState(() => dateInputValue(Date.now()));
  const station = stations.find((item) => item.id === stationId) ?? stations[0];
  const monthStart = new Date(`${month}-01T00:00:00`);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const currentMonth = dateInputValue(Date.now()).slice(0, 7) === month;
  const reportStart = period === "month"
    ? monthStart
    : period === "year"
      ? new Date(Number(year), 0, 1)
      : new Date(`${customStart}T00:00:00`);
  const fullReportEnd = period === "month"
    ? monthEnd
    : period === "year"
      ? new Date(Number(year) + 1, 0, 1)
      : new Date(`${customEnd}T00:00:00`);
  const reportEnd = period === "custom" ? new Date(fullReportEnd.getTime() + 24 * 60 * 60 * 1000) :
    period === "month" && currentMonth
      ? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1)
      : period === "year" && year === String(new Date().getFullYear())
        ? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1)
        : fullReportEnd;
  const previousStart = period === "month"
    ? new Date(reportStart.getFullYear(), reportStart.getMonth() - 1, 1)
    : period === "year"
      ? new Date(Number(year) - 1, 0, 1)
      : new Date(reportStart.getTime() - (reportEnd.getTime() - reportStart.getTime()));
  const previousEnd = new Date(Math.min(
    previousStart.getTime() + (reportEnd.getTime() - reportStart.getTime()),
    period === "month"
      ? new Date(previousStart.getFullYear(), previousStart.getMonth() + 1, 1).getTime()
      : period === "year"
        ? new Date(previousStart.getFullYear() + 1, 0, 1).getTime()
        : Number.POSITIVE_INFINITY,
  ));
  const rows = periodMeasurements(reportStart, reportEnd, station.id);
  const previousRows = periodMeasurements(previousStart, previousEnd, station.id);
  const reportStats = (data: Measurement[], key: MetricKey) => metricStats(data, key);
  const reportLabel = period === "month"
    ? new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric" }).format(reportStart)
    : period === "year"
      ? year
      : `${customStart} — ${customEnd}`;
  const previousLabel = period === "month"
    ? new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric" }).format(previousStart)
    : period === "year"
      ? String(Number(year) - 1)
      : `${dateInputValue(previousStart.getTime())} — ${dateInputValue(previousEnd.getTime() - 1)}`;
  const downloadReport = () => {
    const reportMetrics = (["voltage", "current", "humidity"] as MetricKey[]).map((key) => {
      const currentStats = reportStats(rows, key);
      const previousStats = reportStats(previousRows, key);
      return [
        metricDetails[key].label,
        metricDetails[key].unit,
        currentStats.average?.toFixed(2) ?? "",
        currentStats.min?.toFixed(2) ?? "",
        currentStats.max?.toFixed(2) ?? "",
        previousStats.average?.toFixed(2) ?? "",
        formatChange(percentChange(previousStats.average, currentStats.average)),
      ];
    });
    exportCsv(`reporte-${station.id.toLowerCase()}.csv`, [
      ["Variable", "Unidad", "Promedio", "Mínimo", "Máximo", "Promedio periodo anterior", "Variación"],
      ...reportMetrics,
    ]);
  };

  return (
    <div className="eco-page">
      <PageHeading eyebrow="Análisis" title="Reportes" description="Genera resúmenes mensuales o anuales, compara con el periodo anterior y exporta la información." action={<div className="eco-report-actions"><button className="eco-button eco-print-button" onClick={() => window.print()}>↓ Imprimir / Guardar PDF</button><button className="eco-button" onClick={downloadReport}>↓ Descargar CSV</button></div>} />
      <Panel title="Parámetros del reporte" subtitle="Selecciona una estación y un periodo para generar las estadísticas">
        <div className="eco-filters eco-report-filters">
          <label>Estación<select className="eco-input" value={stationId} onChange={(event) => setStationId(event.target.value)}>{stations.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label>
          <label>Periodo<select className="eco-input" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="month">Mensual</option><option value="year">Anual</option><option value="custom">Personalizado</option></select></label>
          {period === "month" && <label>Mes<input className="eco-input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>}
          {period === "year" && <label>Año<input className="eco-input" type="number" min="2000" max={new Date().getFullYear()} value={year} onChange={(event) => setYear(event.target.value)} /></label>}
          {period === "custom" && <><label>Desde<input className="eco-input" type="date" value={customStart} max={customEnd} onChange={(event) => setCustomStart(event.target.value)} /></label><label>Hasta<input className="eco-input" type="date" value={customEnd} min={customStart} onChange={(event) => setCustomEnd(event.target.value)} /></label></>}
          <span className="eco-report-date">Periodo: {reportLabel} · comparación: {previousLabel}</span>
        </div>
      </Panel>
      <div className="eco-report-title"><div><p className="eco-eyebrow">Resumen del periodo</p><h2>{station.name}</h2><p>{station.location} · {rows.length} registros recibidos · {previousRows.length} en el periodo anterior</p></div><span className="eco-demo-label"><span /> Datos simulados</span></div>
      <div className="eco-report-grid">
        {(["voltage", "current", "humidity"] as MetricKey[]).map((key) => {
          const value = reportStats(rows, key);
          const previous = reportStats(previousRows, key);
          return <article className="eco-report-card" key={key}><p>{metricDetails[key].label} <small>({metricDetails[key].unit})</small></p><strong>{value.average?.toFixed(1) ?? "—"}<small> promedio</small></strong><div><span>Mín. <b>{value.min?.toFixed(1) ?? "—"}</b></span><span>Máx. <b>{value.max?.toFixed(1) ?? "—"}</b></span></div><div className="eco-report-change"><span>Vs. anterior</span><b>{formatChange(percentChange(previous.average, value.average))}</b></div></article>;
        })}
      </div>
      <Panel title="Comportamiento durante el periodo" subtitle={`${rows.length} registros · comparación con ${previousLabel}`}>
        <div className="eco-detail-charts">
          {(["voltage", "current", "humidity"] as MetricKey[]).map((metric) => <div className="eco-detail-chart" key={metric}><h3>{metricDetails[metric].label}</h3><TrendChart data={rows} metric={metric} /></div>)}
        </div>
      </Panel>
    </div>
  );
}

export function SettingsPage() {
  const [notice, setNotice] = useState("");
  const saveDemo = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("Preferencias de demostración guardadas en esta sesión; aún no se sincronizan con Firebase.");
  };
  return (
    <div className="eco-page">
      <PageHeading eyebrow="Preferencias" title="Configuración" description="Administra las preferencias de visualización del prototipo." />
      <form onSubmit={saveDemo}>
        <Panel title="Alertas de medición" subtitle="Los límites deben definirse con el equipo técnico; no hay valores predeterminados.">
          <div className="eco-settings-grid">
            {(["voltage", "current", "humidity"] as MetricKey[]).map((metric) => (
              <fieldset className="eco-threshold-field" key={metric}>
                <legend>{metricDetails[metric].label} ({metricDetails[metric].unit})</legend>
                <label>Mínimo<input className="eco-input" type="number" step="any" placeholder="Sin configurar" /></label>
                <label>Máximo<input className="eco-input" type="number" step="any" placeholder="Sin configurar" /></label>
              </fieldset>
            ))}
          </div>
          <div className="eco-settings-actions"><p>Estos campos son una vista previa. Los umbrales no se aplican a las alertas de ejemplo.</p><button className="eco-button" type="submit">Guardar preferencias</button></div>
          {notice && <p className="eco-note" role="status">{notice}</p>}
        </Panel>
      </form>
    </div>
  );
}
