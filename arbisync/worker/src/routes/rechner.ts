/**
 * Einfache Test-Seite (Modul 1): API-Key + Amazon-Preis eingeben → Ergebnis.
 * Wird in Modul 6 durch das Dashboard ersetzt. Enthält keine Daten – der Key
 * wird nur im Browser eingegeben und per Header an /api/calc geschickt.
 */
export const RECHNER_HTML = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ArbiSync Rechner</title>
<style>
  :root{--bg:#f7f7f5;--card:#fff;--text:#1d1d1b;--muted:#6b6b66;--line:#e2e2dc;--ok:#1f7a3a;--bad:#b3261e;--accent:#1d4ed8}
  @media (prefers-color-scheme:dark){:root{--bg:#161615;--card:#20201e;--text:#ededea;--muted:#a3a39d;--line:#34342f;--ok:#4ade80;--bad:#f87171;--accent:#93b4ff}}
  body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,sans-serif}
  main{max-width:520px;margin:32px auto;padding:0 16px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin-bottom:16px}
  label{display:block;font-size:14px;color:var(--muted);margin:12px 0 4px}
  input{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text);font-size:16px}
  button{margin-top:16px;width:100%;padding:12px;border:0;border-radius:8px;background:var(--accent);color:#fff;font-size:16px;cursor:pointer}
  table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid var(--line)}td:last-child{text-align:right;font-variant-numeric:tabular-nums}
  .ampel{font-weight:600;padding:10px;border-radius:8px;margin-bottom:12px}
  .gruen{color:var(--ok);border:1px solid var(--ok)}.rot{color:var(--bad);border:1px solid var(--bad)}
  small{color:var(--muted)}
</style></head><body><main>
<h1>ArbiSync Rechner</h1>
<div class="card">
  <label for="k">API-Key (aus deiner .env)</label><input id="k" type="password" autocomplete="off">
  <label for="p">Amazon-Preis brutto in €</label><input id="p" inputmode="decimal" placeholder="z. B. 119,00">
  <label for="v">Eigener eBay-Preis brutto (optional – leer = Empfehlung)</label><input id="v" inputmode="decimal">
  <button id="go">Berechnen</button>
</div>
<div class="card" id="out" hidden></div>
<small>Test-Seite aus Modul 1. Es wird nichts gespeichert und nichts an eBay gesendet.</small>
</main><script>
const $=id=>document.getElementById(id);
const num=s=>{s=String(s).trim();return Number(s.includes(',')?s.replace(/\\./g,'').replace(',','.'):s);};
const eur=n=>n.toLocaleString('de-DE',{style:'currency',currency:'EUR'});
const pct=n=>(n*100).toLocaleString('de-DE',{maximumFractionDigits:1})+' %';
$('go').onclick=async()=>{
  const out=$('out');out.hidden=false;out.textContent='Rechne …';
  const body={amazonPriceGross:num($('p').value)};
  if($('v').value.trim())body.vkGross=num($('v').value);
  try{
    const r=await fetch('/api/calc',{method:'POST',headers:{'Content-Type':'application/json','X-API-Key':$('k').value.trim()},body:JSON.stringify(body)});
    const d=await r.json();
    if(!r.ok){out.innerHTML='<div class="ampel rot"></div>';out.firstChild.textContent='Fehler: '+d.error;return;}
    if(d.reachable===false){out.innerHTML='<div class="ampel rot"></div>';out.firstChild.textContent='Rot – nicht listen: '+d.reason;return;}
    const b=d.breakdown;
    const rows=[['EK netto',eur(b.ekNet)],['Vorsteuer',eur(b.inputVat)],['eBay-VK brutto',eur(b.vkGross)],['VK netto',eur(b.vkNet)],['USt',eur(b.vat)],
      ['eBay-Gebühren ('+d.feeCategory+')',eur(b.ebayFees)],['Retourenpuffer',eur(b.returnBuffer)],['Eigenversand',eur(b.ownShipping)],
      ['Gewinn netto',eur(b.profitNet)],['Marge',pct(b.marginPct)],['Aufschlag auf Amazon',pct(b.markupPct)]];
    out.innerHTML='<div class="ampel '+(b.meetsRules?'gruen">Grün – Regeln erfüllt':'rot">Rot – Regel 15 € / 10 % nicht erfüllt')+'</div><table>'+
      rows.map(r=>'<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>').join('')+'</table>';
  }catch(e){out.textContent='Server nicht erreichbar: '+e.message;}
};
</script></body></html>`;
