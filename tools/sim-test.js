// Test sans navigateur : simule une partie IA contre IA, puis une partie hôte/invité
// reliée par une fausse connexion réseau. Usage : node tools/sim-test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.split('<script>')[1].split('</script>')[0];

function mkCtx(online) {
  const ctxP = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => ({ addColorStop() {} }) : (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  const el = () => ({ getContext: () => ctxP, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, style: {}, dataset: {}, clientWidth: 150, getBoundingClientRect: () => ({}), toDataURL: () => 'data:', setPointerCapture() {} });
  const g = { console, Math, JSON, Set, Map, Array, Object, Promise, setTimeout: () => 0, clearTimeout() {},
    document: { getElementById: el, createElement: el, querySelectorAll: () => [], addEventListener() {} }, setInterval: () => 0,
    innerWidth: 1200, innerHeight: 800, addEventListener() {}, performance: { now: () => 0 }, requestAnimationFrame() {},
    navigator: { onLine: online }, location: { protocol: 'file:' } };
  g.window = g; vm.createContext(g); vm.runInContext(src, g); return g;
}
const run = (c, code) => vm.runInContext(code, c);

// 1) IA contre IA
const S = mkCtx(false);
run(S, "startGame('solo', 7, 1.15); aiTeams.add(0);");
for (let i = 0; i < 20 * 60 * 15 && !run(S, 'over'); i++) run(S, 'update(0.05)');
console.log('IA vs IA : ' + run(S, 'fmtT(gameT)') + ' simulées sans erreur' + (run(S, 'over') ? ' (partie terminée)' : ''));

// 2) Hôte / invité
const H = mkCtx(true), G = mkCtx(true);
H.__toG = m => G.onNet(JSON.parse(JSON.stringify(m)));
G.__toH = m => H.onNet(JSON.parse(JSON.stringify(m)));
run(H, "net.conn={open:true,send:m=>__toG(m),close(){}}; startGame('host',42,1); net.conn.send({t:'start',seed:42});");
run(G, "net.conn={open:true,send:m=>__toH(m),close(){}};");
for (let i = 0; i < 20 * 60; i++) {
  run(H, 'update(0.05)'); if (i % 3 === 0) run(H, 'sendSnap()'); run(G, 'guestUpdate(0.05)');
  if (i === 40) run(G, `(()=>{const c=ents.find(e=>e.team===ME&&e.type==='architecte'); sel=new Set([c]); placing='extracteur'; placeFirst=true;
    const dp=deposits.filter(d=>!depTaken(d)).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0]; tryPlace(dp.x,dp.y,false); placing=null;})()`);
}
const view = c => run(c, "JSON.stringify(ents.filter(e=>e.team===1).map(e=>e.type))");
console.log('Hôte voit équipe 1 :', view(H));
console.log('Invité voit équipe 1:', view(G));
console.log(view(H) === view(G) && view(H).includes('extracteur') ? 'OK : synchro réseau correcte' : 'ÉCHEC synchro réseau');
