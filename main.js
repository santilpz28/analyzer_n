/* ------------------------------------------------------------------
   CONFIGURA AQUÍ la URL de tu Webhook n8n
------------------------------------------------------------------ */
const WEBHOOK_URL = "https://s4life.app.n8n.cloud/webhook/Analyze";

/* ------------------------------------------------------------------
   Selectores
------------------------------------------------------------------ */
const form           = document.getElementById("analyze-form");
const spinner        = document.getElementById("spinner");
const resultSection  = document.getElementById("result");
const statusMessage  = document.getElementById("status-message");
const riskBar        = document.getElementById("risk-bar");
const riskLabel      = document.getElementById("risk-score-label");
const detailsList    = document.getElementById("details");

/* ------------------------------------------------------------------
   Enviar formulario
------------------------------------------------------------------ */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // ── 1. Leer inputs ────────────────────────────────────────────
  const rawDomain   = form.domain.value.trim();
  const contract = form.contract.value.trim();

  if (!rawDomain && !contract) {
    alert("Por favor introduce un dominio, un contrato o ambos.");
    return;
  }

  // ── 2. Normalizar dominio para evitar variantes ───────────────
  const cleanDomain = rawDomain
    ? rawDomain
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/[#?].*$/, "")
        .replace(/\/.*$/, "")
        .trim()
    : null;

  /* Tu flujo n8n espera `target` y `contract` */
  const payload = {};
  if (cleanDomain) payload.target = cleanDomain;
  if (contract)    payload.contract = contract;

  // ── 3. UI “Analizando…” ───────────────────────────────────────
  resetResult();
  spinner.classList.remove("hidden");

  try {
    const res = await fetch(WEBHOOK_URL, {
      method : "POST",
      mode   : "cors",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify(payload),
    });

    // 404 → mensaje amigable
    if (res.status === 404) {
      const { message } = await safeJson(res);
      showMessage(message || "Contrato no encontrado; vuelve más tarde.");
      return;
    }

    // otros códigos ≠ 2xx → error técnico
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status} – ${text}`);
    }

    // 200 OK → mostrar resultados
    const data = await res.json();
    showResult(data);

  } catch (err) {
    console.error(err);
    showMessage("Ha ocurrido un error inesperado. Inténtalo de nuevo.");
  } finally {
    spinner.classList.add("hidden");
  }
});

/* ------------------------------------------------------------------
   Mostrar resultado con puntuaciones
------------------------------------------------------------------ */
function showResult(data) {
  const { mode, riskScore, domainScore, contractScore } = data;

  if (typeof riskScore !== "number" || Number.isNaN(riskScore)) {
    showMessage("Respuesta del servidor sin riskScore válido.");
    console.error("Objeto recibido:", data);
    return;
  }

  // clamp por si alguna fórmula futura se pasa de 100
  const safeRisk = Math.min(Math.max(riskScore, 0), 100);

  // barra de riesgo
  riskBar.style.background = getRiskColor(safeRisk);
  riskBar.style.width      = `${safeRisk}%`;
  riskLabel.textContent    = `${safeRisk.toFixed(1)} / 100`;

  // detalles
  detailsList.innerHTML = `
    <li><strong>Modo:</strong> ${mode}</li>
    ${domainScore   !== undefined ? `<li><strong>domainScore:</strong> ${domainScore}</li>` : ""}
    ${contractScore !== undefined ? `<li><strong>contractScore:</strong> ${contractScore}</li>` : ""}
  `;

  statusMessage.classList.add("hidden");
  resultSection.classList.remove("hidden");
}

/* ------------------------------------------------------------------
   Mostrar mensaje (pendiente, no encontrado, error…)
------------------------------------------------------------------ */
function showMessage(text) {
  statusMessage.textContent = text;
  statusMessage.classList.remove("hidden");

  // Limpia barra y detalles
  riskBar.style.width = "0%";
  riskLabel.textContent = "";
  detailsList.innerHTML = "";

  resultSection.classList.remove("hidden");
}

/* ------------------------------------------------------------------
   Reinicia panel resultados
------------------------------------------------------------------ */
function resetResult() {
  statusMessage.classList.add("hidden");
  resultSection.classList.add("hidden");
}

/* ------------------------------------------------------------------
   Utilidades
------------------------------------------------------------------ */
function getRiskColor(score) {
  if (score < 34) return "#2ecc71"; // verde
  if (score < 67) return "#f1c40f"; // amarillo
  return "#e74c3c";                 // rojo
}

async function safeJson(res) {
  try   { return await res.json(); }
  catch { return {}; }
}
// ── Fin del código ───────────────────────────────────────────────