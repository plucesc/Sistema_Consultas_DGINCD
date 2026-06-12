const loginView = document.getElementById("loginView");
const appShell = document.getElementById("appShell");
const loginForm = document.getElementById("loginForm");
const loginStatus = document.getElementById("loginStatus");
const logoutBtn = document.getElementById("logoutBtn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const kpisEl = document.getElementById("kpis");
const consultarBtn = document.getElementById("consultarBtn");
const descargarTablasBtn = document.getElementById("descargarTablasBtn");
const descargarGraficosBtn = document.getElementById("descargarGraficosBtn");
const otrosModal = document.getElementById("otrosModal");
const otrosDetalleContenido = document.getElementById("otrosDetalleContenido");
const cerrarModalBtn = document.getElementById("cerrarModalBtn");

let lastKpis = null;
let lastRows = [];
let lastDiscapacidadMensual = [];
let authSession = JSON.parse(localStorage.getItem("sistemaConsultasSession") || "null");

const donutGroups = new Set(["Sexo", "Ley de Acompañante", "Orientación Prestacional", "Equipamiento"]);
const chartColors = ["#1464a5", "#2f7fbd", "#64a2d7", "#9bc5e5", "#0f4d7d", "#72b7b2", "#f2c14e", "#e07a5f", "#6c757d"];

const filterControls = {
  orientacion_prestacional: document.getElementById("orientacionPrestacional"),
  ley_acompanante: document.getElementById("leyAcompanante"),
  equipamiento: document.getElementById("equipamiento"),
  condicion_actividad: document.getElementById("condicionActividad"),
  situacion_previsional: document.getElementById("situacionPrevisional"),
  sexo: document.getElementById("sexo"),
  junta_discapacidad: document.getElementById("juntaDiscapacidad"),
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
};

const groupOrder = ["Sexo", "Condición de Actividad", "Orientación Prestacional", "Tipo de Orientación Prestacional", "Equipamiento", "Tipo de Equipamiento", "Situación Previsional", "Ley de Acompañante", "Alfabetización"];

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

function readFilters() {
  return {
    p_edad_desde: Number(document.getElementById("edadDesde").value || 0),
    p_edad_hasta: Number(document.getElementById("edadHasta").value || 200),
    p_fecha_desde: parseDateInput(document.getElementById("fechaDesde").value),
    p_fecha_hasta: parseDateInput(document.getElementById("fechaHasta").value),
    p_orientacion_prestacional: filterControls.orientacion_prestacional?.value || null,
    p_ley_acompanante: filterControls.ley_acompanante?.value || null,
    p_equipamiento: filterControls.equipamiento?.value || null,
    p_alfabetizacion: null,
    p_condicion_actividad: filterControls.condicion_actividad?.value || null,
    p_situacion_previsional: filterControls.situacion_previsional?.value || null,
    p_sexo: filterControls.sexo?.value || null,
    p_junta_discapacidad: filterControls.junta_discapacidad?.value || null,
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

async function cargarFiltros() {
  const rows = await rpc("consultar_filtros_rango_etario");
  Object.values(filterControls).forEach(select => {
    const first = select.querySelector("option");
    select.innerHTML = "";
    select.appendChild(first || new Option("Todas", ""));
  });
  for (const row of rows) {
    const select = filterControls[row.filtro];
    if (!select) continue;
    const option = document.createElement("option");
    option.value = row.valor;
    option.textContent = row.valor;
    select.appendChild(option);
  }
}

function renderGaugeCard(totalBase, periodos) {
  return `<article class="gauge-card"><div class="gauge"><svg viewBox="0 0 220 132" aria-hidden="true"><path class="gauge-track" d="M 30 110 A 80 80 0 0 1 190 110" pathLength="100"></path><path class="gauge-value" d="M 30 110 A 80 80 0 0 1 190 110" pathLength="100"></path></svg><div class="gauge-readout"><span>Total Base</span><strong>${formatNumber(totalBase)}</strong><em>Registros únicos · ${formatNumber(periodos)} períodos</em></div></div></article>`;
}

function renderKpis(kpis, rows, discapacidadMensual = []) {
  const item = Array.isArray(kpis) ? kpis[0] : kpis;
  const groups = groupRows(rows);
  kpisEl.innerHTML = renderGaugeCard(Number(item?.total_base || 0), Number(item?.cantidad_periodos || 0)) + renderVerticalChart("Discapacidad", groups["Discapacidad"] || [], { compact: true }) + renderDiscapacidadMensualTable(discapacidadMensual);
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
    const isOtrosEquip = groupName === "Tipo de Equipamiento" && String(item.categoria).toLowerCase() === "otros";
    return `<button class="vbar-item${isOtrosEquip ? " detail-trigger" : ""}" type="button" ${isOtrosEquip ? 'data-otros-equipamiento="1"' : ""} title="${escapeHtml(item.categoria)}: ${formatNumber(total)} (${formatPct(pct)})"><span class="vbar-value">${formatNumber(total)}</span><span class="vbar-track"><span class="vbar" style="height:${Math.max((total / maxValue) * 100, 2)}%"></span></span><span class="vbar-label">${escapeHtml(item.categoria)}</span><span class="vbar-pct">${formatPct(pct)}</span></button>`;
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
  const legend = items.map((item, index) => `<li><span class="legend-color" style="background:${chartColors[index % chartColors.length]}"></span><span>${escapeHtml(item.categoria)}</span><strong>${formatNumber(item.total)} · ${formatPct(totalGrupo ? (Number(item.total || 0) / totalGrupo) * 100 : 0)}</strong></li>`).join("");
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
  otrosDetalleContenido.textContent = "Cargando...";
  otrosModal.showModal();
  const rows = await rpc("consultar_tipo_equipamiento_otros_detalle", readFilters());
  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const body = rows.map(row => `<tr><td>${escapeHtml(row.detalle)}</td><td>${formatNumber(row.total)}</td><td>${formatPct(total ? (Number(row.total || 0) / total) * 100 : 0)}</td></tr>`).join("");
  otrosDetalleContenido.innerHTML = rows.length ? `<table><thead><tr><th>Detalle</th><th>Total</th><th>%</th></tr></thead><tbody>${body}</tbody></table>` : "No hay detalle disponible para los filtros actuales.";
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

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

function descargarTablas() { if (lastRows.length) downloadBlob("reporte_sistema_consultas_tablas.xls", buildReportTablesHtml(), "application/vnd.ms-excel;charset=utf-8"); }
function descargarGraficos() { if (lastRows.length) downloadBlob("reporte_sistema_consultas_graficos.html", `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><title>Gráficos Sistema de Consultas</title><link rel="stylesheet" href="${new URL("styles.css", window.location.href).href}"></head><body><main class="shell"><h1>Sistema de Consultas DGINCD</h1>${kpisEl.outerHTML}${resultsEl.outerHTML}</main></body></html>`, "text/html;charset=utf-8"); }

async function consultar() {
  consultarBtn.disabled = true;
  statusEl.textContent = "Consultando Supabase...";
  try {
    const filters = readFilters();
    const [kpis, rows, discapacidadMensual] = await Promise.all([rpc("consultar_rango_etario_kpis", filters), rpc("consultar_rango_etario_resumen", filters), rpc("consultar_discapacidad_mensual", filters)]);
    lastKpis = kpis; lastRows = rows; lastDiscapacidadMensual = discapacidadMensual;
    statusEl.textContent = "Consulta finalizada.";
    renderKpis(kpis, rows, discapacidadMensual); renderResults(rows);
  } catch (error) {
    statusEl.textContent = error.message;
    resultsEl.innerHTML = '<div class="empty error">No se pudo completar la consulta.</div>';
    kpisEl.innerHTML = "";
  } finally { consultarBtn.disabled = false; }
}

async function iniciarApp() {
  showApp(true);
  await cargarFiltros();
  await consultar();
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  loginStatus.textContent = "Ingresando...";
  try {
    await signIn(document.getElementById("loginEmail").value, document.getElementById("loginPassword").value);
    loginStatus.textContent = "";
    await iniciarApp();
  } catch (error) { loginStatus.textContent = error.message; }
});

logoutBtn.addEventListener("click", signOut);
consultarBtn.addEventListener("click", consultar);
descargarTablasBtn.addEventListener("click", descargarTablas);
descargarGraficosBtn.addEventListener("click", descargarGraficos);
cerrarModalBtn.addEventListener("click", () => otrosModal.close());
resultsEl.addEventListener("click", event => { if (event.target.closest("[data-otros-equipamiento]")) mostrarDetalleOtrosEquipamiento().catch(error => { otrosDetalleContenido.textContent = error.message; }); });

(async function init() {
  if (!authSession?.access_token) { showApp(false); return; }
  try { await iniciarApp(); } catch (error) { loginStatus.textContent = error.message; await signOut(); }
})();



