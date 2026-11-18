// Test sans navigateur : génère les 10 cartes, simule des parties IA contre IA (avec brouillard
// et radar), des parties IA à 4 joueurs, puis une partie à 3 (hôte + 2 invités) reliée par une fausse connexion réseau.
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
    radar: ents.some(e=>e.type==='radar'), air: ents.filter(e=>e.d.air).length, wk: wrecks.length, stuck: ents.filter(e=>e.d.unit && !e.d.air && obstacles.some(o=>Math.hypot(o.x-e.x,o.y-e.y) < o.r - 2)).length,
    explored: explored.reduce((a,b)=>a+b,0) / explored.length })`));
  console.log(`${id.padEnd(10)} ${info.W}px  obstacles ${String(info.obs).padStart(2)}  gisements ${info.dep}  | ${r.t}  unités ${r.n.join(' vs ')}  radar ${r.radar ? 'oui' : 'non'}  avions ${r.air}  épaves ${r.wk}  exploré ${(r.explored * 100).toFixed(0)}%`);
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

// 1d) Avions, DCA et épaves
run(S, "startGame('solo','plaines',1.15); aiTeams.clear(); fogOn=false; res[0].e=9000; res[1].e=9000;");
run(S, `const b0=BASES[0]; var ch=spawn('chasseur',0,b0.x+300,b0.y-300); var tk=spawn('char',1,b0.x+420,b0.y-300); ch.anc={x:tk.x,y:tk.y};`);
check(run(S, "findEnemy(tk, 400, 0)") === null, 'un char ne devrait pas pouvoir viser un avion');
check(run(S, "findEnemy(ch, 400, 0) === tk"), 'le chasseur devrait viser le char');
for (let i = 0; i < 20 * 25; i++) run(S, 'update(0.05)');
check(run(S, "tk.dead && wrecks.some(w=>w.type==='char')"), 'le chasseur devrait détruire le char et laisser une épave');
run(S, "var dc=spawn('dca',1,ch.x+150,ch.y); for(let i=0;i<20*20;i++) update(0.05);");
check(run(S, "ch.dead && wrecks.some(w=>w.type==='chasseur')"), 'la DCA devrait abattre le chasseur');
check(run(S, "findEnemy(dc, 400, 0) === null || findEnemy(dc,400,0).d.air"), 'la DCA ne doit viser que les avions');
// bombardier contre un bâtiment
run(S, "var bb=spawn('bombardier',0,BASES[0].x,BASES[0].y-200); var ex=spawn('extracteur',1,BASES[0].x+250,BASES[0].y-500); bb.orders=[{type:'attack',target:ex}]; for(let i=0;i<20*40;i++) update(0.05);");
check(run(S, "ex.dead"), 'le bombardier devrait détruire la cible au sol');
// recyclage
const m0 = run(S, "res[0].m=100; const w=wrecks.find(w=>w.type==='char'); var wm=w.m; var cs=spawn('constructeur',0,w.x+150,w.y); applyCmd({k:'reclaim',ids:[cs.id],x:w.x,y:w.y},0); res[0].m");
for (let i = 0; i < 20 * 20; i++) run(S, 'update(0.05)');
check(run(S, "!wrecks.some(w=>w.type==='char') && res[0].m >= 100 + wm - 5"), "le constructeur devrait recycler l'épave en minerai");
console.log('Avions, DCA, bombes et recyclage des épaves vérifiés (épave de char : ' + run(S, 'wm') + ' minerai)');

// 1c) 4 joueurs, tous joués par l'IA : carte à 4 coins, éliminations, dernier survivant
for (const id of ['plaines', 'duel', 'canyon']) {
  run(S, `startGame('solo', '${id}', 1.15, { np: 4 }); aiTeams.add(0);`);
  const L = JSON.parse(run(S, `JSON.stringify({ bases: BASES.length, dep: deposits.length, arch: ents.filter(e => e.type === 'architecte').length,
    baseOk: BASES.every(b => obstacles.every(o => Math.hypot(o.x-b.x,o.y-b.y) > o.r + 300)) })`));
  check(L.bases === 4 && L.arch === 4 && L.baseOk, id + ' : mise en place à 4 joueurs incorrecte');
  for (let i = 0; i < 20 * 900 && !run(S, 'over'); i++) run(S, 'update(0.05)');
  const r = JSON.parse(run(S, `JSON.stringify({ t: fmtT(gameT), elim: [...elim], over, n: [0,1,2,3].map(t => ents.filter(e => e.team === t).length) })`));
  console.log(`4 joueurs ${id.padEnd(8)} gisements ${L.dep} | ${r.t}  éliminés [${r.elim}]  unités ${r.n.join('/')}  ${r.over ? 'partie terminée' : 'en cours'}`);
  check(r.elim.every(t => r.n[t] === 0), id + " : un joueur éliminé a encore des unités");
}

// 2) Hôte + 2 invités (3 joueurs) reliés par une fausse connexion réseau
const H = mkCtx(true), G1 = mkCtx(true), G2 = mkCtx(true);
H.__to = [null, m => G1.onNet(JSON.parse(JSON.stringify(m)), null), m => G2.onNet(JSON.parse(JSON.stringify(m)), null)];
G1.__toH = m => H.onNet(JSON.parse(JSON.stringify(m)), run(H, 'net.conns.find(c=>c.team===1)'));
G2.__toH = m => H.onNet(JSON.parse(JSON.stringify(m)), run(H, 'net.conns.find(c=>c.team===2)'));
for (const G of [G1, G2]) run(G, "net.conn={open:true,send:m=>__toH(m),close(){}};");
run(H, `net.peer = {}; net.np = 3;
  net.conns = [1, 2].map(t => ({ team: t, ready: true, conn: { open: true, send: m => __to[t](m), close() {} } }));
  NP_SEL = 3; selMap = 'canyon'; hostLaunch();`);
check(run(G1, 'ME') === 1 && run(G2, 'ME') === 2 && run(G2, 'NP') === 3, 'équipes des invités incorrectes');
check(run(G2, 'W') === run(H, 'W') && run(G2, 'obstacles.length') === run(H, 'obstacles.length'), 'la carte des invités diffère de celle de l\'hôte');
check(JSON.stringify([...run(H, 'aiTeams')]) === '[]', "aucune IA ne devrait jouer (3 humains)");
const place = `(()=>{const c=ents.find(e=>e.team===ME&&e.type==='architecte'); sel=new Set([c]); placing='extracteur'; placeFirst=true;
    const dp=deposits.filter(d=>!depTaken(d)).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0]; tryPlace(dp.x,dp.y,false); placing=null;})()`;
for (let i = 0; i < 20 * 60; i++) {
  run(H, 'update(0.05)'); if (i % 3 === 0) run(H, 'sendSnap()');
  for (const G of [G1, G2]) { run(G, 'guestUpdate(0.05)'); if (i % 3 === 0) run(G, 'updateFog(0.15)'); }
  if (i === 40) { run(G1, place); run(G2, place); }
}
const view = (c, t) => run(c, `JSON.stringify(ents.filter(e=>e.team===${t}).map(e=>e.type).sort())`);
console.log('Hôte voit équipe 1 :', view(H, 1), '| équipe 2 :', view(H, 2));
check(view(H, 1) === view(G1, 1) && view(H, 2) === view(G2, 2) && view(H, 2) === view(G1, 2) && view(H, 1).includes('extracteur') && view(H, 2).includes('extracteur'), 'synchro réseau incorrecte');
check(run(G1, 'res[ME].m') === Math.floor(run(H, 'res[1].m')) || Math.abs(run(G1, 'res[ME].m') - run(H, 'res[1].m')) < 50, "ressources de l'invité incorrectes");
check(run(G2, "isVis(ents.find(e=>e.team===0&&e.type==='architecte'))") === false, "l'Architecte de l'hôte devrait être caché par le brouillard");
// élimination de l'invité 2 : sa base disparaît chez tout le monde, la partie continue
run(H, "damage(ents.find(e=>e.team===2&&e.type==='architecte'), 1e6, null); for (let i=0;i<30;i++){ update(0.05); if(i%3===0) sendSnap(); }");
for (let i = 0; i < 10; i++) run(G1, 'guestUpdate(0.05)');
check(run(H, 'elim.has(2)') && run(G2, 'spectate') && !run(H, 'over') && run(G1, 'ents.filter(e=>e.team===2).length') === 0, "élimination d'un joueur mal gérée");
for (let i = 0; i < 6; i++) { run(H, 'update(0.05); sendSnap()'); }
check(run(H, 'wrecks.length') > 0 && run(G1, 'wrecks.length') === run(H, 'wrecks.length'), "épaves mal synchronisées chez l'invité");
// déconnexion de l'invité 1 : l'IA reprend son équipe
run(H, 'onNetClose(net.conns.find(c=>c.team===1))');
check(run(H, 'aiTeams.has(1)'), "l'IA devrait reprendre l'équipe d'un invité déconnecté");
console.log(fails ? `${fails} ÉCHEC(S)` : 'OK : cartes, 4 joueurs, avions, épaves, brouillard et synchro réseau corrects');
process.exit(fails ? 1 : 0);
