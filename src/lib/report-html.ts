import { formatBRL, type OverviewMetrics } from "@/lib/api";

/** Escapa texto para inserção segura em HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PALETTE = [
  "#0ea5a4",
  "#6366f1",
  "#f59e0b",
  "#ec4899",
  "#22c55e",
  "#3b82f6",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#eab308",
];

/** Constrói o caminho SVG de uma fatia de rosca (donut). */
function donutSlice(cx: number, cy: number, r: number, start: number, end: number): string {
  const a0 = (start - 0.25) * 2 * Math.PI;
  const a1 = (end - 0.25) * 2 * Math.PI;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = end - start > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

/**
 * Gera um dashboard HTML completo, autossuficiente (CSS embutido) e navegável,
 * pronto para download, a partir das métricas do período.
 */
export function buildReportHtml(data: OverviewMetrics): string {
  const generatedAt = new Date().toLocaleString("pt-BR");
  const totalGeral = data.byCategory.reduce((s, c) => s + c.total, 0) || 1;
  const totalLanc = data.byCategory.reduce((s, c) => s + c.count, 0);
  const maxWeekly = Math.max(1, ...data.weekly.map((w) => w.aprovados + w.recusados));

  // Donut por categoria
  let acc = 0;
  const slices = data.byCategory
    .map((c, i) => {
      const frac = c.total / totalGeral;
      const path = donutSlice(90, 90, 88, acc, acc + frac);
      acc += frac;
      return `<path d="${path}" fill="${PALETTE[i % PALETTE.length]}" stroke="#fff" stroke-width="1.5"></path>`;
    })
    .join("");

  const legend = data.byCategory
    .map(
      (c, i) => `<li>
      <span class="dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
      <span class="lg-label">${esc(c.label)}</span>
      <span class="lg-val">${esc(formatBRL(c.total))} · ${Math.round((c.total / totalGeral) * 100)}%</span>
    </li>`,
    )
    .join("");

  const weeklyBars = data.weekly
    .map((w) => {
      const ah = Math.round((w.aprovados / maxWeekly) * 160);
      const rh = Math.round((w.recusados / maxWeekly) * 160);
      return `<div class="wk">
      <div class="wk-bars">
        <div class="bar bar-a" style="height:${ah}px" title="${w.aprovados} aprovados"></div>
        <div class="bar bar-r" style="height:${rh}px" title="${w.recusados} recusados"></div>
      </div>
      <span class="wk-label">${esc(w.week)}</span>
    </div>`;
    })
    .join("");

  const statusBars = data.byStatus
    .map((s) => {
      const maxS = Math.max(1, ...data.byStatus.map((x) => x.count));
      const pct = Math.round((s.count / maxS) * 100);
      return `<div class="st-row">
      <span class="st-label">${esc(s.label)}</span>
      <div class="st-track"><div class="st-fill" style="width:${pct}%"></div></div>
      <span class="st-count">${s.count}</span>
    </div>`;
    })
    .join("");

  const catRows = data.byCategory
    .map(
      (c) => `<tr>
      <td>${esc(c.label)}</td>
      <td class="num">${c.count}</td>
      <td class="num strong">${esc(formatBRL(c.total))}</td>
      <td class="num">${Math.round((c.total / totalGeral) * 100)}%</td>
    </tr>`,
    )
    .join("");

  const criticalRows = data.critical.length
    ? data.critical
        .map(
          (c) => `<tr>
        <td>${esc(c.protocol)}</td>
        <td>${esc(c.employeeName)}</td>
        <td class="num">${esc(formatBRL(c.amount))}</td>
        <td><span class="tag tag-${esc(c.kind)}">${esc(c.detail)}</span></td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="muted">Nenhuma pendência crítica no período. 🎉</td></tr>`;

  const topCat = data.byCategory[0];

  const kpis: Array<{ label: string; value: string; hint: string }> = [
    { label: "Reembolsado no mês", value: formatBRL(data.totalReimbursedMonth), hint: `${data.approvedThisMonth} despesas aprovadas` },
    { label: "Em análise", value: String(data.inAnalysis), hint: "aguardando decisão" },
    { label: "Tempo médio de aprovação", value: `${data.avgDecisionHours.toLocaleString("pt-BR")}h`, hint: "do envio à decisão" },
    { label: "Concordância com a IA", value: `${data.agreementRate}%`, hint: "decisões alinhadas" },
    { label: "Aprovação automática", value: `${data.autoApprovalRate}%`, hint: "elegíveis sem revisão" },
    { label: "Recusado por política", value: formatBRL(data.rejectedByPolicyAmount), hint: "economia bloqueada" },
  ];

  const kpiCards = kpis
    .map(
      (k) => `<div class="kpi">
      <p class="kpi-val">${esc(k.value)}</p>
      <p class="kpi-label">${esc(k.label)}</p>
      <p class="kpi-hint">${esc(k.hint)}</p>
    </div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Relatório de Reembolsos · ${esc(generatedAt)}</title>
<style>
  :root{
    --bg:#f6f8f8; --card:#fff; --ink:#0f2e2e; --muted:#5b6b6b; --line:#e3eaea;
    --brand:#0ea5a4; --success:#22c55e; --danger:#ef4444; --warning:#f59e0b;
  }
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:var(--bg);color:var(--ink);line-height:1.5}
  .wrap{max-width:1080px;margin:0 auto;padding:32px 20px 64px}
  header.hero{background:linear-gradient(135deg,#0f2e2e,#0ea5a4);color:#fff;border-radius:18px;padding:28px 32px;margin-bottom:24px;box-shadow:0 12px 30px -12px rgba(15,46,46,.5)}
  header.hero h1{margin:0;font-size:26px;letter-spacing:-.02em}
  header.hero p{margin:6px 0 0;opacity:.85;font-size:14px}
  .meta{display:flex;flex-wrap:wrap;gap:16px;margin-top:16px;font-size:13px;opacity:.9}
  .meta b{font-weight:700}
  nav.toc{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 24px}
  nav.toc a{font-size:13px;text-decoration:none;color:var(--brand);background:var(--card);border:1px solid var(--line);padding:7px 14px;border-radius:999px;transition:.15s}
  nav.toc a:hover{background:var(--brand);color:#fff;border-color:var(--brand)}
  section{scroll-margin-top:16px}
  h2{font-size:17px;margin:32px 0 14px;letter-spacing:-.01em}
  .grid-kpi{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:14px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
  .kpi-val{margin:0;font-size:23px;font-weight:700;letter-spacing:-.02em}
  .kpi-label{margin:6px 0 0;font-size:13px;font-weight:600}
  .kpi-hint{margin:2px 0 0;font-size:12px;color:var(--muted)}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  @media(max-width:720px){.cols{grid-template-columns:1fr}}
  .panel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
  .panel h3{margin:0 0 16px;font-size:15px}
  .donut-wrap{display:flex;align-items:center;gap:20px;flex-wrap:wrap}
  .legend{list-style:none;margin:0;padding:0;flex:1;min-width:180px}
  .legend li{display:flex;align-items:center;gap:8px;font-size:13px;padding:4px 0}
  .legend .dot{width:11px;height:11px;border-radius:3px;flex:none}
  .legend .lg-label{flex:1}
  .legend .lg-val{color:var(--muted);font-variant-numeric:tabular-nums}
  .weekly{display:flex;align-items:flex-end;gap:18px;height:190px;padding-top:10px}
  .wk{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;justify-content:flex-end}
  .wk-bars{display:flex;align-items:flex-end;gap:5px;height:160px}
  .bar{width:18px;border-radius:5px 5px 0 0}
  .bar-a{background:var(--success)} .bar-r{background:var(--danger)}
  .wk-label{font-size:12px;color:var(--muted)}
  .chart-legend{display:flex;gap:16px;font-size:12px;color:var(--muted);margin-top:12px}
  .chart-legend span{display:inline-flex;align-items:center;gap:6px}
  .chart-legend i{width:10px;height:10px;border-radius:3px;display:inline-block}
  .st-row{display:flex;align-items:center;gap:12px;margin-bottom:12px;font-size:13px}
  .st-label{width:120px;flex:none}
  .st-track{flex:1;height:9px;background:#eef3f3;border-radius:999px;overflow:hidden}
  .st-fill{height:100%;background:var(--brand);border-radius:999px}
  .st-count{width:34px;text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
  td.strong{font-weight:700}
  tfoot td{font-weight:700;border-top:2px solid var(--line)}
  .muted{color:var(--muted);text-align:center;padding:18px}
  .tag{font-size:12px;padding:3px 9px;border-radius:999px;background:#eef3f3;color:var(--ink)}
  .tag-limite{background:#fff4e0;color:#9a5b00}
  .tag-confianca{background:#fff4e0;color:#9a5b00}
  .tag-sem_cnpj{background:#fdeaea;color:#a01919}
  .tag-duplicidade{background:#e9f0ff;color:#274b9e}
  .insights{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media(max-width:720px){.insights{grid-template-columns:1fr}}
  .insight{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--brand);border-radius:12px;padding:14px 16px;font-size:13.5px}
  .insight b{color:var(--ink)}
  footer{margin-top:40px;text-align:center;font-size:12px;color:var(--muted)}
  .print-btn{position:fixed;right:18px;bottom:18px;background:var(--brand);color:#fff;border:none;border-radius:999px;padding:12px 18px;font-size:14px;font-weight:600;box-shadow:0 8px 20px -6px rgba(14,165,164,.6);cursor:pointer}
  @media print{.print-btn,nav.toc{display:none}body{background:#fff}.panel,.kpi,.insight{box-shadow:none}}
</style>
</head>
<body>
<div class="wrap">
  <header class="hero">
    <h1>Relatório de Reembolsos</h1>
    <p>Consolidado do período · gerado pela plataforma reembolso.ia.br</p>
    <div class="meta">
      <span><b>${esc(formatBRL(data.totalReimbursedMonth))}</b> reembolsados</span>
      <span><b>${totalLanc}</b> lançamentos</span>
      <span><b>${data.agreementRate}%</b> concordância com a IA</span>
      <span>Gerado em <b>${esc(generatedAt)}</b></span>
    </div>
  </header>

  <nav class="toc">
    <a href="#kpis">Indicadores</a>
    <a href="#categorias">Categorias</a>
    <a href="#evolucao">Evolução</a>
    <a href="#status">Status</a>
    <a href="#insights">Insights</a>
    <a href="#criticas">Pendências críticas</a>
  </nav>

  <section id="kpis">
    <h2>Indicadores do período</h2>
    <div class="grid-kpi">${kpiCards}</div>
  </section>

  <div class="cols">
    <section id="categorias">
      <h2>Distribuição por categoria</h2>
      <div class="panel">
        <div class="donut-wrap">
          <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="Distribuição por categoria">
            ${slices}
            <circle cx="90" cy="90" r="50" fill="#fff"></circle>
            <text x="90" y="84" text-anchor="middle" font-size="11" fill="#5b6b6b">Total</text>
            <text x="90" y="103" text-anchor="middle" font-size="15" font-weight="700" fill="#0f2e2e">${esc(formatBRL(totalGeral))}</text>
          </svg>
          <ul class="legend">${legend}</ul>
        </div>
      </div>
    </section>

    <section id="status">
      <h2>Status das despesas</h2>
      <div class="panel">
        <h3>Distribuição atual</h3>
        ${statusBars || '<p class="muted">Sem dados de status.</p>'}
      </div>
    </section>
  </div>

  <section id="evolucao">
    <h2>Evolução semanal</h2>
    <div class="panel">
      <h3>Aprovados x recusados nas últimas semanas</h3>
      <div class="weekly">${weeklyBars}</div>
      <div class="chart-legend">
        <span><i style="background:var(--success)"></i>Aprovados</span>
        <span><i style="background:var(--danger)"></i>Recusados</span>
      </div>
    </div>
  </section>

  <section id="insights">
    <h2>Insights automáticos</h2>
    <div class="insights">
      <div class="insight">Categoria com maior gasto: <b>${topCat ? esc(topCat.label) : "—"}</b>${topCat ? ` (${esc(formatBRL(topCat.total))}, ${Math.round((topCat.total / totalGeral) * 100)}% do total)` : ""}.</div>
      <div class="insight"><b>${data.autoApprovalRate}%</b> das despesas seriam elegíveis para aprovação automática pela IA.</div>
      <div class="insight">A política bloqueou <b>${esc(formatBRL(data.rejectedByPolicyAmount))}</b> em despesas fora das regras.</div>
      <div class="insight">A decisão humana concordou com a IA em <b>${data.agreementRate}%</b> dos casos decididos.</div>
      <div class="insight"><b>${data.flaggedForReview}</b> despesas foram sinalizadas pela IA para revisão manual.</div>
      <div class="insight">Tempo médio do envio à decisão: <b>${data.avgDecisionHours.toLocaleString("pt-BR")}h</b>.</div>
    </div>
  </section>

  <section id="tabela">
    <h2>Consolidado por categoria</h2>
    <div class="panel" style="padding:0;overflow:hidden">
      <table>
        <thead><tr><th>Categoria</th><th class="num">Lançamentos</th><th class="num">Total</th><th class="num">% do total</th></tr></thead>
        <tbody>${catRows}</tbody>
        <tfoot><tr><td>Total geral</td><td class="num">${totalLanc}</td><td class="num">${esc(formatBRL(totalGeral))}</td><td class="num">100%</td></tr></tfoot>
      </table>
    </div>
  </section>

  <section id="criticas">
    <h2>Pendências críticas</h2>
    <div class="panel" style="padding:0;overflow:hidden">
      <table>
        <thead><tr><th>Protocolo</th><th>Colaborador</th><th class="num">Valor</th><th>Motivo</th></tr></thead>
        <tbody>${criticalRows}</tbody>
      </table>
    </div>
  </section>

  <footer>Relatório gerado automaticamente por reembolso.ia.br · ${esc(generatedAt)}</footer>
</div>
<button class="print-btn" onclick="window.print()">Imprimir / Salvar PDF</button>
</body>
</html>`;
}
