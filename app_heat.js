const loginView = document.getElementById("loginView");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const logoutBtn = document.getElementById("logoutBtn");
const statusEl = document.getElementById("status");
const toastRegion = document.getElementById("toastRegion");
const resultsEl = document.getElementById("results");
const kpisEl = document.getElementById("kpis");
const consultarBtn = document.getElementById("consultarBtn");
const limpiarFiltrosBtn = document.getElementById("limpiarFiltrosBtn");
const descargarTablasBtn = document.getElementById("descargarTablasBtn");
const descargarGraficosBtn = document.getElementById("descargarGraficosBtn");
const otrosModal = document.getElementById("otrosModal");
const otrosDetalleContenido = document.getElementById("otrosDetalleContenido");
const cerrarModalBtn = document.getElementById("cerrarModalBtn");
const mapCoverageEl = document.getElementById("mapCoverage");
const heatMapEl = document.getElementById("heatMap");
const mapCard = document.getElementById("mapCard");
const toggleMapFullscreenBtn = document.getElementById("toggleMapFullscreen");
const geoTableModeEl = document.getElementById("geoTableMode");
const geoSummaryEl = document.getElementById("geoSummary");
const togglePasswordBtn = document.getElementById("togglePasswordBtn");
const loginPasswordInput = document.getElementById("loginPassword");
const sessionUserEl = document.getElementById("sessionUser");
const sessionRoleEl = document.getElementById("sessionRole");
const lastQueryAtEl = document.getElementById("lastQueryAt");
const activeFiltersCountEl = document.getElementById("activeFiltersCount");

let lastKpis = null;
let lastRows = [];
let lastDiscapacidadMensual = [];
let lastMapRows = [];
let lastGeoSummaryRows = [];
let geoFilterRows = [];
let heatMap = null;
let heatLayer = null;
let boundaryLayer = null;
let choroplethLayer = null;
let boundaryDataPromise = null;
let boundaryData = { comunas: null, barrios: null };
let authSession = JSON.parse(localStorage.getItem("sistemaConsultasSession") || "null");
let activeQueryId = 0;
let toastTimer = null;

const APP_VERSION = "20260804-logs-1";
const BUTTON_TEXT = {
  consultar: consultarBtn.textContent,
  limpiar: limpiarFiltrosBtn.textContent,
  descargarTablas: descargarTablasBtn.textContent,
  descargarGraficos: descargarGraficosBtn.textContent,
  logout: logoutBtn.textContent,
};
const cabaBounds = [
  [-34.705, -58.535],
  [-34.525, -58.335],
];
const donutGroups = new Set(["Estado CUD", "Sexo", "Ley de Acompañante", "Orientación Prestacional", "Equipamiento", "Vivienda Adaptada", "Vivienda Particular o Colectiva"]);
const chartColors = ["#1464a5", "#2f7fbd", "#64a2d7", "#9bc5e5", "#0f4d7d", "#72b7b2", "#f2c14e", "#e07a5f", "#6c757d"];

const filterControls = {
  orientacion_prestacional: document.getElementById("orientacionPrestacional"),
  ley_acompanante: document.getElementById("leyAcompanante"),
  equipamiento: document.getElementById("equipamiento"),
  condicion_actividad: document.getElementById("condicionActividad"),
  situacion_previsional: document.getElementById("situacionPrevisional"),
  sexo: document.getElementById("sexo"),
  junta_discapacidad: document.getElementById("juntaDiscapacidad"),
  estado_cud: document.getElementById("estadoCud"),
  comuna: document.getElementById("comuna"),
  barrio: document.getElementById("barrio"),
  vivienda_particular_colectiva: document.getElementById("viviendaParticularColectiva"),
  tipo_convivencia: document.getElementById("tipoConvivencia"),
  tipo_vivienda_estandarizada: document.getElementById("tipoViviendaEstandarizada"),
  vivienda_adaptada: document.getElementById("viviendaAdaptada"),
};

const groupLabels = {
  "Junta discapacidad": "Discapacidad",
  "Alfabetizacion": "Alfabetización",
  "Condicion de actividad": "Condición de Actividad",
  "Orientacion prestacional": "Orientación Prestacional",
  "Ley de acompanante": "Ley de Acompañante",
  "Situacion previsional": "Situación Previsional",
  "Tipo de orientacion prestacional": "Tipo de Orientación Prestacional",
  "Tipo de equipamiento": "Tipo de Equipamiento",
  "Estado CUD": "Estado CUD",
  "Vivienda adaptada": "Vivienda Adaptada",
  "Vivienda particular o colectiva": "Vivienda Particular o Colectiva",
  "Tipo de convivencia": "Tipo de Convivencia",
  "Tipo de vivienda estandarizada": "Tipo de Vivienda Estandarizada",
};

const groupOrder = [
  "Estado CUD",
  "Sexo",
  "Orientación Prestacional",
  "Tipo de Orientación Prestacional",
  "Equipamiento",
  "Tipo de Equipamiento",
  "Condición de Actividad",
  "Situación Previsional",
  "Vivienda Particular o Colectiva",
  "Tipo de Vivienda Estandarizada",
  "Vivienda Adaptada",
  "Tipo de Convivencia",
  "Alfabetización",
  "Ley de Acompañante",
];
const multiValueFilters = new Set(["condicion_actividad", "situacion_previsional", "junta_discapacidad"]);

function getConfig() {
  const config = window.SISTEMA_CONSULTAS_CONFIG || {};
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || config.SUPABASE_URL.includes("TU-PROYECTO")) {
    throw new Error("Falta configurar app/config.js con SUPABASE_URL y SUPABASE_ANON_KEY.");
  }
  return config;
}

function supabaseUrl(path) {
  return `${getConfig().SUPABASE_URL}${path}`;
}

function authHeaders() {
  const config = getConfig();
  const token = authSession?.access_token || config.SUPABASE_ANON_KEY;
  return { apikey: config.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function showApp(show) {
  loginView.classList.toggle("hidden", show);
  appShell.classList.toggle("hidden", !show);
}

function showToast(message, type = "info", sticky = false) {
  if (!toastRegion) return;
  clearTimeout(toastTimer);
  toastRegion.className = `toast-region show ${type}`;
  toastRegion.textContent = message;
  if (!sticky) {
    toastTimer = setTimeout(() => {
      toastRegion.classList.remove("show");
    }, 4200);
  }
}

function hideToast() {
  clearTimeout(toastTimer);
  toastRegion?.classList.remove("show");
}

function setStatus(message, options = {}) {
  const { type = "info", sticky = true, toast = true } = options;
  statusEl.textContent = message;
  if (toast) showToast(message, type, sticky);
}

function setButtonBusy(button, busy, textWhenBusy, textWhenReady) {
  button.disabled = busy;
  button.textContent = busy ? textWhenBusy : textWhenReady;
}

function sessionUserEmail() {
  return authSession?.user?.email || "Sin sesión";
}

function sessionRole() {
  return authSession?.user?.app_metadata?.role || authSession?.user?.user_metadata?.role || "usuario";
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function updateSessionSummary(filters = null, lastQueryAt = null) {
  if (sessionUserEl) sessionUserEl.textContent = sessionUserEmail();
  if (sessionRoleEl) sessionRoleEl.textContent = sessionRole() === "admin" ? "Administrador" : "Usuario";
  if (activeFiltersCountEl) activeFiltersCountEl.textContent = String(filters ? Object.keys(filtrosActivos(filters)).length : 0);
  if (lastQueryAt && lastQueryAtEl) lastQueryAtEl.textContent = formatDateTime(lastQueryAt);
}

async function signIn(email, password) {
  const response = await fetch(supabaseUrl("/auth/v1/token?grant_type=password"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error("Usuario o contraseña inválidos.");
  authSession = await response.json();
  localStorage.setItem("sistemaConsultasSession", JSON.stringify(authSession));
}

async function signOut() {
  try {
    if (authSession?.access_token) {
      await fetch(supabaseUrl("/auth/v1/logout"), { method: "POST", headers: authHeaders() });
    }
  } finally {
    authSession = null;
    localStorage.removeItem("sistemaConsultasSession");
    setButtonBusy(logoutBtn, false, "Saliendo...", BUTTON_TEXT.logout);
    updateSessionSummary(null, null);
    if (lastQueryAtEl) lastQueryAtEl.textContent = "Sin consultar";
    hideToast();
    showApp(false);
  }
}

function parseDateInput(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) throw new Error(`Fecha inválida: ${trimmed}. Usar dd/mm/aaaa.`);
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function readFilterValue(control, filterName) {
  if (!control) return null;
  if (multiValueFilters.has(filterName) && control.classList.contains("checkbox-filter")) {
    const values = Array.from(control.querySelectorAll("input[type='checkbox']:checked")).map(input => input.value).filter(Boolean);
    return values.length ? values.join("|") : null;
  }
  if (!multiValueFilters.has(filterName)) return control.value || null;
  const values = Array.from(control.selectedOptions).map(option => option.value).filter(Boolean);
  return values.length ? values.join("|") : null;
}

function readFilters() {
  return {
    p_edad_desde: Number(document.getElementById("edadDesde").value || 0),
    p_edad_hasta: Number(document.getElementById("edadHasta").value || 200),
    p_fecha_desde: parseDateInput(document.getElementById("fechaDesde").value),
    p_fecha_hasta: parseDateInput(document.getElementById("fechaHasta").value),
    p_orientacion_prestacional: readFilterValue(filterControls.orientacion_prestacional, "orientacion_prestacional"),
    p_ley_acompanante: readFilterValue(filterControls.ley_acompanante, "ley_acompanante"),
    p_equipamiento: readFilterValue(filterControls.equipamiento, "equipamiento"),
    p_alfabetizacion: null,
    p_condicion_actividad: readFilterValue(filterControls.condicion_actividad, "condicion_actividad"),
    p_situacion_previsional: readFilterValue(filterControls.situacion_previsional, "situacion_previsional"),
    p_sexo: readFilterValue(filterControls.sexo, "sexo"),
    p_junta_discapacidad: readFilterValue(filterControls.junta_discapacidad, "junta_discapacidad"),
    p_estado_cud: readFilterValue(filterControls.estado_cud, "estado_cud"),
    p_comuna: readFilterValue(filterControls.comuna, "comuna"),
    p_barrio: readFilterValue(filterControls.barrio, "barrio"),
    p_vivienda_particular_colectiva: readFilterValue(filterControls.vivienda_particular_colectiva, "vivienda_particular_colectiva"),
    p_tipo_convivencia: readFilterValue(filterControls.tipo_convivencia, "tipo_convivencia"),
    p_tipo_vivienda: null,
    p_tipo_vivienda_estandarizada: readFilterValue(filterControls.tipo_vivienda_estandarizada, "tipo_vivienda_estandarizada"),
    p_vivienda_adaptada: readFilterValue(filterControls.vivienda_adaptada, "vivienda_adaptada"),
  };
}

function displayGroupName(groupName) { return groupLabels[groupName] || groupName; }
function formatNumber(value) { return new Intl.NumberFormat("es-AR").format(value || 0); }
function formatPct(value) { return `${Number(value || 0).toFixed(2)}%`; }
function formatPeriodo(value) {
  if (!value) return "Sin periodo";
  const [year, month] = String(value).slice(0, 10).split("-");
  return `${month}/${year}`;
}
function escapeHtml(value) { return String(value ?? "Sin dato").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function normalizeGeoName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bgral\b/g, "general")
    .replace(/\bpte\b/g, "presidente")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeGeoLevel(value) {
  const normalized = normalizeGeoName(value);
  if (normalized.includes("barrio")) return "barrio";
  if (normalized.includes("comuna")) return "comuna";
  return normalized;
}

function normalizeCategory(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function groupRows(rows) {
  return rows.reduce((acc, row) => {
    const groupName = displayGroupName(row.grupo);
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push({ ...row, grupo: groupName });
    return acc;
  }, {});
}

async function rpc(functionName, body = {}) {
  const response = await fetch(supabaseUrl(`/rest/v1/rpc/${functionName}`), { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  if (response.status === 401 || response.status === 403) {
    await signOut();
    throw new Error("Sesión vencida. Volvé a ingresar.");
  }
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}

function filtrosActivos(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([key, value]) => {
    if (value === null || value === "" || value === undefined) return false;
    if (key === "p_edad_desde" && Number(value) === 0) return false;
    if (key === "p_edad_hasta" && Number(value) === 200) return false;
    return true;
  }));
}

async function registrarLog(accion, { detalle = {}, duracionMs = null, totalBase = null, resultado = "ok", errorMensaje = null } = {}) {
  if (!authSession?.access_token) return;
  try {
    await fetch(supabaseUrl("/rest/v1/rpc/registrar_log_liviano"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        p_accion: accion,
        p_detalle: detalle,
        p_duracion_ms: duracionMs,
        p_total_base: totalBase,
        p_resultado: resultado,
        p_error_mensaje: errorMensaje,
        p_user_agent: navigator.userAgent,
        p_app_version: APP_VERSION,
      }),
    });
  } catch {
    // El log no debe bloquear el uso del tablero.
  }
}

async function consultarDashboard(filters) {
  const response = await rpc("consultar_dashboard_v4", filters);
  return Array.isArray(response) ? response[0] : response;
}

async function consultarDashboardBasico(filters) {
  const response = await rpc("consultar_dashboard_basico_v4", filters);
  return Array.isArray(response) ? response[0] : response;
}

async function consultarTableroUnificado(filters) {
  const response = await rpc("consultar_tablero_unificado_v4", filters);
  return Array.isArray(response) ? response[0] : response;
}

async function cargarFiltros() {
  const [rows, geografiaRows] = await Promise.all([
    rpc("consultar_filtros_rango_etario"),
    rpc("consultar_geografia_filtros"),
  ]);
  geoFilterRows = geografiaRows || [];
  Object.entries(filterControls).forEach(([filterName, control]) => {
    if (multiValueFilters.has(filterName) && control.classList.contains("checkbox-filter")) {
      control.innerHTML = `<div class="muted">${escapeHtml(control.dataset.emptyLabel || "Todas")}</div>`;
      return;
    }
    const first = control.querySelector("option");
    control.innerHTML = "";
    control.appendChild(first || new Option("Todas", ""));
  });
  for (const row of rows) {
    const control = filterControls[row.filtro];
    if (!control) continue;
    if (multiValueFilters.has(row.filtro) && control.classList.contains("checkbox-filter")) {
      if (control.querySelector(".muted")) control.innerHTML = "";
      const id = `${control.id}_${control.children.length}`;
      const label = document.createElement("label");
      label.innerHTML = `<input type="checkbox" id="${id}" value="${escapeHtml(row.valor)}"><span>${escapeHtml(row.valor)}</span>`;
      control.appendChild(label);
      continue;
    }
    const option = document.createElement("option");
    option.value = row.valor;
    option.textContent = row.valor;
    control.appendChild(option);
  }
  cargarOpcionesGeograficas();
}

function cargarOpcionesGeograficas() {
  const comunaControl = filterControls.comuna;
  const barrioControl = filterControls.barrio;
  if (!comunaControl || !barrioControl) return;
  const selectedComuna = comunaControl.value || "";
  const selectedBarrio = barrioControl.value || "";
  const comunas = [...new Set(geoFilterRows.map(row => row.comuna).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es-AR", { numeric: true }));
  const barrios = [...new Set(geoFilterRows
    .filter(row => !selectedComuna || row.comuna === selectedComuna)
    .map(row => row.barrio)
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es-AR"));

  comunaControl.innerHTML = "";
  comunaControl.appendChild(new Option("Todas", ""));
  comunas.forEach(comuna => comunaControl.appendChild(new Option(comuna, comuna)));
  comunaControl.value = selectedComuna;

  barrioControl.innerHTML = "";
  barrioControl.appendChild(new Option("Todos", ""));
  barrios.forEach(barrio => barrioControl.appendChild(new Option(barrio, barrio)));
  barrioControl.value = barrios.includes(selectedBarrio) ? selectedBarrio : "";
}

function renderGaugeCard(totalBase, periodos) {
  return `<article class="gauge-card"><div class="gauge"><svg viewBox="0 0 220 132" aria-hidden="true"><path class="gauge-track" d="M 30 110 A 80 80 0 0 1 190 110" pathLength="100"></path><path class="gauge-value" d="M 30 110 A 80 80 0 0 1 190 110" pathLength="100"></path></svg><div class="gauge-readout"><span>Total Base</span><strong>${formatNumber(totalBase)}</strong><em>Registros únicos · ${formatNumber(periodos)} períodos</em></div></div></article>`;
}

function renderKpis(kpis, rows, discapacidadMensual = []) {
  const item = Array.isArray(kpis) ? kpis[0] : kpis;
  const groups = groupRows(rows);
  kpisEl.innerHTML = renderGaugeCard(Number(item?.total_base || 0), Number(item?.cantidad_periodos || 0)) + renderVerticalChart("Discapacidad", groups["Discapacidad"] || [], { compact: true }) + renderDiscapacidadMensualTable(discapacidadMensual);
}

function ensureHeatMap() {
  if (heatMap || !heatMapEl || !window.L) return heatMap;
  heatMap = L.map(heatMapEl, { zoomControl: true }).setView([-34.61, -58.44], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(heatMap);
  return heatMap;
}

async function loadBoundaryData() {
  if (boundaryDataPromise) return boundaryDataPromise;
  boundaryDataPromise = Promise.all([
    fetch("comunas.json").then(response => {
      if (!response.ok) throw new Error("No se pudo cargar comunas.json");
      return response.json();
    }),
    fetch("barrios.json").then(response => {
      if (!response.ok) throw new Error("No se pudo cargar barrios.json");
      return response.json();
    }),
  ]).then(([comunas, barrios]) => {
    boundaryData = { comunas, barrios };
    return boundaryData;
  }).catch(error => {
    console.warn(error);
    boundaryData = { comunas: null, barrios: null };
    return boundaryData;
  });
  return boundaryDataPromise;
}

function findBoundaryFeature(filters) {
  const selectedBarrio = filters?.p_barrio;
  const selectedComuna = filters?.p_comuna;
  if (selectedBarrio && boundaryData.barrios?.features) {
    const wanted = normalizeGeoName(selectedBarrio);
    const feature = boundaryData.barrios.features.find(item => normalizeGeoName(item.properties?.nombre) === wanted);
    if (feature) return { type: "barrio", feature };
  }
  if (selectedComuna && boundaryData.comunas?.features) {
    const comunaNumber = String(selectedComuna).match(/\d+/)?.[0];
    const feature = boundaryData.comunas.features.find(item => String(item.properties?.comuna) === comunaNumber);
    if (feature) return { type: "comuna", feature };
  }
  return null;
}

function territoryFeatureName(feature, mode) {
  const props = feature.properties || {};
  if (mode === "barrio") {
    return props.nombre || props.barrio || props.BARRIO || props.NOMBRE || props.name || "";
  }
  return `Comuna ${props.comuna || props.COMUNA || props.id || ""}`;
}

function territoryChoroplethColor(value, minValue, maxValue) {
  if (!value) return "#f7fbff";
  const min = Number(minValue || 0);
  const max = Number(maxValue || 0);
  const ratio = max > min ? Math.max(0, Math.min(1, (Number(value || 0) - min) / (max - min))) : 1;
  if (ratio >= 0.86) return "#084081";
  if (ratio >= 0.70) return "#0868ac";
  if (ratio >= 0.54) return "#2b8cbe";
  if (ratio >= 0.38) return "#4eb3d3";
  if (ratio >= 0.20) return "#7bccc4";
  return "#ccebc5";
}

function buildTerritoryTotals(summaryRows, mode) {
  const level = mode === "barrio" ? "barrio" : "comuna";
  const totals = new Map();
  (summaryRows || []).filter(row => normalizeGeoLevel(row.nivel) === level).forEach(row => {
    const total = Number(row.total || 0);
    const key = normalizeGeoName(row.categoria);
    totals.set(key, total);
    totals.set(key.replace(/^barrio\s+/, ""), total);
  });
  return totals;
}

function fitMapToTerritory(filters, mode) {
  if (!heatMap || !window.L) return;
  const selected = findBoundaryFeature(filters);
  if (selected) {
    const focusLayer = L.geoJSON(selected.feature);
    const bounds = focusLayer.getBounds();
    if (bounds.isValid()) {
      heatMap.fitBounds(bounds, {
        animate: false,
        paddingTopLeft: [28, 28],
        paddingBottomRight: [28, 28],
        maxZoom: selected.type === "barrio" ? 14 : 13,
      });
      return;
    }
  }
  focusHeatMapOnCaba(false);
}

function drawTerritoryChoropleth(summaryRows, filters) {
  if (!heatMap || !window.L) return;
  if (boundaryLayer) {
    boundaryLayer.remove();
    boundaryLayer = null;
  }
  if (choroplethLayer) {
    choroplethLayer.remove();
    choroplethLayer = null;
  }

  const mode = filters?.p_barrio ? "barrio" : (geoTableModeEl?.value || "comuna");
  const source = mode === "barrio" ? boundaryData.barrios : boundaryData.comunas;
  if (!source?.features?.length) {
    focusHeatMapOnCaba(false);
    return;
  }

  const totals = buildTerritoryTotals(summaryRows, mode);
  const positiveTotals = Array.from(totals.values()).filter(value => value > 0);
  const minValue = positiveTotals.length ? Math.min(...positiveTotals) : 0;
  const maxValue = positiveTotals.length ? Math.max(...positiveTotals) : 1;
  choroplethLayer = L.geoJSON(source, {
    style: feature => {
      const name = territoryFeatureName(feature, mode);
      const total = totals.get(normalizeGeoName(name)) || 0;
      const isActive = total > 0;
      return {
        color: isActive ? "#08306b" : "#8aa7bd",
        weight: isActive ? 1.45 : 0.8,
        opacity: isActive ? 0.88 : 0.35,
        fillColor: territoryChoroplethColor(total, minValue, maxValue),
        fillOpacity: isActive ? 0.54 : 0.04,
      };
    },
    onEachFeature: (feature, layer) => {
      const name = territoryFeatureName(feature, mode);
      const total = totals.get(normalizeGeoName(name)) || 0;
      layer.bindTooltip(escapeHtml(name), {
        permanent: true,
        direction: "center",
        className: "territory-label",
      });
    },
    interactive: true,
  }).addTo(heatMap);

  fitMapToTerritory(filters, mode);
}

function focusHeatMapOnCaba(animate = false) {
  if (!heatMap) return;
  heatMap.fitBounds(cabaBounds, {
    animate,
    paddingTopLeft: [18, 18],
    paddingBottomRight: [18, 18],
    maxZoom: 12,
  });
}

function heatColor(value, maxValue) {
  const ratio = Math.max(0, Math.min(1, Number(value || 0) / Math.max(maxValue, 1)));
  return 0.35 + Math.pow(ratio, 0.55) * 0.65;
}

function heatStyleForZoom(map) {
  const zoom = map.getZoom();
  let radius = 30;
  if (zoom <= 11) radius = 54;
  else if (zoom <= 12) radius = 46;
  else if (zoom <= 13) radius = 36;
  else if (zoom <= 14) radius = 28;
  else radius = 22;
  return {
    radius,
    blur: Math.round(radius * 0.95),
  };
}

function heatOpacityForZoom(map) {
  const zoom = map?.getZoom?.() || 12;
  if (document.fullscreenElement === mapCard) return zoom <= 12 ? "0.88" : "0.76";
  return zoom <= 12 ? "0.80" : "0.70";
}

function updateClassicHeatStyle() {
  if (!heatMap || !heatLayer?.setOptions) return;
  const style = heatStyleForZoom(heatMap);
  heatLayer.setOptions(style);
  if (heatLayer._heat?.radius) {
    heatLayer._heat.radius(style.radius, style.blur);
  }
  if (heatLayer._canvas) {
    heatLayer._canvas.style.opacity = heatOpacityForZoom(heatMap);
  }
  heatLayer.redraw();
}

function removeLegacyHeatArtifacts() {
  if (!heatMapEl) return;
  heatMapEl.querySelectorAll(".heat-zone-cell, .leaflet-marker-icon.heat-zone-cell, .leaflet-marker-pane .heat-zone-cell").forEach(node => node.remove());
  heatMapEl.querySelectorAll(".leaflet-marker-pane .leaflet-marker-icon, .leaflet-marker-pane .leaflet-marker-shadow").forEach(node => node.remove());
  heatMapEl.querySelectorAll(".leaflet-overlay-pane canvas").forEach(node => {
    if (!node.classList.contains("leaflet-heatmap-layer")) node.remove();
  });
}

async function renderHeatMap(rows = [], totalSelected = 0, filters = null, geoSummaryRows = []) {
  if (!window.L) {
    mapCoverageEl.textContent = "No se pudo cargar Leaflet";
    return;
  }
  const map = ensureHeatMap();
  if (!map) return;
  await loadBoundaryData();
  if (heatLayer) {
    heatLayer.remove();
    heatLayer = null;
  }
  removeLegacyHeatArtifacts();
  map.off("zoomend", updateClassicHeatStyle);
  const mode = filters?.p_barrio ? "barrio" : (geoTableModeEl?.value || "comuna");
  mapCoverageEl.textContent = `${formatNumber(totalSelected)} filtradas · vista por ${mode === "barrio" ? "barrios" : "comunas"}`;
  requestAnimationFrame(() => {
    map.invalidateSize();
    drawTerritoryChoropleth(geoSummaryRows, filters);
  });
}

function renderGeoSummary(rows) {
  if (!geoSummaryEl) return;
  const mode = geoTableModeEl?.value || "comuna";
  const label = mode === "barrio" ? "Barrio" : "Comuna";
  const allFiltered = rows.filter(row => normalizeGeoLevel(row.nivel) === normalizeGeoLevel(label));
  const filtered = mode === "barrio" ? allFiltered.slice(0, 15) : allFiltered;
  const total = allFiltered.reduce((sum, row) => sum + Number(row.total || 0), 0);
  if (!allFiltered.length) {
    geoSummaryEl.className = "geo-summary empty";
    geoSummaryEl.innerHTML = `No hay ${label.toLowerCase()}s para los filtros seleccionados.`;
    return;
  }
  const body = filtered.map(row => {
    const pct = total ? (Number(row.total || 0) / total) * 100 : 0;
    const filterAttr = mode === "barrio" ? `data-barrio="${escapeHtml(row.categoria)}"` : `data-comuna="${escapeHtml(row.categoria)}"`;
    return `<tr><td><button type="button" class="link-row" ${filterAttr}>${escapeHtml(row.categoria)}</button></td><td class="num">${formatNumber(row.total)}</td><td class="num">${formatPct(pct)}</td></tr>`;
  }).join("");
  geoSummaryEl.className = "geo-summary";
  geoSummaryEl.innerHTML = `<table><thead><tr><th>${label}</th><th>Personas</th><th>%</th></tr></thead><tbody>${body}</tbody></table>`;
}

async function toggleMapFullscreen() {
  if (!mapCard || !document.fullscreenEnabled) return;
  if (document.fullscreenElement === mapCard) {
    await document.exitFullscreen();
  } else {
    await mapCard.requestFullscreen();
  }
}

function limpiarFiltros() {
  setStatus("Borrando filtros...", { sticky: true });
  setButtonBusy(consultarBtn, true, "Consultando...", BUTTON_TEXT.consultar);
  setButtonBusy(limpiarFiltrosBtn, true, "Borrando...", BUTTON_TEXT.limpiar);
  registrarLog("limpiar_filtros");
  document.getElementById("fechaDesde").value = "";
  document.getElementById("fechaHasta").value = "";
  document.getElementById("edadDesde").value = "0";
  document.getElementById("edadHasta").value = "200";
  Object.entries(filterControls).forEach(([filterName, control]) => {
    if (multiValueFilters.has(filterName) && control.classList.contains("checkbox-filter")) {
      control.querySelectorAll("input[type='checkbox']").forEach(input => { input.checked = false; });
    } else {
      control.value = "";
    }
  });
  cargarOpcionesGeograficas();
  document.querySelectorAll(".filter-group[open]").forEach(group => { group.open = false; });
  consultar("Filtros borrados. Actualizando tablero...");
}


function renderDiscapacidadMensualTable(rows) {
  if (!rows.length) {
    return `<article class="chart-card disability-table-card"><header><h2>Discapacidad por periodo</h2><strong>0</strong></header><div class="empty">No hay datos mensuales para los filtros seleccionados.</div></article>`;
  }

  const periods = [...new Set(rows.map(row => String(row.periodo).slice(0, 10)))].sort();
  const categories = [...new Set(rows.map(row => row.discapacidad || "Sin dato"))].sort((a, b) => a.localeCompare(b));
  const lookup = new Map(rows.map(row => [`${String(row.periodo).slice(0, 10)}|${row.discapacidad || "Sin dato"}`, Number(row.total || 0)]));
  const totalsByPeriod = new Map(periods.map(period => [period, categories.reduce((sum, category) => sum + (lookup.get(`${period}|${category}`) || 0), 0)]));

  const head = periods.map(period => `<th>${formatPeriodo(period)}</th>`).join("");
  const body = categories.map(category => {
    const cells = periods.map(period => `<td class="num">${formatNumber(lookup.get(`${period}|${category}`) || 0)}</td>`).join("");
    return `<tr><th>${escapeHtml(category)}</th>${cells}</tr>`;
  }).join("");
  const totals = periods.map(period => `<td class="num total-cell">${formatNumber(totalsByPeriod.get(period) || 0)}</td>`).join("");

  return `<article class="chart-card disability-table-card"><header><h2>Discapacidad por periodo</h2><strong>${formatNumber(rows.length)}</strong></header><div class="wide-table"><table><thead><tr><th>Discapacidad</th>${head}</tr></thead><tbody>${body}<tr class="total-row"><th>Total</th>${totals}</tr></tbody></table></div></article>`;
}
function renderVerticalChart(groupName, items, options = {}) {
  const totalGrupo = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const maxValue = Math.max(...items.map(item => Number(item.total || 0)), 1);
  const bars = items.map(item => {
    const total = Number(item.total || 0);
    const pct = totalGrupo ? (total / totalGrupo) * 100 : 0;
    const isOtrosEquip = groupName === "Tipo de Equipamiento" && normalizeCategory(item.categoria) === "otros";
    const content = `<span class="vbar-value">${formatNumber(total)}</span><span class="vbar-track"><span class="vbar" style="height:${Math.max((total / maxValue) * 100, 2)}%"></span></span><span class="vbar-label">${escapeHtml(item.categoria)}</span><span class="vbar-pct">${formatPct(pct)}</span>`;
    const title = `${escapeHtml(item.categoria)}: ${formatNumber(total)} (${formatPct(pct)})`;
    if (isOtrosEquip) {
      return `<div class="vbar-item detail-trigger" role="button" tabindex="0" data-otros-equipamiento="1" title="${title}" aria-label="Ver detalle de Otros - Tipo de Equipamiento">${content}</div>`;
    }
    return `<div class="vbar-item" title="${title}">${content}</div>`;
  }).join("");
  return `<article class="chart-card${options.compact ? " compact-chart" : ""}"><header><h2>${escapeHtml(groupName)}</h2><strong>${formatNumber(totalGrupo)}</strong></header><div class="bar-chart">${bars}</div></article>`;
}

function renderDonutChart(groupName, items) {
  const totalGrupo = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  let offset = 0;
  const segments = items.map((item, index) => {
    const pct = totalGrupo ? (Number(item.total || 0) / totalGrupo) * 100 : 0;
    const segment = `${chartColors[index % chartColors.length]} ${offset}% ${offset + pct}%`;
    offset += pct;
    return segment;
  }).join(", ");
  const legend = items.map((item, index) => `<li><span class="legend-color" style="background:${chartColors[index % chartColors.length]}"></span><span>${escapeHtml(item.categoria)}</span><span class="legend-values"><strong class="legend-total">${formatNumber(item.total)}</strong><span class="legend-pct">· ${formatPct(totalGrupo ? (Number(item.total || 0) / totalGrupo) * 100 : 0)}</span></span></li>`).join("");
  return `<article class="chart-card donut-card"><header><h2>${escapeHtml(groupName)}</h2><strong>${formatNumber(totalGrupo)}</strong></header><div class="donut-layout"><div class="donut" style="background: conic-gradient(${segments || "#dbe2ea 0 100%"});"><div><strong>${formatNumber(totalGrupo)}</strong><span>Total</span></div></div><ul class="donut-legend">${legend}</ul></div></article>`;
}

function renderResults(rows) {
  if (!rows.length) { resultsEl.innerHTML = '<div class="empty">No hay resultados para los filtros seleccionados.</div>'; return; }
  const groups = groupRows(rows);
  delete groups["Discapacidad"];
  const orderedGroups = Object.entries(groups).sort(([a], [b]) => ((groupOrder.indexOf(a) === -1 ? 99 : groupOrder.indexOf(a)) - (groupOrder.indexOf(b) === -1 ? 99 : groupOrder.indexOf(b))) || a.localeCompare(b));
  resultsEl.innerHTML = orderedGroups.map(([groupName, items]) => donutGroups.has(groupName) ? renderDonutChart(groupName, items) : renderVerticalChart(groupName, items)).join("");
}

async function mostrarDetalleOtrosEquipamiento() {
  otrosDetalleContenido.textContent = "Consultando detalle de Otros...";
  otrosModal.showModal();
  otrosDetalleContenido.focus();
  try {
    const rows = await rpc("consultar_tipo_equipamiento_otros_detalle_geo", readFilters());
    const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const body = rows.map(row => `<tr><td>${escapeHtml(row.detalle)}</td><td>${formatNumber(row.total)}</td><td>${formatPct(total ? (Number(row.total || 0) / total) * 100 : 0)}</td></tr>`).join("");
    otrosDetalleContenido.innerHTML = rows.length ? `<table><thead><tr><th>Detalle</th><th>Total</th><th>%</th></tr></thead><tbody>${body}</tbody></table>` : "No hay detalle disponible para los filtros actuales.";
  } catch (error) {
    otrosDetalleContenido.textContent = `No se pudo cargar el detalle. ${error.message}`;
  }
}

function buildReportTablesHtml() {
  const groups = groupRows(lastRows);
  const item = Array.isArray(lastKpis) ? lastKpis[0] : lastKpis;
  const kpiRows = `<tr><td>Total Base</td><td>${Number(item?.total_base || 0)}</td></tr><tr><td>Cantidad de Periodos</td><td>${Number(item?.cantidad_periodos || 0)}</td></tr>`;
  const tables = Object.entries(groups).map(([groupName, items]) => {
    const totalGrupo = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const body = items.map(item => `<tr><td>${escapeHtml(item.categoria)}</td><td>${Number(item.total || 0)}</td><td>${formatPct(totalGrupo ? (Number(item.total || 0) / totalGrupo) * 100 : 0)}</td></tr>`).join("");
    return `<h2>${escapeHtml(groupName)}</h2><table><thead><tr><th>Categoría</th><th>Total</th><th>%</th></tr></thead><tbody>${body}</tbody></table>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}table{border-collapse:collapse;margin-bottom:22px}th,td{border:1px solid #999;padding:6px 9px}th{background:#eaf2f9}</style></head><body><h1>Sistema de Consultas DGINCD</h1><h2>Indicadores</h2><table><tbody>${kpiRows}</tbody></table>${tables}</body></html>`;
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildReportTablesRows() {
  const groups = groupRows(lastRows);
  const item = Array.isArray(lastKpis) ? lastKpis[0] : lastKpis;
  const lines = [
    ["Sistema de Consultas DGINCD"],
    [],
    ["Indicador", "Valor"],
    ["Total Base", Number(item?.total_base || 0)],
    ["Cantidad de Periodos", Number(item?.cantidad_periodos || 0)],
    [],
  ];

  Object.entries(groups).forEach(([groupName, items]) => {
    const totalGrupo = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    lines.push([groupName]);
    lines.push(["Categoria", "Total", "%"]);
    items.forEach(item => {
      lines.push([item.categoria, Number(item.total || 0), formatPct(totalGrupo ? (Number(item.total || 0) / totalGrupo) * 100 : 0)]);
    });
    lines.push([]);
  });

  return lines;
}

function buildReportTablesCsv() {
  return `\ufeff${buildReportTablesRows().map(row => row.map(csvCell).join(";")).join("\r\n")}`;
}

function descargarExcelReal(filename, rows) {
  if (!window.XLSX) {
    throw new Error("No se pudo cargar la librería para generar Excel.");
  }
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [{ wch: 38 }, { wch: 16 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");
  XLSX.writeFile(workbook, filename);
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

function descargarTablas() {
  if (!lastRows.length) {
    setStatus("No hay datos para descargar. Primero aplicá una consulta.", { type: "warning", sticky: false });
    return;
  }

  setButtonBusy(descargarTablasBtn, true, "Preparando...", BUTTON_TEXT.descargarTablas);
  setStatus("Preparando descarga de tablas...", { sticky: true });

  try {
    const marcaTemporal = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    descargarExcelReal(`DGINCD_DA_REPORTE_${marcaTemporal}.xlsx`, buildReportTablesRows());
    setStatus("Descarga de tablas generada.", { type: "success", sticky: false });
  } catch (error) {
    setStatus(`No se pudo descargar tablas. ${error.message}`, { type: "error", sticky: false });
  } finally {
    setButtonBusy(descargarTablasBtn, false, "Preparando...", BUTTON_TEXT.descargarTablas);
  }
}

function descargarGraficos() {
  if (!lastRows.length) {
    setStatus("No hay gráficos para descargar. Primero aplicá una consulta.", { type: "warning", sticky: false });
    return;
  }
  setButtonBusy(descargarGraficosBtn, true, "Preparando...", BUTTON_TEXT.descargarGraficos);
  setStatus("Preparando descarga de gráficos...", { sticky: true });
  try {
    downloadBlob("DGINCD_DA_GRAFICOS.html", `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><title>Gráficos Sistema de Consultas</title><link rel="stylesheet" href="${new URL("styles.css", window.location.href).href}"></head><body><main class="shell"><h1>Sistema de Consultas DGINCD</h1>${kpisEl.outerHTML}${resultsEl.outerHTML}</main></body></html>`, "text/html;charset=utf-8");
    setStatus("Descarga de gráficos generada.", { type: "success", sticky: false });
  } catch (error) {
    setStatus(`No se pudo descargar gráficos. ${error.message}`, { type: "error", sticky: false });
  } finally {
    setButtonBusy(descargarGraficosBtn, false, "Preparando...", BUTTON_TEXT.descargarGraficos);
  }
}

async function consultar(statusMessage = "Filtrando datos...") {
  const queryId = ++activeQueryId;
  setButtonBusy(consultarBtn, true, "Consultando...", BUTTON_TEXT.consultar);
  setButtonBusy(limpiarFiltrosBtn, true, "Borrando...", BUTTON_TEXT.limpiar);
  setStatus(statusMessage, { sticky: true });
  const startedAt = performance.now();
  let filters = null;
  try {
    setStatus("Preparando filtros de consulta...", { sticky: true });
    filters = readFilters();
    updateSessionSummary(filters);
    if (statusMessage.includes("visualización")) {
      setStatus("Cargando datos para la visualización...", { sticky: true });
    } else if (statusMessage.includes("Filtros borrados")) {
      setStatus("Reconstruyendo el tablero sin filtros aplicados...", { sticky: true });
    } else {
      setStatus("Aplicando los filtros seleccionados al tablero...", { sticky: true });
    }
    const tablero = await consultarTableroUnificado(filters);
    if (queryId !== activeQueryId) return;
    setStatus("Procesando resultados...", { sticky: true });
    const kpis = tablero?.kpis || [];
    const rows = tablero?.resumen || [];
    const discapacidadMensual = tablero?.discapacidad_mensual || [];
    const geoSummaryRows = tablero?.geografia_resumen || [];
    const mapRows = [];
    lastKpis = kpis; lastRows = rows; lastDiscapacidadMensual = discapacidadMensual; lastMapRows = mapRows;
    renderKpis(kpis, rows, discapacidadMensual); renderResults(rows);
    lastGeoSummaryRows = geoSummaryRows;
    setStatus("Datos listos. Actualizando mapa territorial...", { sticky: true });
    const kpiItem = Array.isArray(kpis) ? kpis[0] : kpis;
    await renderHeatMap(mapRows, Number(kpiItem?.total_base || 0), filters, geoSummaryRows);
    renderGeoSummary(geoSummaryRows);
    updateSessionSummary(filters, new Date());
    setStatus(`Consulta finalizada. ${formatNumber(Number(kpiItem?.total_base || 0))} personas encontradas.`, { type: "success", sticky: false });
    registrarLog("consulta", {
      detalle: { filtros_activos: Object.keys(filtrosActivos(filters)).length },
      duracionMs: Math.round(performance.now() - startedAt),
      totalBase: Number(kpiItem?.total_base || 0),
    });
  } catch (error) {
    if (queryId !== activeQueryId) return;
    setStatus(`No se pudo completar la consulta. ${error.message}`, { type: "error", sticky: false });
    resultsEl.innerHTML = '<div class="empty error">No se pudo completar la consulta.</div>';
    kpisEl.innerHTML = "";
    mapCoverageEl.textContent = "Mapa no disponible";
    renderGeoSummary([]);
    registrarLog("error_consulta", {
      detalle: { filtros_activos: filters ? Object.keys(filtrosActivos(filters)).length : 0 },
      duracionMs: Math.round(performance.now() - startedAt),
      resultado: "error",
      errorMensaje: error.message,
    });
  } finally {
    setButtonBusy(consultarBtn, false, "Consultando...", BUTTON_TEXT.consultar);
    setButtonBusy(limpiarFiltrosBtn, false, "Borrando...", BUTTON_TEXT.limpiar);
  }
}

async function iniciarApp() {
  showApp(true);
  updateSessionSummary();
  setStatus("Cargando los datos para la visualización...", { sticky: true });
  await cargarFiltros();
  await consultar("Cargando los datos para la visualización...");
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginStatus.textContent = "Ingresando...";
  showToast("Validando usuario e ingresando al sistema...", "info", true);
  try {
    await signIn(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value);
    registrarLog("login_exitoso");
    loginStatus.textContent = "Cargando los datos para la visualización...";
    showToast("Cargando los datos para la visualización...", "info", true);
    await iniciarApp();
    loginStatus.textContent = "";
  } catch (error) {
    loginStatus.textContent = error.message;
    showToast(`No se pudo ingresar. ${error.message}`, "error", false);
  }
});

togglePasswordBtn?.addEventListener("click", () => {
  const isHidden = loginPasswordInput.type === "password";
  loginPasswordInput.type = isHidden ? "text" : "password";
  togglePasswordBtn.textContent = isHidden ? "×" : "👁";
  togglePasswordBtn.title = isHidden ? "Ocultar contraseña" : "Mostrar contraseña";
  togglePasswordBtn.setAttribute("aria-label", isHidden ? "Ocultar contraseña" : "Mostrar contraseña");
  togglePasswordBtn.setAttribute("aria-pressed", String(isHidden));
});

logoutBtn.addEventListener("click", async () => {
  setStatus("Cerrando sesión...", { sticky: false });
  await registrarLog("logout");
  await signOut();
});
consultarBtn.addEventListener("click", () => consultar("Filtrando datos..."));
limpiarFiltrosBtn.addEventListener("click", limpiarFiltros);
descargarTablasBtn.addEventListener("click", descargarTablas);
descargarGraficosBtn.addEventListener("click", descargarGraficos);
cerrarModalBtn.addEventListener("click", () => otrosModal.close());
filterControls.comuna?.addEventListener("change", () => cargarOpcionesGeograficas());
geoTableModeEl?.addEventListener("change", () => {
  renderGeoSummary(lastGeoSummaryRows);
  const kpiItem = Array.isArray(lastKpis) ? lastKpis[0] : lastKpis;
  renderHeatMap(lastMapRows, Number(kpiItem?.total_base || 0), readFilters(), lastGeoSummaryRows).catch(() => {});
});
geoSummaryEl?.addEventListener("click", event => {
  const rowButton = event.target.closest(".link-row");
  if (!rowButton) return;
  if (rowButton.dataset.comuna) {
    filterControls.comuna.value = rowButton.dataset.comuna;
    cargarOpcionesGeograficas();
  }
  if (rowButton.dataset.barrio) {
    filterControls.barrio.value = rowButton.dataset.barrio;
  }
  consultar();
});
resultsEl.addEventListener("click", event => {
  const detailControl = event.target.closest("[data-otros-equipamiento='1']");
  if (!detailControl) return;
  mostrarDetalleOtrosEquipamiento().catch(error => { otrosDetalleContenido.textContent = error.message; });
});
resultsEl.addEventListener("keydown", event => {
  const detailControl = event.target.closest("[data-otros-equipamiento='1']");
  if (!detailControl || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  mostrarDetalleOtrosEquipamiento().catch(error => { otrosDetalleContenido.textContent = error.message; });
});
toggleMapFullscreenBtn?.addEventListener("click", () => toggleMapFullscreen().catch(() => {}));
document.addEventListener("fullscreenchange", () => {
  const expanded = document.fullscreenElement === mapCard;
  if (toggleMapFullscreenBtn) {
    toggleMapFullscreenBtn.textContent = expanded ? "×" : "⛶";
    toggleMapFullscreenBtn.title = expanded ? "Salir de pantalla completa" : "Maximizar mapa";
    toggleMapFullscreenBtn.setAttribute("aria-label", toggleMapFullscreenBtn.title);
  }
  requestAnimationFrame(() => {
    heatMap?.invalidateSize();
    if (expanded) {
      try { drawTerritoryChoropleth(lastGeoSummaryRows, readFilters()); } catch { focusHeatMapOnCaba(false); }
    }
  });
});

(async function init() {
  if (!authSession?.access_token) { showApp(false); return; }
  try { await iniciarApp(); } catch (error) { loginStatus.textContent = error.message; await signOut(); }
})();
