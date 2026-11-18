// Test sans navigateur : génère les 10 cartes, simule des parties IA contre IA (avec brouillard
// et radar), puis une partie hôte/invité reliée par une fausse connexion réseau.
// Usage : node tools/sim-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];

function mkCtx(online) {
  const ctxP = new Proxy({}, {
    get: (t, k) => {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (k === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      return k in t ? t[k] : () => {};
    },
    set: (t, k, v) => { t[k] = v; return true; }
  });
  const el = () => ({ getContext: () => ctxP, addEventListener() {}, appendChild() {}, classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, clientWidth: 150, getBoundingClientRect: () => ({}), toDataURL: () => 'data:', setPointerCapture() {} });
  const g = { console, Math, JSON, Set, Map, Array, Object, Promise, Uint8Array, Uint8ClampedArray, setTimeout: () => 0, clearTimeout() {},
    document: { getElementById: el, createElement: el, createTextNode: () => ({}), querySelectorAll: () => [], addEventListener() {} }, setInterval: () => 0,
    innerWidth: 1200, innerHeight: 800, addEventListener() {}, performance: { now: () => 0 }, requestAnimationFrame() {},
    navigator: { onLine: online }, location: { protocol: 'file:' } };
  g.window = g; vm.createContext(g); vm.runInContext(src, g); return g;
}
const run = (c, code) => vm.runInContext(code, c);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ÉCHEC : ' + msg); } };

// 1) Les 10 cartes : génération + 4 minutes d'IA contre IA
const S = mkCtx(false);
for (const id of JSON.parse(run(S, 'JSON.stringify(MAPS.map(m=>m.id))'))) {
  run(S, `startGame('solo', '${id}', 1.15); aiTeams.add(0);`);
  const info = JSON.parse(run(S, `JSON.stringify({ W, obs: obstacles.length, dep: deposits.length,
    baseOk: BASES.every(b => obstacles.every(o => Math.hypot(o.x-b.x,o.y-b.y) > o.r + 300)),
    depOk: deposits.every(d => obstacles.every(o => Math.hypot(o.x-d.x,o.y-d.y) > o.r + 30)) })`));
  for (let i = 0; i < 20 * 240 && !run(S, 'over'); i++) { run(S, 'update(0.05)'); if (i % 3 === 0) run(S, 'updateFog(0.15)'); }
  const r = JSON.parse(run(S, `JSON.stringify({ t: fmtT(gameT), n: [0,1].map(t=>ents.filter(e=>e.team===t).length),
    radar: ents.some(e=>e.type==='radar'), stuck: ents.filter(e=>e.d.unit && obstacles.some(o=>Math.hypot(o.x-e.x,o.y-e.y) < o.r - 2)).length,
    explored: explored.reduce((a,b)=>a+b,0) / explored.length })`));
  console.log(`${id.padEnd(10)} ${info.W}px  obstacles ${String(info.obs).padStart(2)}  gisements ${info.dep}  | ${r.t}  unités ${r.n.join(' vs ')}  radar IA ${r.radar ? 'oui' : 'non'}  exploré ${(r.explored * 100).toFixed(0)}%`);
  check(info.baseOk, id + ' : obstacle trop près d\'une base');
  check(info.depOk, id + ' : gisement sur un obstacle');
  check(r.stuck === 0, id + ` : ${r.stuck} unité(s) dans un obstacle`);
  check(info.dep >= 20, id + ' : pas assez de gisements');
}

// 1b) Radar : un ennemi hors de vue mais dans le rayon doit apparaître comme écho
run(S, "startGame('solo','plaines',1.15); aiTeams.clear(); updateFog(1);");
run(S, "const rd=spawn('radar',0,BASES[0].x+120,BASES[0].y); res[0].e=2000; update(0.05); fogT=0; updateFog(1);");
check(run(S, "radarBlips.some(e=>e.type==='architecte')") === false, 'Architecte ennemi (2900 m) ne devrait pas être détecté');
run(S, "const en=ents.find(e=>e.team===1); en.x=BASES[0].x+900; en.y=BASES[0].y-600; fogT=0; updateFog(1);");
check(run(S, "radarBlips.length") === 1 && run(S, "isVis(radarBlips[0])") === false, "le radar devrait détecter l'ennemi caché");
run(S, "res[0].e=0; ents.forEach(e=>{ if(e.d.prodE) e.built=0.5; }); update(0.05); fogT=0; updateFog(1);");
check(run(S, "radarBlips.length") === 0, 'un radar sans énergie ne devrait rien détecter');
console.log("Radar : détection et consommation d'énergie vérifiées");

// 2) Hôte / invité
const H = mkCtx(true), G = mkCtx(true);
H.__toG = m => G.onNet(JSON.parse(JSON.stringify(m)));
G.__toH = m => H.onNet(JSON.parse(JSON.stringify(m)));
run(G, "net.conn={open:true,send:m=>__toH(m),close(){}};");
run(H, "net.conn={open:true,send:m=>__toG(m),close(){}}; startGame('host','canyon',1); net.conn.send({t:'start',map:'canyon',fog:true});");
check(run(G, 'mapDef.id') === 'canyon' && run(G, 'W') === run(H, 'W'), 'la carte de l\'invité diffère de celle de l\'hôte');
for (let i = 0; i < 20 * 60; i++) {
  run(H, 'update(0.05)'); if (i % 3 === 0) run(H, 'sendSnap()'); run(G, 'guestUpdate(0.05)'); if (i % 3 === 0) run(G, 'updateFog(0.15)');
  if (i === 40) run(G, `(()=>{const c=ents.find(e=>e.team===ME&&e.type==='architecte'); sel=new Set([c]); placing='extracteur'; placeFirst=true;
    const dp=deposits.filter(d=>!depTaken(d)).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0]; tryPlace(dp.x,dp.y,false); placing=null;})()`);
}
const view = c => run(c, "JSON.stringify(ents.filter(e=>e.team===1).map(e=>e.type))");
console.log('Hôte voit équipe 1 :', view(H), '| invité :', view(G));
check(view(H) === view(G) && view(H).includes('extracteur'), 'synchro réseau incorrecte');
check(run(G, "isVis(ents.find(e=>e.team===0&&e.type==='architecte'))") === false, 'l\'Architecte adverse devrait être caché par le brouillard');
console.log(fails ? `${fails} ÉCHEC(S)` : 'OK : cartes, brouillard et synchro réseau corrects');
process.exit(fails ? 1 : 0);
