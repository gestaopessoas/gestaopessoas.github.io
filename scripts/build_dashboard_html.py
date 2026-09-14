import json, os

with open('scripts/custos_geral_clean.json', 'r', encoding='utf-8') as f:
    clean_data = json.load(f)

json_data_str = json.dumps(clean_data, ensure_ascii=False)

# Read HTML template from a clean text file to avoid any f-string backslash escaping issues
template_head = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>Dashboard Executivo de Custos</title>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<style>
:root{
  --bg:#07101f;--bg2:#0b1628;--panel:#101d31;--panel2:#13223a;--line:#253754;
  --text:#eef4ff;--muted:#8fa3c2;--accent:#66b5ff;--accent2:#d5a94d;--good:#5fd3a2;
  --warn:#f4c363;--danger:#ff7c86;--shadow:0 18px 55px rgba(0,0,0,.28);
  --radius:20px;--sidebar:330px;
}
html[data-theme="light"]{
  --bg:#eef3f9;--bg2:#f8fafc;--panel:#ffffff;--panel2:#f4f7fb;--line:#d9e2ee;
  --text:#172236;--muted:#66758d;--accent:#287fd1;--accent2:#9d7320;--good:#168863;
  --warn:#aa7416;--danger:#c84652;--shadow:0 18px 50px rgba(48,65,88,.12);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  color:var(--text);background:
  radial-gradient(circle at 8% -10%,rgba(102,181,255,.12),transparent 28%),
  radial-gradient(circle at 92% 4%,rgba(213,169,77,.08),transparent 25%),var(--bg);
  min-height:100vh}
button,input,select{font:inherit}
button{cursor:pointer}
::selection{background:rgba(102,181,255,.28)}
.app{display:grid;grid-template-columns:var(--sidebar) minmax(0,1fr);min-height:100vh}
.sidebar{position:sticky;top:0;height:100vh;overflow:auto;padding:24px 18px;border-right:1px solid var(--line);
  background:linear-gradient(180deg,rgba(16,29,49,.94),rgba(7,16,31,.96));backdrop-filter:blur(18px);z-index:20}
html[data-theme="light"] .sidebar{background:rgba(248,250,252,.96)}
.brand{padding:8px 8px 20px;border-bottom:1px solid var(--line);margin-bottom:20px}
.brand-kicker{display:flex;gap:8px;align-items:center;color:var(--accent2);font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase}
.brand h1{font-size:21px;line-height:1.12;margin:8px 0 8px;letter-spacing:-.02em}
.brand p{margin:0;color:var(--muted);font-size:12px;line-height:1.45}
.status-dot{width:7px;height:7px;border-radius:50%;background:var(--good);box-shadow:0 0 0 4px rgba(95,211,162,.12)}
.section-title{font-size:11px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.13em;margin:22px 8px 10px;display:flex;justify-content:space-between;align-items:center}
.field{margin:0 6px 13px;position:relative}
.field label{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--muted);font-weight:700;margin:0 2px 6px}
.control{width:100%;border:1px solid var(--line);border-radius:12px;background:var(--panel2);color:var(--text);padding:10px 11px;outline:none;transition:.18s}
.control:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(102,181,255,.11)}

/* Multi-select styling */
.ms-container{position:relative;width:100%}
.ms-trigger{display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;text-align:left;gap:6px}
.ms-trigger-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;font-size:12px}
.ms-trigger-meta{display:flex;align-items:center;gap:5px}
.ms-badge{background:var(--accent);color:#fff;font-size:10px;font-weight:800;border-radius:999px;padding:2px 7px}
.ms-arrow{font-size:10px;color:var(--muted);transition:.2s}
.ms-container.open .ms-arrow{transform:rotate(180deg)}
.ms-panel{position:absolute;top:calc(100% + 4px);left:0;right:0;background:var(--panel);border:1px solid var(--line);
  border-radius:14px;box-shadow:var(--shadow);z-index:100;display:none;padding:8px;max-height:300px;flex-direction:column;gap:6px}
.ms-container.open .ms-panel{display:flex}
.ms-search{width:100%;padding:6px 9px;font-size:11px;border:1px solid var(--line);border-radius:8px;background:var(--panel2);color:var(--text);outline:none}
.ms-actions{display:flex;justify-content:space-between;gap:6px;padding:2px 4px;font-size:10px}
.ms-link{color:var(--accent);cursor:pointer;font-weight:700;border:none;background:none;padding:0}
.ms-link:hover{text-decoration:underline}
.ms-list{overflow-y:auto;max-height:200px;display:flex;flex-direction:column;gap:2px;padding-right:2px}
.ms-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;transition:.14s;font-size:11px;user-select:none}
.ms-item:hover{background:rgba(102,181,255,.08)}
.ms-item input[type="checkbox"]{accent-color:var(--accent);cursor:pointer;width:14px;height:14px;margin:0}
.ms-item-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ms-item-count{font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums}

.range-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.sidebar-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 6px}
.btn{border:1px solid var(--line);background:var(--panel2);color:var(--text);border-radius:12px;padding:10px 12px;font-weight:750;font-size:12px;transition:.18s;display:inline-flex;align-items:center;justify-content:center;gap:7px}
.btn:hover{transform:translateY(-1px);border-color:rgba(102,181,255,.55)}
.btn.primary{background:linear-gradient(135deg,#2b78bd,#3e98e9);border-color:transparent;color:#fff}
.btn.gold{background:linear-gradient(135deg,#a67b26,#d0a64f);border-color:transparent;color:#fff}
.btn.wide{width:100%;margin-top:8px}
.import-zone{border:2px dashed var(--line);border-radius:14px;padding:14px 10px;text-align:center;margin:8px 6px 0;transition:.2s;background:rgba(255,255,255,.015);cursor:pointer}
.import-zone:hover,.import-zone.dragover{border-color:var(--accent);background:rgba(102,181,255,.06)}
.import-zone-title{font-size:12px;font-weight:750;margin-bottom:3px;color:var(--text)}
.import-zone-sub{font-size:10px;color:var(--muted);line-height:1.4}

.main{min-width:0;padding:28px 30px 56px}
.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:24px}
.eyebrow{color:var(--accent2);font-size:11px;text-transform:uppercase;letter-spacing:.17em;font-weight:850}
.topbar h2{font-size:30px;letter-spacing:-.035em;line-height:1.1;margin:7px 0 7px}
.subtitle{color:var(--muted);font-size:13px}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}
.toolbar .btn{padding:9px 11px}
.scopebar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:18px}
.scope-label{font-size:11px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.11em;margin-right:2px}
.chip{border:1px solid var(--line);background:var(--panel2);border-radius:999px;padding:5px 10px;font-size:11px;color:var(--text);display:inline-flex;align-items:center;gap:6px}
.chip strong{color:var(--accent)}
.chip-del{cursor:pointer;color:var(--muted);font-weight:bold;padding:0 2px;border-radius:50%}
.chip-del:hover{color:var(--danger)}

.kpis{display:grid;grid-template-columns:repeat(6,minmax(145px,1fr));gap:12px;margin-bottom:16px}
.card{background:linear-gradient(180deg,rgba(19,34,58,.96),rgba(14,28,48,.96));border:1px solid var(--line);
  border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;position:relative}
html[data-theme="light"] .card{background:var(--panel)}
.card::before{content:"";position:absolute;left:0;top:0;width:100%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent)}
.kpi{padding:16px 16px 14px;min-height:114px}
.kpi-label{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.11em;font-weight:850;display:flex;justify-content:space-between}
.kpi-icon{font-size:14px;color:var(--accent)}
.kpi-value{font-size:23px;font-weight:850;letter-spacing:-.035em;margin-top:13px;white-space:nowrap}
.kpi-meta{font-size:10px;color:var(--muted);margin-top:6px;line-height:1.3}
.grid-2{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(320px,.9fr);gap:14px;margin-bottom:14px}
.grid-3{display:grid;grid-template-columns:1.05fr 1fr 1fr;gap:14px;margin-bottom:14px}
.card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:17px 18px 0}
.card-head h3{font-size:14px;margin:0;font-weight:800;letter-spacing:-.01em}
.card-head p{font-size:10px;color:var(--muted);margin:4px 0 0}
.card-body{padding:14px 18px 18px}
.explorer-controls{display:grid;grid-template-columns:1.25fr 1.25fr .75fr .85fr .85fr;gap:8px;padding:14px 18px 0}
.explorer-controls .control{padding:8px 9px;font-size:11px}
.bar-chart{display:grid;gap:9px;margin-top:4px}
.bar-row{display:grid;grid-template-columns:minmax(95px,180px) 1fr auto;gap:10px;align-items:center}
.bar-label{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)}
.bar-track{height:8px;border-radius:20px;background:rgba(143,163,194,.12);overflow:hidden}
.bar-fill{height:100%;width:0;border-radius:20px;background:linear-gradient(90deg,var(--accent),#8bc8ff);transition:width .65s cubic-bezier(.2,.8,.2,1)}
.bar-val{font-size:10px;color:var(--muted);font-variant-numeric:tabular-nums;min-width:72px;text-align:right}
.donut-wrap{display:grid;grid-template-columns:150px 1fr;gap:16px;align-items:center}
.donut{width:140px;height:140px;border-radius:50%;position:relative;margin:auto;box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}
.donut::after{content:"";position:absolute;inset:25px;background:var(--panel);border-radius:50%;border:1px solid var(--line)}
.donut-center{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
.donut-center strong{font-size:16px;text-align:center}.donut-center span{font-size:9px;color:var(--muted)}
.legend{display:grid;gap:8px;max-height:180px;overflow-y:auto}.legend-item{display:grid;grid-template-columns:8px 1fr auto;gap:8px;align-items:center;font-size:10px}
.legend-dot{width:7px;height:7px;border-radius:50%}.legend-item span:nth-child(2){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.legend-item b{color:var(--muted)}
.mini-bars{display:grid;gap:12px}.mini-row{display:grid;grid-template-columns:84px 1fr auto;gap:9px;align-items:center;font-size:10px}
.mini-track{height:7px;background:rgba(143,163,194,.12);border-radius:12px;overflow:hidden}.mini-fill{height:100%;background:linear-gradient(90deg,var(--accent2),#efc975);border-radius:12px;transition:width .6s}
.scatter{width:100%;height:230px;display:block}.axis{stroke:var(--line);stroke-width:1}.gridline{stroke:var(--line);stroke-width:.5;opacity:.48}.dot{fill:var(--accent);opacity:.55;transition:.18s}.dot:hover{opacity:1;r:5}.axis-text{fill:var(--muted);font-size:9px}
.insights{display:grid;gap:9px}.insight{display:grid;grid-template-columns:28px 1fr;gap:10px;padding:10px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.018)}
.insight-icon{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:rgba(102,181,255,.1);color:var(--accent);font-size:13px}
.insight b{display:block;font-size:10px;margin-bottom:3px}.insight p{font-size:10px;line-height:1.42;color:var(--muted);margin:0}
.matrix{width:100%;border-collapse:collapse;font-size:10px}.matrix th,.matrix td{padding:8px 7px;border-bottom:1px solid var(--line);text-align:right}
.matrix th:first-child,.matrix td:first-child{text-align:left}.matrix th{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.07em}
.matrix tr:last-child td{border-bottom:0}
.table-card{margin-top:14px}.table-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px 5px}
.table-meta{font-size:10px;color:var(--muted)}
.table-wrap{overflow:auto;padding:6px 12px 12px}
.data-table{width:100%;border-collapse:separate;border-spacing:0;font-size:10px;min-width:980px}
.data-table th{position:sticky;top:0;background:var(--panel);z-index:2;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.07em;text-align:left;border-bottom:1px solid var(--line);padding:10px}
.data-table th button{all:unset;cursor:pointer}
.data-table td{padding:10px;border-bottom:1px solid rgba(37,55,84,.55);white-space:nowrap}.data-table tbody tr{transition:.16s;cursor:pointer}
.data-table tbody tr:hover{background:rgba(102,181,255,.06)}.num{text-align:right!important;font-variant-numeric:tabular-nums}
.badge{display:inline-flex;align-items:center;border-radius:999px;padding:3px 7px;border:1px solid var(--line);font-size:9px}
.badge.direct{color:var(--good);background:rgba(95,211,162,.06);border-color:rgba(95,211,162,.2)}
.badge.indirect{color:var(--warn);background:rgba(244,195,99,.06);border-color:rgba(244,195,99,.2)}
.badge.active{color:var(--good);background:rgba(95,211,162,.1)}
.badge.inactive{color:var(--danger);background:rgba(255,124,134,.1)}
.pagination{display:flex;align-items:center;justify-content:flex-end;gap:7px;padding:0 18px 16px}.page-label{font-size:10px;color:var(--muted)}
.empty{padding:34px 20px;text-align:center;color:var(--muted);font-size:12px;border:1px dashed var(--line);border-radius:14px}
dialog{border:1px solid var(--line);border-radius:20px;background:var(--panel);color:var(--text);box-shadow:var(--shadow);width:min(760px,calc(100% - 28px));padding:0}
dialog::backdrop{background:rgba(1,7,15,.74);backdrop-filter:blur(5px)}
.modal-head{padding:20px 22px 14px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:20px}
.modal-head h3{margin:0;font-size:18px}.modal-head p{margin:5px 0 0;color:var(--muted);font-size:11px}
.modal-close{width:32px;height:32px;border-radius:10px;border:1px solid var(--line);background:var(--panel2);color:var(--text)}
.modal-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:18px 22px;max-height:65vh;overflow-y:auto}
.detail{padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--panel2)}.detail span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.07em}.detail b{display:block;margin-top:6px;font-size:12px}
.toast{position:fixed;right:22px;bottom:22px;background:var(--text);color:var(--bg);padding:10px 14px;border-radius:12px;font-size:11px;font-weight:750;box-shadow:var(--shadow);transform:translateY(20px);opacity:0;pointer-events:none;transition:.25s;z-index:200}
.toast.show{transform:translateY(0);opacity:1}
.reveal{animation:rise .55s both}.reveal:nth-child(2){animation-delay:.04s}.reveal:nth-child(3){animation-delay:.08s}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (max-width:1280px){.kpis{grid-template-columns:repeat(3,1fr)}.grid-3{grid-template-columns:1fr 1fr}.grid-3>.card:last-child{grid-column:1/-1}}
@media (max-width:980px){.app{grid-template-columns:1fr}.sidebar{position:relative;height:auto;border-right:0;border-bottom:1px solid var(--line)}.main{padding:22px 16px 40px}.grid-2,.grid-3{grid-template-columns:1fr}.grid-3>.card:last-child{grid-column:auto}.explorer-controls{grid-template-columns:1fr 1fr}.topbar{flex-direction:column}.toolbar{justify-content:flex-start}.kpis{grid-template-columns:repeat(2,1fr)}}
@media (max-width:600px){.kpis{grid-template-columns:1fr}.explorer-controls{grid-template-columns:1fr}.donut-wrap{grid-template-columns:1fr}.modal-grid{grid-template-columns:1fr 1fr}.topbar h2{font-size:25px}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
@media print{
  :root{--bg:#fff;--panel:#fff;--panel2:#fff;--text:#111827;--muted:#64748b;--line:#d9e2ee;--shadow:none}
  body{background:#fff}.app{display:block}.sidebar,.toolbar,.pagination,.table-toolbar .btn{display:none!important}.main{padding:0}.card{break-inside:avoid;box-shadow:none}.topbar{margin-bottom:14px}.kpis{grid-template-columns:repeat(3,1fr)}.grid-2,.grid-3{grid-template-columns:1fr 1fr}.table-card{break-before:page}.data-table{min-width:0;font-size:8px}
}
</style>
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-kicker"><span class="status-dot"></span> análise executiva offline</div>
      <h1>Custos & Pessoas</h1>
      <p id="brandSub">Base carregada: Custos Geral 01092026</p>
    </div>

    <div class="section-title">
      <span>Filtros do recorte</span>
      <button class="ms-link" id="resetFiltersLink" title="Limpar todos os filtros">Limpar</button>
    </div>

    <!-- Status Filter -->
    <div class="field">
      <label>Status <span id="countStatus"></span></label>
      <div class="ms-container" id="msStatusContainer">
        <div class="control ms-trigger" id="msStatusTrigger">
          <span class="ms-trigger-text" id="msStatusText">Ativo</span>
          <div class="ms-trigger-meta">
            <span class="ms-arrow">▾</span>
          </div>
        </div>
        <div class="ms-panel" id="msStatusPanel">
          <div class="ms-actions">
            <button class="ms-link" id="msStatusAll">Marcar todos</button>
            <button class="ms-link" id="msStatusNone">Limpar</button>
          </div>
          <div class="ms-list" id="msStatusList"></div>
        </div>
      </div>
    </div>

    <!-- Setor Filter (MULTI-SELECT) -->
    <div class="field">
      <label>Setor <span id="countSetor"></span></label>
      <div class="ms-container" id="msSetorContainer">
        <div class="control ms-trigger" id="msSetorTrigger">
          <span class="ms-trigger-text" id="msSetorText">Todos os setores</span>
          <div class="ms-trigger-meta">
            <span class="ms-arrow">▾</span>
          </div>
        </div>
        <div class="ms-panel" id="msSetorPanel">
          <input type="search" class="ms-search" id="msSetorSearch" placeholder="Filtrar setores...">
          <div class="ms-actions">
            <button class="ms-link" id="msSetorAll">Marcar todos</button>
            <button class="ms-link" id="msSetorNone">Limpar</button>
          </div>
          <div class="ms-list" id="msSetorList"></div>
        </div>
      </div>
    </div>

    <!-- Centro de Custo Filter (MULTI-SELECT) -->
    <div class="field">
      <label>Centro de Custo <span id="countCentro"></span></label>
      <div class="ms-container" id="msCentroContainer">
        <div class="control ms-trigger" id="msCentroTrigger">
          <span class="ms-trigger-text" id="msCentroText">Todos os centros</span>
          <div class="ms-trigger-meta">
            <span class="ms-arrow">▾</span>
          </div>
        </div>
        <div class="ms-panel" id="msCentroPanel">
          <input type="search" class="ms-search" id="msCentroSearch" placeholder="Filtrar centros...">
          <div class="ms-actions">
            <button class="ms-link" id="msCentroAll">Marcar todos</button>
            <button class="ms-link" id="msCentroNone">Limpar</button>
          </div>
          <div class="ms-list" id="msCentroList"></div>
        </div>
      </div>
    </div>

    <!-- Classificação Filter (MULTI-SELECT) -->
    <div class="field">
      <label>Classificação <span id="countClassificacao"></span></label>
      <div class="ms-container" id="msClassContainer">
        <div class="control ms-trigger" id="msClassTrigger">
          <span class="ms-trigger-text" id="msClassText">Todas</span>
          <div class="ms-trigger-meta">
            <span class="ms-arrow">▾</span>
          </div>
        </div>
        <div class="ms-panel" id="msClassPanel">
          <div class="ms-actions">
            <button class="ms-link" id="msClassAll">Marcar todas</button>
            <button class="ms-link" id="msClassNone">Limpar</button>
          </div>
          <div class="ms-list" id="msClassList"></div>
        </div>
      </div>
    </div>

    <!-- Vínculo Filter (MULTI-SELECT) -->
    <div class="field">
      <label>Vínculo <span id="countVinculo"></span></label>
      <div class="ms-container" id="msVinculoContainer">
        <div class="control ms-trigger" id="msVinculoTrigger">
          <span class="ms-trigger-text" id="msVinculoText">Todos</span>
          <div class="ms-trigger-meta">
            <span class="ms-arrow">▾</span>
          </div>
        </div>
        <div class="ms-panel" id="msVinculoPanel">
          <div class="ms-actions">
            <button class="ms-link" id="msVinculoAll">Marcar todos</button>
            <button class="ms-link" id="msVinculoNone">Limpar</button>
          </div>
          <div class="ms-list" id="msVinculoList"></div>
        </div>
      </div>
    </div>

    <!-- Cargo Filter (MULTI-SELECT) -->
    <div class="field">
      <label>Cargo <span id="countCargo"></span></label>
      <div class="ms-container" id="msCargoContainer">
        <div class="control ms-trigger" id="msCargoTrigger">
          <span class="ms-trigger-text" id="msCargoText">Todos os cargos</span>
          <div class="ms-trigger-meta">
            <span class="ms-arrow">▾</span>
          </div>
        </div>
        <div class="ms-panel" id="msCargoPanel">
          <input type="search" class="ms-search" id="msCargoSearch" placeholder="Filtrar cargos...">
          <div class="ms-actions">
            <button class="ms-link" id="msCargoAll">Marcar todos</button>
            <button class="ms-link" id="msCargoNone">Limpar</button>
          </div>
          <div class="ms-list" id="msCargoList"></div>
        </div>
      </div>
    </div>

    <!-- Search Colaborador -->
    <div class="field">
      <label>Buscar colaborador</label>
      <input id="fPessoa" class="control" type="search" placeholder="Nome, cargo ou matrícula">
    </div>

    <!-- Salary/Cost Range -->
    <div class="field">
      <label>Faixa de custo total</label>
      <div class="range-row">
        <input id="fMin" class="control" type="number" min="0" step="500" placeholder="Mínimo">
        <input id="fMax" class="control" type="number" min="0" step="500" placeholder="Máximo">
      </div>
    </div>

    <div class="sidebar-actions">
      <button class="btn" id="resetFilters">↺ Limpar filtros</button>
      <button class="btn" id="restoreBase">◆ Base original</button>
    </div>

    <div class="section-title">Carregar Planilha</div>
    <input type="file" id="fileInput" accept=".xlsx,.xls,.csv" hidden>
    <div class="import-zone" id="dropZone">
      <div class="import-zone-title">📁 Importar Excel ou CSV</div>
      <div class="import-zone-sub">Clique ou arraste aqui uma planilha igual a <b>Custos Geral</b> ou <b>Custo Limpo</b></div>
    </div>
    <button class="btn primary wide" id="importBtn">＋ Carregar Planilha (.xlsx / .csv)</button>
  </aside>

  <main class="main">
    <header class="topbar reveal">
      <div>
        <div class="eyebrow">Painel para Diretoria</div>
        <h2>Dashboard Executivo de Custos</h2>
        <div class="subtitle" id="subtitle">Leitura integrada de custo, estrutura e concentração.</div>
      </div>
      <div class="toolbar">
        <button class="btn" id="themeBtn">◐ Tema</button>
        <button class="btn" id="fullBtn">⛶ Tela cheia</button>
        <button class="btn" id="csvBtn">⇩ Exportar CSV</button>
        <button class="btn gold" id="printBtn">▣ Imprimir / PDF</button>
      </div>
    </header>

    <div class="scopebar reveal" id="scopeBar">
      <span class="scope-label">Recorte ativo</span><span class="chip"><strong>Base completa</strong></span>
    </div>

    <section class="kpis reveal">
      <article class="card kpi"><div class="kpi-label">Custo total <span class="kpi-icon">◆</span></div><div class="kpi-value" id="kTotal">—</div><div class="kpi-meta" id="kTotalMeta"></div></article>
      <article class="card kpi"><div class="kpi-label">Headcount <span class="kpi-icon">●</span></div><div class="kpi-value" id="kHead">—</div><div class="kpi-meta" id="kHeadMeta"></div></article>
      <article class="card kpi"><div class="kpi-label">Custo médio / pessoa <span class="kpi-icon">↗</span></div><div class="kpi-value" id="kAvg">—</div><div class="kpi-meta" id="kAvgMeta"></div></article>
      <article class="card kpi"><div class="kpi-label">Salário-base <span class="kpi-icon">▰</span></div><div class="kpi-value" id="kSalary">—</div><div class="kpi-meta" id="kSalaryMeta"></div></article>
      <article class="card kpi"><div class="kpi-label">Custos adicionais <span class="kpi-icon">＋</span></div><div class="kpi-value" id="kAdditional">—</div><div class="kpi-meta" id="kAdditionalMeta"></div></article>
      <article class="card kpi"><div class="kpi-label">Adicionais / base <span class="kpi-icon">%</span></div><div class="kpi-value" id="kRatio">—</div><div class="kpi-meta" id="kRatioMeta"></div></article>
    </section>

    <section class="grid-2">
      <article class="card reveal">
        <div class="card-head"><div><h3>Explorador Livre</h3><p>Escolha dimensão, métrica, ordenação e visualização.</p></div><span class="chip" id="explorerSummary">—</span></div>
        <div class="explorer-controls">
          <select id="xDimension" class="control">
            <option value="centro">Centro de Custo</option>
            <option value="setor">Setor</option>
            <option value="vinculo">Vínculo</option>
            <option value="classificacao">Classificação</option>
            <option value="cargo">Cargo</option>
            <option value="departamento">Departamento</option>
            <option value="status">Status</option>
          </select>
          <select id="xMetric" class="control">
            <option value="custoTotal">Custo total</option>
            <option value="headcount">Headcount</option>
            <option value="custoMedio">Custo médio</option>
            <option value="salarioBase">Salário-base</option>
            <option value="custoAdicional">Custos adicionais</option>
            <option value="encargos">Encargos</option>
            <option value="ratio">Adicionais / base</option>
          </select>
          <select id="xTopN" class="control"><option>5</option><option selected>8</option><option>10</option><option>15</option><option>20</option><option value="50">Todos</option></select>
          <select id="xOrder" class="control"><option value="desc">Maior → menor</option><option value="asc">Menor → maior</option></select>
          <select id="xType" class="control"><option value="bar">Barras</option><option value="donut">Donut</option></select>
        </div>
        <div class="card-body" id="explorerChart"></div>
      </article>

      <article class="card reveal">
        <div class="card-head"><div><h3>Insights Executivos</h3><p>Leitura automática do recorte selecionado.</p></div><span class="chip" id="insightCount">—</span></div>
        <div class="card-body"><div class="insights" id="insights"></div></div>
      </article>
    </section>

    <section class="grid-3">
      <article class="card reveal">
        <div class="card-head"><div><h3>Direto × Indireto</h3><p>Composição do custo selecionado.</p></div></div>
        <div class="card-body" id="classChart"></div>
      </article>
      <article class="card reveal">
        <div class="card-head"><div><h3>Vínculos</h3><p>Custo total e representatividade.</p></div></div>
        <div class="card-body" id="vinculoChart"></div>
      </article>
      <article class="card reveal">
        <div class="card-head"><div><h3>Salário-base × Custo</h3><p>Dispersão individual para identificar tickets fora do padrão.</p></div></div>
        <div class="card-body" id="scatterChart"></div>
      </article>
    </section>

    <section class="grid-2">
      <article class="card reveal">
        <div class="card-head"><div><h3>Matriz Centro × Classificação</h3><p>Onde o custo direto e indireto está concentrado.</p></div></div>
        <div class="card-body" id="matrix"></div>
      </article>
      <article class="card reveal">
        <div class="card-head"><div><h3>Composição do custo</h3><p>Salário-base versus componentes adicionais e encargos.</p></div></div>
        <div class="card-body" id="components"></div>
      </article>
    </section>

    <section class="card table-card reveal">
      <div class="table-toolbar">
        <div><h3 style="margin:0;font-size:14px">Detalhamento por colaborador</h3><div class="table-meta" id="tableMeta"></div></div>
        <button class="btn" id="tableCsv">⇩ CSV do recorte</button>
      </div>
      <div class="table-wrap" id="tableWrap"></div>
      <div class="pagination"><button class="btn" id="prevPage">←</button><span class="page-label" id="pageLabel"></span><button class="btn" id="nextPage">→</button></div>
    </section>
  </main>
</div>

<dialog id="personDialog">
  <div class="modal-head"><div><h3 id="modalName">—</h3><p id="modalSub">—</p></div><button class="modal-close" id="modalClose">×</button></div>
  <div class="modal-grid" id="modalGrid"></div>
</dialog>
<div class="toast" id="toast"></div>

<script>
"""

template_js = """
const state = {
  data: JSON.parse(JSON.stringify(BASE_DATA)),
  filters: {
    status: new Set(["Ativo"]),
    setores: new Set(),
    centros: new Set(),
    classificacoes: new Set(),
    vinculos: new Set(),
    cargos: new Set(),
    pessoa: "",
    min: "",
    max: ""
  },
  explorer: {dimension:"centro",metric:"custoTotal",topN:8,order:"desc",type:"bar"},
  table: {sort:"custoTotal",dir:"desc",page:1,pageSize:12}
};

const $ = id => document.getElementById(id);
function storageGet(key){try{return localStorage.getItem(key)}catch(_){return null}}
function storageSet(key,value){try{localStorage.setItem(key,value)}catch(_){}}
const money = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const money2 = new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:2});
const integer = new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0});
const decimal1 = new Intl.NumberFormat("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1});
const palette = ["#66b5ff","#d5a94d","#5fd3a2","#9f8cff","#ff8aa1","#72d9e8","#f4c363","#7ea1ff","#c191ff","#67c7a4","#ed8d62","#9bb0c9"];

const dimLabels = {
  centro:"Centro de Custo",
  setor:"Setor",
  vinculo:"Vínculo",
  classificacao:"Classificação",
  cargo:"Cargo",
  departamento:"Departamento",
  status:"Status"
};

const metricLabels = {
  custoTotal:"Custo total",
  headcount:"Headcount",
  custoMedio:"Custo médio",
  salarioBase:"Salário-base",
  custoAdicional:"Custos adicionais",
  encargos:"Encargos",
  ratio:"Adicionais / base"
};

function sum(arr,key){return arr.reduce((a,r)=>a+(Number(r[key])||0),0)}
function pct(a,b){return b? a/b*100:0}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function formatMetric(v,m){if(m==="headcount") return integer.format(v); if(m==="ratio") return decimal1.format(v)+"%"; return money.format(v)}
function metricValue(rows,m){if(m==="headcount")return rows.length;if(m==="custoMedio")return rows.length?sum(rows,"custoTotal")/rows.length:0;if(m==="ratio")return pct(sum(rows,"custoAdicional"),sum(rows,"salarioBase"));return sum(rows,m)}

function aggregate(rows,dim,metric){
  const groups=new Map();
  rows.forEach(r=>{const k=r[dim]||"Não informado";if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)});
  return [...groups].map(([name,items])=>({name,value:metricValue(items,metric),count:items.length,rows:items}));
}

function fullMetrics(rows){
  const total=sum(rows,"custoTotal"),salary=sum(rows,"salarioBase"),additional=sum(rows,"custoAdicional");
  return{total,head:rows.length,avg:rows.length?total/rows.length:0,salary,additional,ratio:pct(additional,salary)};
}

function applyFilters(){
  const f=state.filters;
  return state.data.filter(r=>{
    if(f.status.size && !f.status.has(r.status)) return false;
    if(f.centros.size && !f.centros.has(r.centro)) return false;
    if(f.setores.size && !f.setores.has(r.setor)) return false;
    if(f.classificacoes.size && !f.classificacoes.has(r.classificacao)) return false;
    if(f.vinculos.size && !f.vinculos.has(r.vinculo)) return false;
    if(f.cargos.size && !f.cargos.has(r.cargo)) return false;
    if(f.pessoa){
      const q=f.pessoa.toLowerCase();
      if(!(`${r.colaborador} ${r.matricula} ${r.cargo} ${r.setor} ${r.centro}`).toLowerCase().includes(q)) return false;
    }
    if(f.min!=="" && r.custoTotal<Number(f.min)) return false;
    if(f.max!=="" && r.custoTotal>Number(f.max)) return false;
    return true;
  });
}

function uniqueValues(key){
  const counts = new Map();
  state.data.forEach(r => {
    const v = r[key] || "Não informado";
    counts.set(v, (counts.get(v) || 0) + 1);
  });
  return [...counts.entries()].sort((a,b) => String(a[0]).localeCompare(String(b[0]), "pt-BR"));
}

/* MultiSelect Component Controller */
class MultiSelectController {
  constructor(config) {
    this.key = config.key;
    this.setKey = config.setKey;
    this.container = $(config.containerId);
    this.trigger = $(config.triggerId);
    this.text = $(config.textId);
    this.panel = $(config.panelId);
    this.list = $(config.listId);
    this.search = config.searchId ? $(config.searchId) : null;
    this.allBtn = $(config.allBtnId);
    this.noneBtn = $(config.noneBtnId);
    this.countEl = config.countId ? $(config.countId) : null;
    this.placeholder = config.placeholder || "Todos";
    this.singularName = config.singularName || "selecionado";
    this.pluralName = config.pluralName || "selecionados";
    
    this.init();
  }

  init() {
    this.trigger.onclick = (e) => {
      e.stopPropagation();
      closeAllPanels(this.container);
      this.container.classList.toggle("open");
      if(this.container.classList.contains("open") && this.search) {
        this.search.value = "";
        this.filterList("");
        setTimeout(() => this.search.focus(), 50);
      }
    };

    if(this.search) {
      this.search.oninput = (e) => this.filterList(e.target.value);
      this.search.onclick = (e) => e.stopPropagation();
    }

    this.allBtn.onclick = (e) => {
      e.stopPropagation();
      const allVals = uniqueValues(this.key).map(x => x[0]);
      state.filters[this.setKey] = new Set(allVals);
      this.updateUI();
      transitionRender();
    };

    this.noneBtn.onclick = (e) => {
      e.stopPropagation();
      state.filters[this.setKey].clear();
      this.updateUI();
      transitionRender();
    };
  }

  populate() {
    const items = uniqueValues(this.key);
    if(this.countEl) this.countEl.textContent = items.length;
    
    this.list.innerHTML = items.map(([val, count]) => {
      const checked = state.filters[this.setKey].has(val) ? "checked" : "";
      return `<label class="ms-item" data-val="${esc(val)}">
        <input type="checkbox" value="${esc(val)}" ${checked}>
        <span class="ms-item-name" title="${esc(val)}">${esc(val)}</span>
        <span class="ms-item-count">${count}</span>
      </label>`;
    }).join("");

    this.list.querySelectorAll("input[type='checkbox']").forEach(cb => {
      cb.onchange = () => {
        const val = cb.value;
        if(cb.checked) state.filters[this.setKey].add(val);
        else state.filters[this.setKey].delete(val);
        this.updateTriggerText();
        transitionRender();
      };
    });

    this.updateTriggerText();
  }

  filterList(query) {
    const q = query.toLowerCase();
    this.list.querySelectorAll(".ms-item").forEach(item => {
      const name = item.querySelector(".ms-item-name").textContent.toLowerCase();
      item.style.display = name.includes(q) ? "flex" : "none";
    });
  }

  updateTriggerText() {
    const selected = state.filters[this.setKey];
    const totalItems = uniqueValues(this.key).length;
    
    if(selected.size === 0 || selected.size === totalItems) {
      this.text.textContent = this.placeholder;
      this.text.style.fontWeight = "normal";
    } else if(selected.size === 1) {
      this.text.textContent = [...selected][0];
      this.text.style.fontWeight = "bold";
    } else {
      this.text.innerHTML = `<span class="ms-badge">${selected.size}</span> ${this.pluralName}`;
      this.text.style.fontWeight = "bold";
    }

    this.list.querySelectorAll("input[type='checkbox']").forEach(cb => {
      cb.checked = selected.has(cb.value);
    });
  }

  updateUI() {
    this.updateTriggerText();
  }
}

let multiSelects = [];

function initMultiSelects() {
  multiSelects = [
    new MultiSelectController({
      key:"status", setKey:"status", containerId:"msStatusContainer", triggerId:"msStatusTrigger",
      textId:"msStatusText", panelId:"msStatusPanel", listId:"msStatusList", searchId:null,
      allBtnId:"msStatusAll", noneBtnId:"msStatusNone", countId:"countStatus",
      placeholder:"Todos os status", singularName:"status", pluralName:"selecionados"
    }),
    new MultiSelectController({
      key:"setor", setKey:"setores", containerId:"msSetorContainer", triggerId:"msSetorTrigger",
      textId:"msSetorText", panelId:"msSetorPanel", listId:"msSetorList", searchId:"msSetorSearch",
      allBtnId:"msSetorAll", noneBtnId:"msSetorNone", countId:"countSetor",
      placeholder:"Todos os setores", singularName:"setor", pluralName:"setores selecionados"
    }),
    new MultiSelectController({
      key:"centro", setKey:"centros", containerId:"msCentroContainer", triggerId:"msCentroTrigger",
      textId:"msCentroText", panelId:"msCentroPanel", listId:"msCentroList", searchId:"msCentroSearch",
      allBtnId:"msCentroAll", noneBtnId:"msCentroNone", countId:"countCentro",
      placeholder:"Todos os centros", singularName:"centro", pluralName:"centros selecionados"
    }),
    new MultiSelectController({
      key:"classificacao", setKey:"classificacoes", containerId:"msClassContainer", triggerId:"msClassTrigger",
      textId:"msClassText", panelId:"msClassPanel", listId:"msClassList", searchId:null,
      allBtnId:"msClassAll", noneBtnId:"msClassNone", countId:"countClassificacao",
      placeholder:"Todas as classes", singularName:"classe", pluralName:"classes selecionadas"
    }),
    new MultiSelectController({
      key:"vinculo", setKey:"vinculos", containerId:"msVinculoContainer", triggerId:"msVinculoTrigger",
      textId:"msVinculoText", panelId:"msVinculoPanel", listId:"msVinculoList", searchId:null,
      allBtnId:"msVinculoAll", noneBtnId:"msVinculoNone", countId:"countVinculo",
      placeholder:"Todos os vínculos", singularName:"vínculo", pluralName:"vínculos selecionados"
    }),
    new MultiSelectController({
      key:"cargo", setKey:"cargos", containerId:"msCargoContainer", triggerId:"msCargoTrigger",
      textId:"msCargoText", panelId:"msCargoPanel", listId:"msCargoList", searchId:"msCargoSearch",
      allBtnId:"msCargoAll", noneBtnId:"msCargoNone", countId:"countCargo",
      placeholder:"Todos os cargos", singularName:"cargo", pluralName:"cargos selecionados"
    })
  ];
}

function closeAllPanels(except) {
  document.querySelectorAll(".ms-container").forEach(c => {
    if(c !== except) c.classList.remove("open");
  });
}

document.addEventListener("click", () => closeAllPanels(null));

function populateAllFilters() {
  multiSelects.forEach(ms => ms.populate());
}

function animateNumber(el,target,formatter){
  if(!Number.isFinite(target))target=0;
  const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const start=Number(el.dataset.value||0),duration=reduce?1:480;
  function frame(now){
    const current = now || ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
    const p=Math.min(1,(current-t0)/duration),e=1-Math.pow(1-p,3),v=start+(target-start)*e;
    el.textContent=formatter(v);
    if(p<1)requestAnimationFrame(frame);
    else el.dataset.value=target;
  }
  requestAnimationFrame(frame);
}

function deltaText(current,base,kind="vs geral"){
  if(!base)return "Sem referência";
  const d=(current/base-1)*100;
  if(Math.abs(d)<.05)return `Em linha ${kind}`;
  return `${d>=0?"+":""}${decimal1.format(d)}% ${kind}`;
}

function renderScope(rows){
  const active=[];
  const f = state.filters;
  
  if(f.status.size > 0 && f.status.size < uniqueValues("status").length) {
    active.push(`<span class="chip">Status: <strong>${[...f.status].join(", ")}</strong> <span class="chip-del" onclick="clearFilter('status')">×</span></span>`);
  }
  if(f.setores.size > 0 && f.setores.size < uniqueValues("setor").length) {
    const txt = f.setores.size <= 2 ? [...f.setores].join(", ") : `${f.setores.size} setores`;
    active.push(`<span class="chip">Setor: <strong>${esc(txt)}</strong> <span class="chip-del" onclick="clearFilter('setores')">×</span></span>`);
  }
  if(f.centros.size > 0 && f.centros.size < uniqueValues("centro").length) {
    const txt = f.centros.size <= 2 ? [...f.centros].join(", ") : `${f.centros.size} centros`;
    active.push(`<span class="chip">Centro: <strong>${esc(txt)}</strong> <span class="chip-del" onclick="clearFilter('centros')">×</span></span>`);
  }
  if(f.classificacoes.size > 0 && f.classificacoes.size < uniqueValues("classificacao").length) {
    active.push(`<span class="chip">Classe: <strong>${[...f.classificacoes].join(", ")}</strong> <span class="chip-del" onclick="clearFilter('classificacoes')">×</span></span>`);
  }
  if(f.vinculos.size > 0 && f.vinculos.size < uniqueValues("vinculo").length) {
    active.push(`<span class="chip">Vínculo: <strong>${[...f.vinculos].join(", ")}</strong> <span class="chip-del" onclick="clearFilter('vinculos')">×</span></span>`);
  }
  if(f.cargos.size > 0 && f.cargos.size < uniqueValues("cargo").length) {
    const txt = f.cargos.size <= 2 ? [...f.cargos].join(", ") : `${f.cargos.size} cargos`;
    active.push(`<span class="chip">Cargo: <strong>${esc(txt)}</strong> <span class="chip-del" onclick="clearFilter('cargos')">×</span></span>`);
  }
  if(f.pessoa) {
    active.push(`<span class="chip">Busca: <strong>${esc(f.pessoa)}</strong> <span class="chip-del" onclick="clearFilter('pessoa')">×</span></span>`);
  }
  if(f.min!=="") active.push(`<span class="chip">Custo ≥ <strong>${money.format(Number(f.min))}</strong> <span class="chip-del" onclick="clearFilter('min')">×</span></span>`);
  if(f.max!=="") active.push(`<span class="chip">Custo ≤ <strong>${money.format(Number(f.max))}</strong> <span class="chip-del" onclick="clearFilter('max')">×</span></span>`);

  $("scopeBar").innerHTML=`<span class="scope-label">Recorte ativo</span>${active.length?active.join(""):`<span class="chip"><strong>Base completa</strong></span>`}<span class="chip">${integer.format(rows.length)} pessoas</span>`;
}

window.clearFilter = function(key) {
  if(state.filters[key] instanceof Set) state.filters[key].clear();
  else state.filters[key] = "";
  if(key === "pessoa") $("fPessoa").value = "";
  if(key === "min") $("fMin").value = "";
  if(key === "max") $("fMax").value = "";
  multiSelects.forEach(ms => ms.updateUI());
  transitionRender();
};

function renderKPIs(rows){
  const m=fullMetrics(rows),g=fullMetrics(state.data);
  animateNumber($("kTotal"),m.total,v=>money.format(v));
  $("kTotalMeta").textContent=`${decimal1.format(pct(m.total,g.total))}% do custo da base`;
  
  animateNumber($("kHead"),m.head,v=>integer.format(v));
  $("kHeadMeta").textContent=`${decimal1.format(pct(m.head,g.head))}% do headcount total`;
  
  animateNumber($("kAvg"),m.avg,v=>money.format(v));
  $("kAvgMeta").textContent=deltaText(m.avg,g.avg);
  
  animateNumber($("kSalary"),m.salary,v=>money.format(v));
  $("kSalaryMeta").textContent=`${decimal1.format(pct(m.salary,m.total))}% do custo do recorte`;
  
  animateNumber($("kAdditional"),m.additional,v=>money.format(v));
  $("kAdditionalMeta").textContent=`${decimal1.format(pct(m.additional,m.total))}% do custo do recorte`;
  
  animateNumber($("kRatio"),m.ratio,v=>decimal1.format(v)+"%");
  $("kRatioMeta").textContent=deltaText(m.ratio,g.ratio,"vs base geral");
}

function barChart(items,metric){
  if(!items.length)return `<div class="empty">Nenhum dado no recorte selecionado.</div>`;
  const max=Math.max(...items.map(x=>x.value),0)||1;
  return `<div class="bar-chart">${items.map(x=>`<div class="bar-row" title="${esc(x.name)}">
    <div class="bar-label">${esc(x.name)}</div><div class="bar-track"><div class="bar-fill" data-w="${Math.max(1,x.value/max*100)}"></div></div>
    <div class="bar-val">${formatMetric(x.value,metric)}</div></div>`).join("")}</div>`;
}

function donutChart(items,metric){
  if(!items.length)return `<div class="empty">Nenhum dado no recorte selecionado.</div>`;
  const total=items.reduce((a,x)=>a+Math.max(0,x.value),0)||1;let cursor=0;const stops=[];
  items.forEach((x,i)=>{const end=cursor+x.value/total*360;stops.push(`${palette[i%palette.length]} ${cursor}deg ${end}deg`);cursor=end});
  return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${stops.join(",")})"><div class="donut-center"><strong>${formatMetric(total,metric)}</strong><span>total exibido</span></div></div>
  <div class="legend">${items.map((x,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${palette[i%palette.length]}"></span><span>${esc(x.name)}</span><b>${decimal1.format(x.value/total*100)}%</b></div>`).join("")}</div></div>`;
}

function activateBars(){requestAnimationFrame(()=>document.querySelectorAll(".bar-fill[data-w]").forEach(el=>el.style.width=el.dataset.w+"%"))}

function renderExplorer(rows){
  let items=aggregate(rows,state.explorer.dimension,state.explorer.metric);
  items.sort((a,b)=>state.explorer.order==="desc"?b.value-a.value:a.value-b.value);
  items=items.slice(0,state.explorer.topN);
  $("explorerSummary").textContent=`${dimLabels[state.explorer.dimension]} · ${metricLabels[state.explorer.metric]}`;
  $("explorerChart").innerHTML=state.explorer.type==="donut"?donutChart(items,state.explorer.metric):barChart(items,state.explorer.metric);
  activateBars();
}

function renderClass(rows){
  const items=aggregate(rows,"classificacao","custoTotal").sort((a,b)=>b.value-a.value);
  $("classChart").innerHTML=donutChart(items,"custoTotal");
}

function renderVinculos(rows){
  const items=aggregate(rows,"vinculo","custoTotal").sort((a,b)=>b.value-a.value),max=items[0]?.value||1,total=items.reduce((a,x)=>a+x.value,0)||1;
  $("vinculoChart").innerHTML=items.length?`<div class="mini-bars">${items.map(x=>`<div class="mini-row"><span>${esc(x.name)}</span><div class="mini-track"><div class="mini-fill" style="width:${x.value/max*100}%"></div></div><b title="${money2.format(x.value)}">${decimal1.format(x.value/total*100)}%</b></div>`).join("")}</div>`:`<div class="empty">Sem dados.</div>`;
}

function renderScatter(rows){
  if(!rows.length){$("scatterChart").innerHTML=`<div class="empty">Sem dados.</div>`;return}
  const w=620,h=235,pad={l:48,r:12,t:10,b:30},maxX=Math.max(...rows.map(r=>r.salarioBase),1),maxY=Math.max(...rows.map(r=>r.custoTotal),1);
  const x=v=>pad.l+(v/maxX)*(w-pad.l-pad.r), y=v=>h-pad.b-(v/maxY)*(h-pad.t-pad.b);
  let grid="";for(let i=0;i<=4;i++){const gy=pad.t+i*(h-pad.t-pad.b)/4;grid+=`<line class="gridline" x1="${pad.l}" y1="${gy}" x2="${w-pad.r}" y2="${gy}"/>`}
  const dots=rows.map(r=>`<circle class="dot" cx="${x(r.salarioBase).toFixed(1)}" cy="${y(r.custoTotal).toFixed(1)}" r="3"><title>${esc(r.colaborador)} · Base ${money2.format(r.salarioBase)} · Custo ${money2.format(r.custoTotal)}</title></circle>`).join("");
  $("scatterChart").innerHTML=`<svg class="scatter" viewBox="0 0 ${w} ${h}" role="img" aria-label="Dispersão salário base por custo total">${grid}<line class="axis" x1="${pad.l}" y1="${h-pad.b}" x2="${w-pad.r}" y2="${h-pad.b}"/><line class="axis" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${h-pad.b}"/>${dots}<text class="axis-text" x="${w/2}" y="${h-6}" text-anchor="middle">Salário-base →</text><text class="axis-text" x="8" y="${h/2}" transform="rotate(-90 8 ${h/2})" text-anchor="middle">Custo total →</text></svg>`;
}

function renderMatrix(rows){
  const centers=uniqueFrom(rows,"centro").map(c=>{
    const rs=rows.filter(r=>r.centro===c),dir=rs.filter(r=>r.classificacao==="Direto"),ind=rs.filter(r=>r.classificacao==="Indireto");
    return{name:c,head:rs.length,direct:sum(dir,"custoTotal"),indirect:sum(ind,"custoTotal"),total:sum(rs,"custoTotal")}
  }).sort((a,b)=>b.total-a.total).slice(0,10);
  $("matrix").innerHTML=centers.length?`<table class="matrix"><thead><tr><th>Centro</th><th>Pessoas</th><th>Direto</th><th>Indireto</th><th>Total</th></tr></thead><tbody>${centers.map(x=>`<tr><td>${esc(x.name)}</td><td>${integer.format(x.head)}</td><td>${money.format(x.direct)}</td><td>${money.format(x.indirect)}</td><td><b>${money.format(x.total)}</b></td></tr>`).join("")}</tbody></table>`:`<div class="empty">Sem dados.</div>`;
}

function uniqueFrom(rows,key){return [...new Set(rows.map(r=>r[key]).filter(Boolean))]}

function renderComponents(rows){
  if(!rows.length){$("components").innerHTML=`<div class="empty">Sem dados.</div>`;return}
  const comps=[
    ["Salário-base",sum(rows,"salarioBase")],
    ["Encargos sociais",sum(rows,"encargos")],
    ["Comissão / Variável",sum(rows,"comissao")],
    ["Alimentação",sum(rows,"alimentacao")],
    ["VR / Auxílios",sum(rows,"vrAuxilios")],
    ["SulClínica",sum(rows,"sulClinica")],
    ["Seguro de Vida",sum(rows,"seguroVida")],
    ["Odonto",sum(rows,"odonto")]
  ].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
  const max=comps[0]?.[1]||1;
  $("components").innerHTML=`<div class="mini-bars">${comps.map(([n,v])=>`<div class="mini-row" style="grid-template-columns:105px 1fr auto"><span>${esc(n)}</span><div class="mini-track"><div class="mini-fill" style="width:${v/max*100}%"></div></div><b>${money.format(v)}</b></div>`).join("")}</div>`;
}

function buildInsights(rows){
  if(!rows.length)return[];
  const m=fullMetrics(rows), overall=fullMetrics(state.data), costGroups=aggregate(rows,state.explorer.dimension,"custoTotal").sort((a,b)=>b.value-a.value);
  const top=costGroups[0],ind=rows.filter(r=>r.classificacao==="Indireto"),direct=rows.filter(r=>r.classificacao==="Direto");
  const top5=[...rows].sort((a,b)=>b.custoTotal-a.custoTotal).slice(0,5),top5Share=pct(sum(top5,"custoTotal"),m.total);
  const link=aggregate(rows,"vinculo","custoMedio").sort((a,b)=>b.value-a.value)[0];
  const addText=m.ratio>overall.ratio?`acima da base geral em ${decimal1.format(m.ratio-overall.ratio)} p.p.`:`abaixo da base geral em ${decimal1.format(overall.ratio-m.ratio)} p.p.`;
  const concentration=top?`${top.name} responde por ${decimal1.format(pct(top.value,m.total))}% do custo do recorte.`:"";
  return [
    {i:"◎",t:"Escala do recorte",p:`${integer.format(rows.length)} pessoas representam ${decimal1.format(pct(m.total,overall.total))}% do custo da base atual (${money2.format(m.total)}).`},
    {i:"◆",t:"Maior concentração",p:`Na dimensão ${dimLabels[state.explorer.dimension].toLowerCase()}, ${concentration}`},
    {i:"↔",t:"Estrutura direto × indireto",p:`O custo indireto é ${money2.format(sum(ind,"custoTotal"))} (${decimal1.format(pct(sum(ind,"custoTotal"),m.total))}%); o direto responde por ${money2.format(sum(direct,"custoTotal"))} (${decimal1.format(pct(sum(direct,"custoTotal"),m.total))}%).`},
    {i:"＋",t:"Pressão dos adicionais",p:`Custos adicionais e encargos equivalem a ${decimal1.format(m.ratio)}% do salário-base e estão ${addText}`},
    {i:"▲",t:"Concentração individual",p:`Os 5 maiores custos individuais concentram ${decimal1.format(top5Share)}% do custo deste recorte.`},
    {i:"◈",t:"Ticket por vínculo",p:link?`${link.name} possui o maior custo médio por pessoa no recorte: ${money2.format(link.value)}.`:"Sem comparação de vínculo disponível."}
  ];
}

function renderInsights(rows){
  const arr=buildInsights(rows);$("insightCount").textContent=`${arr.length} leituras`;
  $("insights").innerHTML=arr.length?arr.map(x=>`<div class="insight"><div class="insight-icon">${x.i}</div><div><b>${x.t}</b><p>${x.p}</p></div></div>`).join(""):`<div class="empty">Ajuste os filtros para gerar uma leitura.</div>`;
}

function sortedRows(rows){
  const {sort,dir}=state.table;
  return [...rows].sort((a,b)=>{
    let av=a[sort],bv=b[sort];
    if(typeof av==="string") return (dir==="asc"?1:-1)*av.localeCompare(bv,"pt-BR");
    return (dir==="asc"?1:-1)*((av||0)-(bv||0));
  });
}

function renderTable(rows){
  const sorted=sortedRows(rows),pages=Math.max(1,Math.ceil(sorted.length/state.table.pageSize));
  state.table.page=Math.min(state.table.page,pages);
  const start=(state.table.page-1)*state.table.pageSize,part=sorted.slice(start,start+state.table.pageSize);
  $("tableMeta").textContent=`${integer.format(rows.length)} registros · clique em uma linha para detalhes completos`;
  const arrow=k=>state.table.sort===k?(state.table.dir==="asc"?" ↑":" ↓"):"";
  
  $("tableWrap").innerHTML=part.length?`<table class="data-table"><thead><tr>
    <th><button data-sort="colaborador">Colaborador${arrow("colaborador")}</button></th>
    <th><button data-sort="cargo">Cargo${arrow("cargo")}</button></th>
    <th><button data-sort="centro">Centro${arrow("centro")}</button></th>
    <th><button data-sort="setor">Setor${arrow("setor")}</button></th>
    <th>Classe</th>
    <th>Vínculo</th>
    <th>Status</th>
    <th class="num"><button data-sort="salarioBase">Salário-base${arrow("salarioBase")}</button></th>
    <th class="num"><button data-sort="custoAdicional">Adicionais${arrow("custoAdicional")}</button></th>
    <th class="num"><button data-sort="custoTotal">Custo total${arrow("custoTotal")}</button></th>
  </tr></thead><tbody>
  ${part.map(r=>`<tr data-idx="${state.data.indexOf(r)}">
    <td><b>${esc(r.colaborador)}</b><br><span style="color:var(--muted)">${esc(r.matricula)}</span></td>
    <td>${esc(r.cargo)}</td>
    <td>${esc(r.centro)}</td>
    <td>${esc(r.setor)}</td>
    <td><span class="badge ${r.classificacao==='Direto'?'direct':'indirect'}">${esc(r.classificacao)}</span></td>
    <td>${esc(r.vinculo)}</td>
    <td><span class="badge ${r.status==='Ativo'?'active':'inactive'}">${esc(r.status)}</span></td>
    <td class="num">${money2.format(r.salarioBase)}</td>
    <td class="num">${money2.format(r.custoAdicional)}</td>
    <td class="num"><b>${money2.format(r.custoTotal)}</b></td>
  </tr>`).join("")}
  </tbody></table>`:`<div class="empty">Nenhum colaborador atende aos filtros atuais.</div>`;
  
  $("pageLabel").textContent=`Página ${state.table.page} de ${pages}`;
  $("prevPage").disabled=state.table.page<=1;
  $("nextPage").disabled=state.table.page>=pages;
  
  document.querySelectorAll("[data-sort]").forEach(b=>b.onclick=()=>{
    const k=b.dataset.sort;
    if(state.table.sort===k) state.table.dir=state.table.dir==="asc"?"desc":"asc";
    else {state.table.sort=k;state.table.dir="desc"}
    renderTable(applyFilters());
  });
  
  document.querySelectorAll("[data-idx]").forEach(tr=>{
    tr.onclick=()=>openPerson(state.data[Number(tr.dataset.idx)]);
  });
}

function openPerson(r){
  if(!r) return;
  $("modalName").textContent=r.colaborador;
  $("modalSub").textContent=`${r.cargo} · ${r.setor} · ${r.centro} (Status: ${r.status})`;
  
  const cells=[
    ["Matrícula / Código", r.matricula || "—"],
    ["Status", r.status || "—"],
    ["Classificação", r.classificacao || "—"],
    ["Centro de Custo", r.centro || "—"],
    ["Setor", r.setor || "—"],
    ["Departamento", r.departamento || "—"],
    ["Vínculo", r.vinculo || "—"],
    ["Plano de Carreira", r.planoCarreira || "—"],
    ["Data de Admissão", r.admissao || "—"],
    ["Salário-Base", money2.format(r.salarioBase)],
    ["Comissão / Variável", money2.format(r.comissao)],
    ["Encargos Sociais", money2.format(r.encargos)],
    ["Alimentação", money2.format(r.alimentacao)],
    ["VR / Auxílios", money2.format(r.vrAuxilios)],
    ["Seguro de Vida", money2.format(r.seguroVida)],
    ["SulClínica", money2.format(r.sulClinica)],
    ["Odonto", money2.format(r.odonto)],
    ["Custo Adicional", money2.format(r.custoAdicional)],
    ["% Adicionais / Base", decimal1.format((r.adicionalPct||0)*100)+"%"],
    ["Custo Total Mensal", money2.format(r.custoTotal)],
    ["Benefícios Detalhe", r.beneficios || "—"]
  ];
  
  $("modalGrid").innerHTML=cells.map(([a,b])=>`<div class="detail"><span>${a}</span><b>${esc(b)}</b></div>`).join("");
  $("personDialog").showModal();
}

function renderAll(){
  const rows=applyFilters();
  renderScope(rows);
  renderKPIs(rows);
  renderExplorer(rows);
  renderInsights(rows);
  renderClass(rows);
  renderVinculos(rows);
  renderScatter(rows);
  renderMatrix(rows);
  renderComponents(rows);
  renderTable(rows);
  $("subtitle").textContent=rows.length===state.data.length?"Leitura integrada de custo, estrutura e concentração.":`Recorte atual: ${integer.format(rows.length)} de ${integer.format(state.data.length)} pessoas.`;
}

function transitionRender(){
  const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(document.startViewTransition && !reduce) {
    document.startViewTransition(()=>renderAll());
  } else {
    renderAll();
  }
}

function debounce(fn,ms=220){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms)}}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800)}

function downloadCSV(rows){
  const cols=[
    ["Status","status"],["Matrícula","matricula"],["Colaborador","colaborador"],["Cargo","cargo"],
    ["Classificação","classificacao"],["Centro de Custo","centro"],["Setor","setor"],
    ["Departamento","departamento"],["Vínculo","vinculo"],["Salário Base","salarioBase"],
    ["Encargos","encargos"],["Comissão/VG","comissao"],["Alimentação","alimentacao"],
    ["Seguro","seguroVida"],["Odonto","odonto"],["SulClínica","sulClinica"],
    ["Custo Adicional","custoAdicional"],["Custo Total","custoTotal"]
  ];
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const headerLine = cols.map(c=>q(c[0])).join(";");
  const dataLines = rows.map(r=>cols.map(([_,k])=>typeof r[k]==="number"?String(r[k]).replace(".",","):q(r[k])).join(";"));
  const text = "\\ufeff" + [headerLine, ...dataLines].join("\\n");
  const blob=new Blob([text],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download="custos_recorte_dashboard.csv";a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

function parseBRNumber(v){
  if(typeof v==="number")return v;
  let s=String(v??"").trim().replace(/[R$\\s]/g,"");
  if(!s || s==="-")return 0;
  if(s.includes(",")&&s.includes(".")) s=s.replace(/\\./g,"").replace(",",".");
  else if(s.includes(",")) s=s.replace(",",".");
  const n=Number(s);
  return Number.isFinite(n)?n:0;
}

function parseCSV(text){
  const lines = text.split(/\\r?\\n/);
  const first = lines[0] || "";
  const delimiter = (first.match(/;/g)||[]).length >= (first.match(/,/g)||[]).length ? ";" : ",";
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++}
      else quoted=!quoted;
    }
    else if(c===delimiter&&!quoted){row.push(cell);cell=""}
    else if((c==="\\n"||c==="\\r")&&!quoted){
      if(c==="\\r"&&text[i+1]==="\\n")i++;
      row.push(cell);cell="";
      if(row.some(x=>x.trim()!==""))rows.push(row);
      row=[];
    }
    else cell+=c;
  }
  if(cell||row.length){row.push(cell);rows.push(row)}
  return rows;
}

/* Universal Spreadsheet Normalizer (Handles Custos Geral 01092026.xlsx and Custo Limpo.xlsx) */
function processImportedMatrix(matrix){
  if(!matrix || matrix.length < 2) throw new Error("Planilha vazia ou sem dados");
  
  let headerRowIdx = -1;
  for(let r=0; r<Math.min(10, matrix.length); r++){
    const rowStr = matrix[r].map(c => String(c??"").toLowerCase().trim()).join(" ");
    if((rowStr.includes("cod") || rowStr.includes("matr")) && (rowStr.includes("nome") || rowStr.includes("colaborador") || rowStr.includes("cargo"))){
      headerRowIdx = r;
      break;
    }
  }
  
  if(headerRowIdx === -1) headerRowIdx = 0;
  
  const headers = matrix[headerRowIdx].map(h => String(h??"").trim());
  const hLower = headers.map(h => h.toLowerCase());
  
  const findCol = (...aliases) => {
    for(const a of aliases) {
      const idx = hLower.findIndex(h => h === a.toLowerCase() || h.includes(a.toLowerCase()));
      if(idx >= 0) return idx;
    }
    return -1;
  };

  const iStatus = findCol("ativo", "status");
  const iCod = findCol("cod", "matrícula", "matricula", "código", "codigo");
  const iSetor = findCol("setor", "área", "area");
  const iNome = findCol("nome", "colaborador", "funcionário", "funcionario");
  const iCargo = findCol("cargo", "função", "funcao");
  const iCentro = findCol("centro custo", "centro de custo", "centro");
  const iDepto = findCol("departamento", "depto");
  const iBase = findCol("salário base", "salario base", "base");
  const iTotal = findCol("total", "custo total");
  const iEncargos = findCol("encargos");
  const iComissao = findCol("com/vg", "comissão", "comissao", "variável", "variavel");
  const iAlimentacao = findCol("alimentação", "alimentacao");
  const iSeguro = findCol("seguro");
  const iOdonto = findCol("odonto");
  const iSulclinica = findCol("sulclinica", "sulclínica");
  const iVr = findCol("vr/auxilios", "vale refeição", "vale refeicao");
  const iVinculo = findCol("vinculo", "vínculo");
  const iAdmissao = findCol("admissão", "admissao");
  const iClass = findCol("classificação", "classificacao");
  
  if(iNome < 0 && iCargo < 0) throw new Error("Não foi possível identificar a coluna de Colaborador ou Cargo");
  
  const records = [];
  for(let r = headerRowIdx + 1; r < matrix.length; r++){
    const row = matrix[r];
    if(!row || !row.some(x => String(x??"").trim() !== "")) continue;
    
    const get = idx => idx >= 0 ? String(row[idx]??"").trim() : "";
    const getNum = idx => idx >= 0 ? parseBRNumber(row[idx]) : 0;
    
    const nome = get(iNome);
    if(!nome || nome.toLowerCase() === "total" || nome.toLowerCase().includes("soma")) continue;
    
    const cargo = get(iCargo).toUpperCase();
    const centro = get(iCentro).toUpperCase() || "SEDE";
    const setor = get(iSetor) || "Não Informado";
    const depto = get(iDepto).toUpperCase();
    
    let status = "Ativo";
    if(iStatus >= 0) {
      const st = get(iStatus).toUpperCase();
      if(st.includes("INATIVO")) status = "Inativo";
      else if(st.includes("ATIVO")) status = "Ativo";
    }
    
    let vinculo = get(iVinculo).toUpperCase() || "CLT";
    if(vinculo.includes("PRO") || vinculo.includes("LABORE")) vinculo = "Pró-Labore";
    else if(vinculo.includes("ESTAG")) vinculo = "Estágio";
    else if(vinculo.includes("PJ")) vinculo = "PJ";
    else vinculo = "CLT";
    
    let classificacao = "Indireto";
    if(iClass >= 0) {
      const cl = get(iClass);
      if(cl.toLowerCase().includes("direto") && !cl.toLowerCase().includes("indireto")) classificacao = "Direto";
      else classificacao = "Indireto";
    } else if(depto === "DIRETO") {
      classificacao = "Direto";
    }
    
    const salarioBase = getNum(iBase);
    let custoTotal = getNum(iTotal);
    const encargos = getNum(iEncargos);
    const comissao = getNum(iComissao);
    const alimentacao = getNum(iAlimentacao);
    const seguro = getNum(iSeguro);
    const odonto = getNum(iOdonto);
    const sulclinica = getNum(iSulclinica);
    const vrAuxilios = getNum(iVr);
    
    if(custoTotal === 0) {
      custoTotal = salarioBase + encargos + comissao + alimentacao + seguro + odonto + sulclinica + vrAuxilios;
    }
    
    const custoAdicional = Math.max(0, custoTotal - salarioBase);
    const adicionalPct = salarioBase > 0 ? custoAdicional / salarioBase : 0;
    
    records.push({
      status: status,
      matricula: get(iCod),
      colaborador: nome,
      cargo: cargo,
      classificacao: classificacao,
      centro: centro,
      setor: setor,
      departamento: depto,
      vinculo: vinculo,
      codigoPc: "",
      planoCarreira: "",
      admissao: get(iAdmissao),
      salarioBase: salarioBase,
      alimentacao: alimentacao,
      comissao: comissao,
      seguroVida: seguro,
      odonto: odonto,
      sulClinica: sulclinica,
      vrAuxilios: vrAuxilios,
      encargos: encargos,
      custoTotal: custoTotal,
      custoAdicional: custoAdicional,
      adicionalPct: adicionalPct,
      beneficios: ""
    });
  }
  
  if(!records.length) throw new Error("Nenhum colaborador válido encontrado na planilha");
  return records;
}

async function handleFileUpload(file){
  if(!file) return;
  const fileName = file.name;
  const ext = fileName.split('.').pop().toLowerCase();
  toast(`Processando ${fileName}...`);
  
  try {
    let matrix = [];
    if(ext === "xlsx" || ext === "xls") {
      if(typeof XLSX === "undefined") throw new Error("Biblioteca Excel (SheetJS) indisponível no momento.");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, {type:"array"});
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes("direto")) ||
                        wb.SheetNames.find(n => n.toLowerCase().includes("geral")) ||
                        wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      matrix = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
    } else if(ext === "csv") {
      const text = await file.text();
      matrix = parseCSV(text);
    } else {
      throw new Error("Formato não suportado. Utilize .xlsx ou .csv.");
    }
    
    const normalized = processImportedMatrix(matrix);
    state.data = normalized;
    $("brandSub").textContent = `Base carregada: ${fileName} (${normalized.length} pessoas)`;
    populateAllFilters();
    resetFilters();
    toast(`${normalized.length} registros carregados com sucesso!`);
  } catch(err) {
    alert("Erro ao importar planilha: " + err.message);
    toast("Erro: " + err.message);
  }
}

function resetFilters(){
  state.filters.status = new Set(["Ativo"]);
  state.filters.setores.clear();
  state.filters.centros.clear();
  state.filters.classificacoes.clear();
  state.filters.vinculos.clear();
  state.filters.cargos.clear();
  state.filters.pessoa = "";
  state.filters.min = "";
  state.filters.max = "";
  
  $("fPessoa").value = "";
  $("fMin").value = "";
  $("fMax").value = "";
  
  multiSelects.forEach(ms => ms.updateUI());
  state.table.page = 1;
  transitionRender();
}

function bind(){
  initMultiSelects();
  populateAllFilters();
  
  $("resetFilters").onclick = resetFilters;
  $("resetFiltersLink").onclick = resetFilters;
  
  $("restoreBase").onclick = () => {
    state.data = JSON.parse(JSON.stringify(ORIGINAL_DATA));
    $("brandSub").textContent = "Base carregada: Custos Geral 01092026";
    populateAllFilters();
    resetFilters();
    toast("Base original restaurada (Custos Geral 01092026)");
  };

  $("fPessoa").addEventListener("input", debounce(e => {
    state.filters.pessoa = e.target.value;
    state.table.page = 1;
    transitionRender();
  }));

  ["fMin","fMax"].forEach(id => {
    $(id).addEventListener("input", debounce(e => {
      state.filters[id==="fMin"?"min":"max"] = e.target.value;
      state.table.page = 1;
      transitionRender();
    }));
  });

  $("xDimension").onchange=e=>{state.explorer.dimension=e.target.value;transitionRender()};
  $("xMetric").onchange=e=>{state.explorer.metric=e.target.value;transitionRender()};
  $("xTopN").onchange=e=>{state.explorer.topN=Number(e.target.value);transitionRender()};
  $("xOrder").onchange=e=>{state.explorer.order=e.target.value;transitionRender()};
  $("xType").onchange=e=>{state.explorer.type=e.target.value;transitionRender()};
  
  $("csvBtn").onclick=$("tableCsv").onclick=()=>downloadCSV(applyFilters());
  $("printBtn").onclick=()=>window.print();
  
  $("themeBtn").onclick=()=>{
    const html=document.documentElement;
    html.dataset.theme=html.dataset.theme==="light"?"dark":"light";
    storageSet("costTheme",html.dataset.theme);
  };

  $("fullBtn").onclick=()=>{
    if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  $("prevPage").onclick=()=>{state.table.page=Math.max(1,state.table.page-1);renderTable(applyFilters())};
  $("nextPage").onclick=()=>{state.table.page++;renderTable(applyFilters())};
  
  $("modalClose").onclick=()=>$("personDialog").close();
  $("personDialog").addEventListener("click",e=>{if(e.target===$("personDialog"))$("personDialog").close()});
  
  $("importBtn").onclick = () => $("fileInput").click();
  $("fileInput").onchange = (e) => {
    const file = e.target.files?.[0];
    if(file) handleFileUpload(file);
    e.target.value = "";
  };

  const dropZone = $("dropZone");
  dropZone.onclick = () => $("fileInput").click();
  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add("dragover"); };
  dropZone.ondragleave = () => dropZone.classList.remove("dragover");
  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if(file) handleFileUpload(file);
  };
}

function init(){
  document.documentElement.dataset.theme=storageGet("costTheme")||"dark";
  bind();
  renderAll();
  activateBars();
}

init();
</script>
</body>
</html>
"""

full_html = template_head + "\nconst BASE_DATA = " + json_data_str + ";\nconst ORIGINAL_DATA = JSON.parse(JSON.stringify(BASE_DATA));\n" + template_js

repo_path = r'c:\Users\ACPO Empreendimentos\Documents\Github\gestaopessoas.github.io\dashboard-custos.html'
with open(repo_path, 'w', encoding='utf-8') as f:
    f.write(full_html)
print("Updated", repo_path)

pub_path = r'c:\Users\ACPO Empreendimentos\Documents\Github\gestaopessoas.github.io\public\dashboard-custos.html'
with open(pub_path, 'w', encoding='utf-8') as f:
    f.write(full_html)
print("Updated", pub_path)

desktop_path = os.path.expanduser('~/Desktop/Dashboard Executivo de Custos.html')
with open(desktop_path, 'w', encoding='utf-8') as f:
    f.write(full_html)
print("Updated", desktop_path)
