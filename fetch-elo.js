// fetch-elo.js — baja Elo real (worldcupelo) + forma real últimos 5 (footballratings)
// y escribe ratings.json en el mismo repo → la web lo lee sin CORS.
// Node 20+ (fetch global). Lo corre la GitHub Action 1 vez al día.
const fs = require('fs');
const OUT = 'ratings.json';

// slug (3 letras, lo usa la web) -> nombre en inglés (para casar la forma)
const SLUG2NAME = {
  esp:'Spain',arg:'Argentina',fra:'France',eng:'England',col:'Colombia',bra:'Brazil',por:'Portugal',
  ned:'Netherlands',cro:'Croatia',ecu:'Ecuador',nor:'Norway',ger:'Germany',sui:'Switzerland',uru:'Uruguay',
  tur:'Turkey',jpn:'Japan',sen:'Senegal',den:'Denmark',ita:'Italy',bel:'Belgium',mex:'Mexico',par:'Paraguay',
  aut:'Austria',mar:'Morocco',can:'Canada',ukr:'Ukraine',sco:'Scotland',kor:'South Korea',rus:'Russia',
  aus:'Australia',srb:'Serbia',gre:'Greece',irn:'Iran',usa:'United States',pan:'Panama',nga:'Nigeria',
  pol:'Poland',uzb:'Uzbekistan',cze:'Czechia',chi:'Chile',alg:'Algeria',wal:'Wales',ven:'Venezuela',
  kvx:'Kosovo',per:'Peru',hun:'Hungary',svn:'Slovenia',jor:'Jordan',irl:'Ireland',svk:'Slovakia',bol:'Bolivia',
  alb:'Albania',swe:'Sweden',egy:'Egypt',geo:'Georgia',rou:'Romania',cod:'DR Congo',civ:'Ivory Coast',
  crc:'Costa Rica',isr:'Israel',tun:'Tunisia',cmr:'Cameroon',nir:'Northern Ireland',mkd:'North Macedonia',
  ksa:'Saudi Arabia',mli:'Mali',nzl:'New Zealand',irq:'Iraq',bih:'Bosnia & Herzegovina',hon:'Honduras',
  isl:'Iceland',cpv:'Cape Verde',hai:'Haiti',ang:'Angola',uae:'United Arab Emirates',bfa:'Burkina Faso',
  jam:'Jamaica',rsa:'South Africa',gua:'Guatemala',gha:'Ghana',fin:'Finland',blr:'Belarus',oma:'Oman',
  syr:'Syria',gui:'Guinea',ple:'Palestine',cuw:'Curacao',bul:'Bulgaria',mne:'Montenegro',sur:'Suriname',
  qat:'Qatar',lby:'Libya',gam:'Gambia',bhr:'Bahrain',ben:'Benin',kaz:'Kazakhstan',gab:'Gabon',nig:'Niger'
};
const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
const NAME2SLUG = {};
for (const [slug,name] of Object.entries(SLUG2NAME)) NAME2SLUG[norm(name)] = slug;
NAME2SLUG[norm('Czech Republic')]='cze'; NAME2SLUG[norm('Cote dIvoire')]='civ';
NAME2SLUG[norm('Korea Republic')]='kor'; NAME2SLUG[norm('USA')]='usa'; NAME2SLUG[norm('UAE')]='uae';

const get = u => fetch(u,{headers:{'User-Agent':'Mozilla/5.0 elo-bot'}}).then(r=>r.text());

// recorre cualquier JSON buscando objetos que tengan una forma "WDLWW" y un nombre de equipo conocido
function harvestForms(node, out){
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n=>harvestForms(n,out)); return; }
  const vals = Object.values(node).filter(v=>typeof v==='string');
  const form = vals.find(v=>/^[WDL]{5}$/i.test(v));
  if (form){
    for (const v of vals){ const slug = NAME2SLUG[norm(v)]; if (slug && !out[slug]){ out[slug]=form.toUpperCase(); break; } }
  }
  for (const v of Object.values(node)) if (v && typeof v==='object') harvestForms(v,out);
}

(async () => {
  // 1) ELO real (worldcupelo) — una sola página con tabla de todas las selecciones
  const elos = {};
  try {
    const html = await get('https://worldcupelo.com/');
    const chunks = html.split('/team/');
    for (let k=1;k<chunks.length;k++){
      const c = chunks[k], slug = (c.slice(0,3)||'').toLowerCase();
      if (!/^[a-z]{3}$/.test(slug) || elos[slug]!=null) continue;
      const m = c.slice(0,500).match(/\b(1[3-9]\d\d|2[0-2]\d\d)\b/);
      if (m) elos[slug] = parseInt(m[1],10);
    }
  } catch(e){ console.error('Elo fetch falló:', e.message); }
  if (Object.keys(elos).length < 40) { console.error('Pocos Elo parseados, no sobreescribo.'); process.exit(1); }

  // 2) FORMA real últimos 5 (footballratings) — best effort, no es crítico
  const forms = {};
  try {
    const html = await get('https://www.footballratings.org/');
    const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nd){ try { harvestForms(JSON.parse(nd[1]), forms); } catch(_){} }
    // respaldo: regex sobre el HTML visible (equipos del top)
    const re = /\/team\/([a-z-]+)"[\s\S]{0,400}?Form \(last 5 official\)[A-Za-z]*?([WDL]{5})/g;
    let mm; while ((mm = re.exec(html))){ const slug=NAME2SLUG[norm(mm[1])]; if (slug && !forms[slug]) forms[slug]=mm[2].toUpperCase(); }
  } catch(e){ console.error('Forma fetch falló (sigo sin forma):', e.message); }

  const out = { ...elos };
  out.__date = new Date().toLocaleDateString('es-HN',{day:'numeric',month:'short',year:'numeric'});
  if (Object.keys(forms).length) out.__form = forms;

  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`OK · ${Object.keys(elos).length} Elo · ${Object.keys(forms).length} con forma real · ${out.__date}`);
})();
