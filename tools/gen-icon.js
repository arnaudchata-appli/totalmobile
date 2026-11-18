// Générateur de l'icône (étoile rouge sur fond noir).
// Usage (depuis un dossier temporaire) : node <repo>/tools/gen-icon.js
// Produit icon.svg + un fichier HTML par taille, à convertir en PNG avec Chrome headless :
//   chrome --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
//          --window-size=512,512 --screenshot=icon-512.png file:///<dossier>/icon-512.html
// Tailles : icon-192 (192), icon-512 / maskable-512 (512), icon-only / icon-foreground / icon-background (1024),
//           splash / splash-dark (2732). Copier icon-192, icon-512, maskable-512, icon.svg dans icons/,
//           et icon-only, icon-foreground, icon-background, splash, splash-dark dans assets/.
const fs=require('fs');
const C=256, R=200, r=R*0.382;
const P=(rad,a)=>[C+Math.cos(a)*rad, C+Math.sin(a)*rad];
const f=p=>p.map(v=>v.toFixed(1)).join(',');
let facets='';
for(let i=0;i<5;i++){
  const a=-Math.PI/2+i*2*Math.PI/5;
  const tip=P(R,a), il=P(r,a-Math.PI/5), ir=P(r,a+Math.PI/5);
  // facette gauche plus claire, droite plus sombre (lumière en haut à gauche)
  const lightL = [ '#ff5a4a','#ff4636','#e0221c','#c4161a','#ff6656' ][i];
  const darkR  = [ '#b5121a','#a10f16','#7d0a10','#8e0c13','#c2161c' ][i];
  facets+=`<polygon points="${f([C,C])} ${f(tip)} ${f(il)}" fill="${lightL}"/>`;
  facets+=`<polygon points="${f([C,C])} ${f(tip)} ${f(ir)}" fill="${darkR}"/>`;
}
let outline=[];
for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5; outline.push(f(P(i%2?r:R,a))); }
const defs=`<defs>
<radialGradient id="bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#1a1a1a"/><stop offset=".6" stop-color="#070707"/><stop offset="1" stop-color="#000"/></radialGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#ff1a1a" stop-opacity=".45"/><stop offset=".55" stop-color="#ff0000" stop-opacity=".12"/><stop offset="1" stop-color="#ff0000" stop-opacity="0"/></radialGradient>
<linearGradient id="shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>`;
const emblem=`<g>
<circle cx="256" cy="262" r="250" fill="url(#glow)"/>
<polygon points="${outline.join(' ')}" fill="#000" transform="translate(0 10)" opacity=".6"/>
${facets}
<polygon points="${outline.join(' ')}" fill="url(#shine)"/>
<polygon points="${outline.join(' ')}" fill="none" stroke="#5a0408" stroke-width="7" stroke-linejoin="round"/>
<polygon points="${outline.join(' ')}" fill="none" stroke="#ff8a7a" stroke-width="2" stroke-linejoin="round" stroke-opacity=".7"/>
</g>`;
function svg(w,h,bg,s){const tx=w/2-256*s, ty=h/2-256*s;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs}${bg?`<rect width="${w}" height="${h}" fill="url(#bg)"/>`:''}${bg==='bgonly'?'':`<g transform="translate(${tx} ${ty}) scale(${s})">${emblem}</g>`}</svg>`;}
const jobs={'icon-192':[192,192,true,192/512*0.92],'icon-512':[512,512,true,0.92],'maskable-512':[512,512,true,0.7],
 'icon-only':[1024,1024,true,2*0.92],'icon-foreground':[1024,1024,false,2*0.58],'icon-background':[1024,1024,'bgonly',2],
 'splash':[2732,2732,true,1.5],'splash-dark':[2732,2732,true,1.5]};
fs.writeFileSync('icon.svg',svg(512,512,true,0.92));
for(const [n,[w,h,bg,s]] of Object.entries(jobs)) fs.writeFileSync(n+'.html',`<!DOCTYPE html><html><head><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block}</style></head><body>${svg(w,h,bg,s)}</body></html>`);
