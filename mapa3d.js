/* Mapa 3D do auditório (three.js), no estilo de mapa de teatro: vista de cima e de frente,
 * palco escuro na frente, cadeiras coloridas por região.
 * Uso: import { criarMapa3D } from './mapa3d.js';
 *      const m = criarMapa3D(elemento, { local: LOCAIS['verbo-cg'], setores:['A',...], alvo:{setor:'A',num:12} });
 *      m.focar('H',130); m.visaoGeral(); m.destruir();
 * Cada setor do local precisa de "arco" e "fileiras"; as cores vêm de local.grupos (ver locais.js).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const BASE_CLARO = { piso: 0xffffff, plataforma: 0xeceaf0, plataformaFora: 0xf6f5f8, cadeiraFora: 0xe4e1e8, palco: 0x3a3238, palcoTopo: 0x4a4048, alvo: 0xf0a20b, vazia: 0xb9b2bb, presente: 0x2f9a62, sombra: .10, ceu: 0xf1eaec, salaPiso: 0xe2d8da, salaParede: 0xd8c8cc, telao: 0x2a2226 };
const BASE_ESCURO = { piso: 0x151011, plataforma: 0x3a3135, plataformaFora: 0x262022, cadeiraFora: 0x463c41, palco: 0x5b4f56, palcoTopo: 0x6c5f67, alvo: 0xf0a20b, vazia: 0x5e5459, presente: 0x3bb174, sombra: .35, ceu: 0x161112, salaPiso: 0x221b1d, salaParede: 0x2c2326, telao: 0x0d0a0b };

function svgParaPontos(d) {
  const t = d.match(/[MLHVZmlhvz]|-?[\d.]+/g) || [];
  const pts = []; let x = 0, y = 0, cmd = '';
  for (let i = 0; i < t.length;) {
    if (/[A-Za-z]/.test(t[i])) { cmd = t[i++]; if (cmd === 'Z' || cmd === 'z') continue; }
    if (cmd === 'M' || cmd === 'L') { x = +t[i++]; y = +t[i++]; }
    else if (cmd === 'm' || cmd === 'l') { x += +t[i++]; y += +t[i++]; }
    else if (cmd === 'H') x = +t[i++]; else if (cmd === 'h') x += +t[i++];
    else if (cmd === 'V') y = +t[i++]; else if (cmd === 'v') y += +t[i++];
    else { i++; continue; }
    pts.push([x, y]);
  }
  return pts;
}

function selo(texto, cor) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = cor; g.stroke();
  g.font = "800 58px 'Nunito Sans', system-ui, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = cor; g.fillText(texto, 64, 68);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false, transparent: true }));
  s.scale.set(30, 30, 1); s.renderOrder = 10;
  return s;
}

function textoPlano(texto, larg, alt) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.font = "800 120px 'Nunito Sans', system-ui, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,.88)'; g.fillText(texto, 256, 136);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(larg, alt), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function corDoSetor(local, setor) {
  const g = (local.grupos || []).find(x => x.setores.indexOf(setor) >= 0);
  return g ? g.cor : '#9b8a9a';
}

export function criarMapa3D(el, opts) {
  const BASE = document.documentElement.getAttribute('data-tema') === 'escuro' ? BASE_ESCURO : BASE_CLARO;
  const loc = opts.local;
  const usados = new Set(opts.setores || Object.keys(loc.setores));
  const P = (r, a) => { const t = a * Math.PI / 180; return [r * Math.cos(t), -r * Math.sin(t)]; };
  const corSetor = k => new THREE.Color(corDoSetor(loc, k));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.preservar });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';

  const cena = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 1, 6000);
  const ctr = new OrbitControls(cam, renderer.domElement);
  ctr.enableDamping = true; ctr.dampingFactor = .08; ctr.enablePan = false;
  ctr.minDistance = 260; ctr.maxDistance = 1700;
  ctr.minPolarAngle = Math.PI * .06; ctr.maxPolarAngle = Math.PI * .42;
  ctr.minAzimuthAngle = -Math.PI * .45; ctr.maxAzimuthAngle = Math.PI * .45;

  const hemi = new THREE.HemisphereLight(0xffffff, 0xe9e4ee, 1.35); cena.add(hemi);
  const sol = new THREE.DirectionalLight(0xffffff, 1.5);
  sol.position.set(-320, 700, 520); sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0008;
  Object.assign(sol.shadow.camera, { left: -640, right: 640, top: 640, bottom: -640, near: 10, far: 2200 });
  sol.target.position.set(0, 0, -220); cena.add(sol, sol.target);

  // sombra suave no chão (só recebe sombra; o fundo da página aparece)
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.ShadowMaterial({ opacity: BASE.sombra }));
  chao.rotation.x = -Math.PI / 2; chao.position.set(0, -.6, -200); chao.receiveShadow = true; cena.add(chao);

  const limites = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  let palco = null, mesaSom = null; // púlpito e bloco do fundo (mesa de som e mídia), para a vista da cadeira
  // palco / púlpito e bloco central
  (loc.extras || []).forEach(x => {
    const pts = svgParaPontos(x.d); if (pts.length < 3) return;
    const cx = loc.centro[0], cy = loc.centro[1];
    pts.forEach(([px, py]) => { limites.x0 = Math.min(limites.x0, px - cx); limites.x1 = Math.max(limites.x1, px - cx); limites.z1 = Math.max(limites.z1, py - cy); });
    const sh = new THREE.Shape(pts.map(([px, py]) => new THREE.Vector2(px - cx, -(py - cy))));
    const alto = x.texto ? 12 : 14;
    const geo = new THREE.ExtrudeGeometry(sh, { depth: alto, bevelEnabled: true, bevelSize: 2.5, bevelThickness: 2.5, bevelSegments: 3 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, [new THREE.MeshStandardMaterial({ color: BASE.palcoTopo, roughness: .6 }), new THREE.MeshStandardMaterial({ color: BASE.palco, roughness: .7 })]);
    m.castShadow = m.receiveShadow = true; cena.add(m);
    { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const pc = { x: (Math.max(...xs) + Math.min(...xs)) / 2 - cx, z: (Math.max(...ys) + Math.min(...ys)) / 2 - cy, alto,
        x0: Math.min(...xs) - cx, x1: Math.max(...xs) - cx, z0: Math.min(...ys) - cy, z1: Math.max(...ys) - cy };
      if (x.texto || !palco) palco = pc; if (!x.texto) mesaSom = pc; }
    if (x.texto) {
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const lg = Math.min((Math.max(...xs) - Math.min(...xs)) * .8, (Math.max(...ys) - Math.min(...ys)) * .9 * 2);
      const t = textoPlano(x.texto.charAt(0) + x.texto.slice(1).toLowerCase(), lg, lg / 2);
      t.position.set((Math.max(...xs) + Math.min(...xs)) / 2 - cx, alto + 2.8, (Math.max(...ys) + Math.min(...ys)) / 2 - cy + 14);
      cena.add(t);
    }
  });

  // setores: plataforma + cadeiras
  const plataformas = {}, selos = {}, posCadeira = {}, cadeirasPorSetor = {}, fileirasPorSetor = {};
  const juntar = partes => {
    const pos = [], nor = [];
    partes.forEach(p => { const q = p.index ? p.toNonIndexed() : p; pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  };
  // mapa: cadeira leve (assento + encosto); vista da cadeira: estofada, com estrutura metálica
  const geoSimples = juntar([new THREE.BoxGeometry(5.6, 1.8, 5.2).translate(0, 3.2, 0), new THREE.BoxGeometry(5.6, 6.4, 1.5).translate(0, 5.6, 2.6)]);
  const geoCad = (() => {
    const partes = [
      new RoundedBoxGeometry(4.9, 1.6, 4.8, 1, .55).translate(0, 3.3, -.1),                 // assento estofado
      new RoundedBoxGeometry(4.9, 6.4, 1.2, 1, .5).rotateX(-.12).translate(0, 7.1, 2.5),    // encosto estofado
      new THREE.BoxGeometry(.35, 3.4, .35).translate(-2.2, 1.0, -2.1),                      // pés (estrutura metálica)
      new THREE.BoxGeometry(.35, 3.4, .35).translate(2.2, 1.0, -2.1),
      new THREE.BoxGeometry(.35, 9.6, .35).rotateX(-.12).translate(-2.2, 4.4, 2.1),        // pé traseiro sobe até o encosto
      new THREE.BoxGeometry(.35, 9.6, .35).rotateX(-.12).translate(2.2, 4.4, 2.1)
    ];
    const pos = [], nor = [];
    partes.forEach(p => { const q = p.toNonIndexed(); pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  })();
  const lista = [];
  Object.keys(loc.setores).sort().forEach(k => {
    const st = loc.setores[k]; if (!st.arco && !st.ret) return;
    const fora = !usados.has(k), sh = new THREE.Shape();
    let ri, ro, a1, a2, R;
    if (st.arco) {
      [ri, ro, a1, a2] = st.arco;
      const p0 = P(ro, a1); sh.moveTo(p0[0], -p0[1]);
      sh.absarc(0, 0, ro, a1 * Math.PI / 180, a2 * Math.PI / 180, false);
      const p2 = P(ri, a2); sh.lineTo(p2[0], -p2[1]);
      sh.absarc(0, 0, ri, a2 * Math.PI / 180, a1 * Math.PI / 180, true);
    } else {
      const [rx, ry, rw, rh] = st.ret; R = { x0: rx - loc.centro[0], z0: ry - loc.centro[1], w: rw, h: rh };
      sh.moveTo(R.x0, -R.z0); sh.lineTo(R.x0 + rw, -R.z0); sh.lineTo(R.x0 + rw, -(R.z0 + rh)); sh.lineTo(R.x0, -(R.z0 + rh)); sh.closePath();
    }
    sh.getPoints(24).forEach(p => { limites.x0 = Math.min(limites.x0, p.x); limites.x1 = Math.max(limites.x1, p.x); limites.z0 = Math.min(limites.z0, -p.y); limites.z1 = Math.max(limites.z1, -p.y); });
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 3, bevelEnabled: false, curveSegments: 48 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: fora ? BASE.plataformaFora : BASE.plataforma, roughness: .95 }));
    m.receiveShadow = true; cena.add(m); plataformas[k] = m;
    const c = st.arco ? P((ri + ro) / 2, (a1 + a2) / 2) : [R.x0 + R.w / 2, R.z0 + R.h / 2];
    const s = selo(k, fora ? '#cfc8d2' : corDoSetor(loc, k)); s.position.set(c[0], 40, c[1]); cena.add(s); selos[k] = s;

    const fil = st.fileiras || []; if (!fil.length) return;
    const n = fil.length, folga = 9, maxLen = Math.max(...fil.map(f => f.length));
    if (R) {
      // o bloco de cadeiras ocupa o retângulo inteiro; a cadeira cresce junto quando o desenho é grande
      const N = st.totalFileiras || n, passo = (R.w - 2 * folga) / maxLen, passoZ = (R.h - 2 * folga) / Math.max(1, N - 1);
      const esc = Math.max(1, Math.min(passo, passoZ) * .72 / 6);
      cadeirasPorSetor[k] = []; cadeirasPorSetor[k].passo = Math.min(passo, passoZ); cadeirasPorSetor[k].tamMax = 7.6 * esc;
      fileirasPorSetor[k] = [];
      fil.forEach((row, i) => {
        const frente = n - 1 - i, z = R.z0 + R.h - folga - frente * passoZ;
        const meia = (maxLen - 1) / 2 * passo + Math.max(passo * .9, 7 * esc);
        fileirasPorSetor[k].push({ n: n - i, esc, rot: Math.PI, pontas: [[R.x0 + R.w / 2 - meia, z], [R.x0 + R.w / 2 + meia, z]] });
        row.forEach((num, j) => {
          const x = R.x0 + R.w / 2 + (j - (row.length - 1) / 2) * passo, idx = lista.length;
          lista.push({ k, num, x, z, fora, rot: Math.PI, esc });
          posCadeira[k + '-' + num] = { x, z, idx, rot: Math.PI, esc };
          cadeirasPorSetor[k].push(idx);
        });
      });
      return;
    }
    const arcoFundo = (ro - folga) * (a2 - a1 - 3) * Math.PI / 180;
    const passo = Math.min(9.5, arcoFundo / maxLen);
    cadeirasPorSetor[k] = []; cadeirasPorSetor[k].passo = passo;
    fileirasPorSetor[k] = [];
    fil.forEach((row, i) => {
      const N = st.totalFileiras || n, frente = n - 1 - i, r = (ri + folga) + frente * ((ro - ri - 2 * folga) / Math.max(1, N - 1));
      const meio = (a1 + a2) / 2, passoAng = passo / r * 180 / Math.PI;
      // na beirada do setor: todas as fileiras ficam na mesma linha reta, viradas para o mesmo lado
      const dentro = 4.2 / r * 180 / Math.PI, m = P(1, meio);
      fileirasPorSetor[k].push({ n: n - i, esc: .9, rot: Math.atan2(m[0], m[1]), pontas: [P(r, a2 - dentro), P(r, a1 + dentro)] });
      row.forEach((num, j) => {
        const [x, z] = P(r, meio + ((row.length - 1) / 2 - j) * passoAng);
        const idx = lista.length;
        lista.push({ k, num, x, z, fora });
        posCadeira[k + '-' + num] = { x, z, idx };
        cadeirasPorSetor[k].push(idx);
      });
    });
  });
  const inst = new THREE.InstancedMesh(geoSimples, new THREE.MeshStandardMaterial({ roughness: .6 }), lista.length);
  const instDet = new THREE.InstancedMesh(geoCad, new THREE.MeshStandardMaterial({ roughness: .78 }), lista.length);
  instDet.castShadow = false; instDet.receiveShadow = true; instDet.visible = false;
  inst.castShadow = true; inst.receiveShadow = true;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color(), cinza = new THREE.Color(BASE.cadeiraFora);
  lista.forEach((c, i) => {
    q.setFromAxisAngle(up, c.rot != null ? c.rot : Math.atan2(c.x, c.z));
    const e = c.esc || 1; mtx.compose(new THREE.Vector3(c.x, 3, c.z), q, new THREE.Vector3(e, e, e));
    inst.setMatrixAt(i, mtx); instDet.setMatrixAt(i, mtx);
  });
  // opts.estado(setor, num) -> 'presente' | 'vazia' | outro: pinta quem chegou de verde e cadeira sem reserva de cinza
  const VERDE = new THREE.Color(BASE.presente), VAZIA = new THREE.Color(BASE.vazia), GRAFITE = new THREE.Color(0x45484c);
  // na vista da cadeira: vendida = grafite escuro (bloqueada), disponível = cinza claro, presente = verde, a sua = dourada
  const VENDIDA_SALA = new THREE.Color(0x2e3033), LIVRE_SALA = new THREE.Color(0xb9bcc2), OURO = new THREE.Color(BASE.alvo);
  let destaqueAtual = null, corSala = false;
  function pintar(destaque) {
    destaqueAtual = destaque;
    lista.forEach((c, i) => {
      if (corSala) {
        const e = opts.estado ? opts.estado(c.k, c.num) : null;
        if (vista && c.k === vista.setor && c.num === vista.num) col.copy(OURO);
        else col.copy(e === 'presente' ? VERDE : e === 'vazia' ? LIVRE_SALA : e ? VENDIDA_SALA : GRAFITE);
      }
      else if (c.fora) col.copy(cinza);
      else {
        const e = opts.estado ? opts.estado(c.k, c.num) : null;
        col.copy(e === 'presente' ? VERDE : e === 'vazia' ? VAZIA : corSetor(c.k));
        if (destaque && c.k !== destaque) col.lerp(cinza, .72);
      }
      inst.setColorAt(i, col); instDet.setColorAt(i, col);
    });
    inst.instanceColor.needsUpdate = true; instDet.instanceColor.needsUpdate = true;
    Object.entries(selos).forEach(([k, s]) => { s.material.opacity = (!destaque || k === destaque) ? 1 : .45; });
  }
  pintar(null);
  cena.add(inst, instDet);

  // marcador da cadeira
  const pino = new THREE.Group();
  const matAlvo = new THREE.MeshStandardMaterial({ color: BASE.alvo, roughness: .35 });
  const cab = new THREE.Mesh(new THREE.SphereGeometry(8, 32, 16), matAlvo); cab.castShadow = true;
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(5.4, 20, 24), matAlvo); ponta.rotation.x = Math.PI; ponta.castShadow = true;
  const halo = new THREE.Mesh(new THREE.RingGeometry(7, 13, 48), new THREE.MeshBasicMaterial({ color: BASE.alvo, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.position.y = 3.4;
  const cadAlvo = new THREE.Mesh(geoCad, matAlvo); cadAlvo.castShadow = true;
  pino.add(cab, ponta, halo, cadAlvo); pino.visible = false; cena.add(pino);

  // setor aberto: as cadeiras dão lugar a círculos planos e numerados, em fileiras, como numa planta
  const maxNum = Math.max(1, ...lista.map(c => c.num));
  const COLS = 16, CEL = 128, LIN = Math.ceil((maxNum + 1) / COLS);
  const atlas = (() => {
    const c = document.createElement('canvas'); c.width = COLS * CEL; c.height = LIN * CEL;
    const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffffff';
    for (let n = 0; n <= maxNum; n++) {
      g.font = `800 ${n > 99 ? 50 : 62}px 'Nunito Sans', system-ui, sans-serif`;
      g.fillText(String(n), (n % COLS) * CEL + CEL / 2, Math.floor(n / COLS) * CEL + CEL / 2 + 4);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  })();
  const matTxt = {};
  function matNumero(n) {
    if (matTxt[n]) return matTxt[n];
    const t = atlas.clone(); t.needsUpdate = true;
    t.repeat.set(1 / COLS, 1 / LIN); t.offset.set((n % COLS) / COLS, 1 - (Math.floor(n / COLS) + 1) / LIN);
    return (matTxt[n] = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  }
  const geoTxt = new THREE.PlaneGeometry(1, 1); geoTxt.rotateX(-Math.PI / 2);
  // número da fileira nas duas pontas de cada fileira (1 = a mais perto do palco)
  const matFileira = {};
  function matFil(n) {
    if (matFileira[n]) return matFileira[n];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6; g.strokeStyle = 'rgba(123,30,43,.35)'; g.stroke();
    g.fillStyle = '#7b1e2b'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${n > 9 ? 60 : 70}px 'Nunito Sans', system-ui, sans-serif`; g.fillText(String(n), 64, 69);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return (matFileira[n] = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  }
  let numeros = null, setorAberto = null;
  // número pintado no assento de cada cadeira do setor aberto (lido de quem olha do palco)
  function mostrarNumeros(k, alvoNum) {
    if (numeros) { cena.remove(numeros); numeros = null; }
    if (!k || !cadeirasPorSetor[k]) return;
    numeros = new THREE.Group();
    cadeirasPorSetor[k].forEach(i => {
      const c = lista[i], e = (c.esc || 1) * (c.num === alvoNum ? 1.3 : 1);
      const t = new THREE.Mesh(geoTxt, matNumero(c.num));
      t.rotation.y = (c.rot != null ? c.rot : Math.atan2(c.x, c.z)) + Math.PI;
      t.position.set(c.x, 3 + 4.1 * e + .06, c.z); t.scale.setScalar(5.8 * e);
      t.userData = { setor: k, num: c.num };
      numeros.add(t);
    });
    (fileirasPorSetor[k] || []).forEach(f => f.pontas.forEach(([x, z]) => {
      const t = new THREE.Mesh(geoTxt, matFil(f.n));
      t.rotation.y = (f.rot != null ? f.rot : Math.atan2(x, z)) + Math.PI;
      t.position.set(x, 3 + 4.1 * (f.esc || 1) + .06, z); t.scale.setScalar(6.4 * f.esc); t.renderOrder = 2;
      numeros.add(t);
    }));
    cena.add(numeros);
  }

  let anim = null;
  function voar(alvo, camPos, ms) {
    if (!ms || ms < 2) { ctr.target.copy(alvo); cam.position.copy(camPos); return; }
    const t0 = performance.now(), de = { t: ctr.target.clone(), c: cam.position.clone() };
    anim = agora => {
      let t = Math.min(1, (agora - t0) / ms); t = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      ctr.target.lerpVectors(de.t, alvo, t); cam.position.lerpVectors(de.c, camPos, t);
      if (t >= 1) anim = null;
    };
  }
  // enquadramento: cabe o auditório inteiro na largura e na altura da área
  const ELEV = 52 * Math.PI / 180, MEIO_LARG = Math.max(Math.abs(limites.x0), Math.abs(limites.x1)) + 30, PROF = Math.max(60, limites.z1) - limites.z0;
  function distancia(meioLarg, prof) {
    const vf = FOV_MAPA * Math.PI / 360, hf = Math.atan(Math.tan(vf) * cam.aspect); // sempre o campo de visão do mapa, mesmo durante a entrada
    return Math.max(meioLarg / Math.tan(hf), (prof * Math.sin(ELEV) * .5 + 40) / Math.tan(vf)) * 1.04;
  }
  function posCam(alvo, d, dx = 0) { return new THREE.Vector3(alvo.x + dx, alvo.y + d * Math.sin(ELEV), alvo.z + d * Math.cos(ELEV)); }
  const GERAL = { alvo: new THREE.Vector3(0, 0, (limites.z0 + Math.max(40, limites.z1)) / 2), cam: new THREE.Vector3() };
  function visaoGeral(ms = 900) { if (vista || manual) { vista = null; manual = null; anim = null; cam.fov = FOV_MAPA; cam.updateProjectionMatrix(); ctr.enabled = true; ambiente(false); } pintar(null); pino.visible = false; setorAberto = null; mostrarNumeros(null); selos_visiveis(true); voar(GERAL.alvo, GERAL.cam, ms); if (opts.aoMudar) opts.aoMudar(null); }
  function selos_visiveis(v) { Object.values(selos).forEach(s => { s.visible = v; }); }

  // abre um setor: aproxima vendo de dentro para fora (como quem está no palco) e mostra os números
  function enquadrarSetor(k) {
    const st = loc.setores[k];
    if (st.ret) {
      const [rx, ry, rw, rh] = st.ret, alvo = new THREE.Vector3(rx - loc.centro[0] + rw / 2, 0, ry - loc.centro[1] + rh / 2);
      const e = 64 * Math.PI / 180, vf = cam.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * cam.aspect);
      const d = Math.max((rw / 2 + 8) / Math.tan(hf), (rh * Math.sin(e) / 2 + 22) / Math.tan(vf), 150);
      return { alvo, cam: alvo.clone().add(new THREE.Vector3(0, d * Math.sin(e), d * Math.cos(e))) };
    }
    const [ri, ro, a1, a2] = st.arco;
    const rm = (ri + ro) / 2, m = (a1 + a2) / 2, [x, z] = P(rm, m);
    const alvo = new THREE.Vector3(x, 0, z), dir = new THREE.Vector3(x, 0, z).normalize();
    const arco = rm * (a2 - a1) * Math.PI / 180, prof = ro - ri;
    const e = 64 * Math.PI / 180, vf = cam.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * cam.aspect);
    const d = Math.max((arco / 2 + 8) / Math.tan(hf), (prof * Math.sin(e) / 2 + 22) / Math.tan(vf), 150);
    return { alvo, cam: alvo.clone().addScaledVector(dir, -d * Math.cos(e)).setY(d * Math.sin(e)) };
  }
  function abrirSetor(k, ms = 1100) {
    if (opts.setorFixo && k !== opts.setorFixo) return;
    if (!loc.setores[k] || !usados.has(k) || !(loc.setores[k].arco || loc.setores[k].ret)) return;
    if (vista || manual) { vista = null; manual = null; anim = null; cam.fov = FOV_MAPA; cam.updateProjectionMatrix(); ctr.enabled = true; ambiente(false); }
    setorAberto = k; pintar(k); pino.visible = false; mostrarNumeros(k); selos_visiveis(false);
    const f = enquadrarSetor(k); voar(f.alvo, f.cam, ms);
    if (opts.aoMudar) opts.aoMudar({ setor: k });
  }

  function focar(setor, num, ms = 1500) {
    if (vista || manual) { vista = null; manual = null; anim = null; cam.fov = FOV_MAPA; cam.updateProjectionMatrix(); ctr.enabled = true; ambiente(false); }
    pintar(setor); setorAberto = setor; mostrarNumeros(setor, num); selos_visiveis(false);
    const c = posCadeira[setor + '-' + num];
    if (!c) { pino.visible = false; voar(GERAL.alvo, GERAL.cam, ms); return; }
    pino.visible = true; pino.position.set(c.x, 0, c.z); pino.userData.esc = c.esc || 1; cab.visible = ponta.visible = false;
    cadAlvo.position.set(0, 3.05, 0); cadAlvo.scale.setScalar(1.3 * (c.esc || 1)); cadAlvo.rotation.y = c.rot != null ? c.rot : Math.atan2(c.x, c.z);
    // abre o setor da pessoa com os números e centraliza a cadeira
    const f = enquadrarSetor(setor), ajuste = new THREE.Vector3(c.x, 0, c.z).sub(f.alvo).multiplyScalar(.6);
    voar(f.alvo.clone().add(ajuste), f.cam.clone().add(ajuste), ms);
    if (opts.aoMudar) opts.aoMudar({ setor, num });
  }

  // sala em volta, só aparece na vista da cadeira. Feita a partir das fotos da sede:
  // parede preta do palco com faixa de LED (2 telões + logo) e telão largo atrás do púlpito,
  // paredes cinza com painéis de madeira, teto claro com luzes quadradas e carpete escuro.
  // Escala: 1 m ~ 11 unidades (cadeira ~0,55 m; fileira ~0,95 m).
  const sala = new THREE.Group(); sala.visible = false; cena.add(sala);
  let luzesSala = [], ambienteEnv = null, salaGeo = null, salaHall = null, carpPlat = null;
  const tetoG = new THREE.Group(); sala.add(tetoG);
  function tela(w, h, desenho, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; desenho(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  }
  function plano(w, h, mat, x, y, z, ry) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry || 0; sala.add(m); return m; }
  {
    const escuro = BASE === BASE_ESCURO;
    // texturas recortadas das fotos da sede (carpete, granito, madeira, pastilhas)
    const foto = (arq, rx, ry) => { const t = new THREE.TextureLoader().load('tex/' + arq); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t; };
    const pc = palco || { x: 0, z: 0, x0: -60, x1: 60, z0: -40, z1: 60 };
    const X0 = limites.x0 - 70, X1 = limites.x1 + 70, Z0 = limites.z0 - 90;
    // proporções da planta oficial (AutoCAD) da sede, medidas a partir do raio da primeira fileira (riMin):
    // parede do palco a 0,125·riMin à frente do centro dos arcos; parede preta com 1,63·riMin de largura;
    // paredes diagonais saindo do palco a ~16° até as laterais
    const raios = Object.values(loc.setores).filter(st => st.arco).map(st => st.arco[0]);
    const riMin = raios.length ? Math.min(...raios) : 0;
    const ZF = riMin ? -riMin * .125 : (pc.z1 != null ? pc.z1 : limites.z1) + 6;   // parede do fundo do palco
    const LARG = X1 - X0, PROF = ZF - Z0, ALT = 150, CX = (X0 + X1) / 2, CZ = (Z0 + ZF) / 2;
    salaGeo = { Z0, ZF, CX, ALT, palcoX: pc.x, riMin: riMin || 150, rMesa: mesaSom ? Math.abs((mesaSom.z0 + mesaSom.z1) / 2) : 0 };
    // carpete
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(LARG, PROF), new THREE.MeshStandardMaterial({ map: foto('carpete.jpg', LARG / 50, PROF / 25), color: escuro ? 0x6a6a6a : 0xd6d6d6, roughness: 1 }));
    piso.rotation.x = -Math.PI / 2; piso.position.set(CX, -.7, CZ); piso.receiveShadow = true; sala.add(piso);
    // paredes cinza com painéis de madeira e ar-condicionado
    const texParede = (comp) => tela(512, 256, (g, w, h) => {
      g.fillStyle = '#8b8d89'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,.06)'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 2, h);
      const madeira = g.createLinearGradient(0, 0, 110, 0); madeira.addColorStop(0, '#9e7a56'); madeira.addColorStop(.5, '#b38f6b'); madeira.addColorStop(1, '#9a7653');
      g.fillStyle = madeira; g.fillRect(200, 22, 110, 190);
      g.fillStyle = 'rgba(60,40,20,.16)'; for (let x = 202; x < 310; x += 6) g.fillRect(x, 22, 1, 190);
      g.fillStyle = '#e9e8e3'; g.fillRect(40, 222, 80, 10); g.fillRect(390, 222, 80, 10);
    }, [comp / 170, 1]);
    const matParede = c => new THREE.MeshStandardMaterial({ map: texParede(c), roughness: .95, color: escuro ? 0x8a8a8a : 0xffffff });
    const LP0 = riMin ? riMin * 1.63 : Math.max(220, Math.min(LARG * .4, (pc.x1 - pc.x0) * 1.25));
    const ANG = riMin ? 16 * Math.PI / 180 : 0;
    const ZL = ZF - Math.tan(ANG) * (X1 - pc.x - LP0 / 2);           // onde a parede diagonal encontra a lateral
    const PL = ZL - Z0;
    plano(PL, ALT, matParede(PL), X0, ALT / 2, Z0 + PL / 2, Math.PI / 2);
    plano(PL, ALT, matParede(PL), X1, ALT / 2, Z0 + PL / 2, -Math.PI / 2);
    plano(LARG, ALT, new THREE.MeshStandardMaterial({ color: escuro ? 0x6c6d6a : 0xb9bab5, roughness: .95 }), CX, ALT / 2, Z0, 0);
    { // fundo da nave (panorâmica do palco): portas de madeira no centro, dois painéis cinza grandes e prateleiras
      const madeira = new THREE.MeshStandardMaterial({ color: 0x8a6446, roughness: .7 }), painel = new THREE.MeshStandardMaterial({ color: escuro ? 0x55565a : 0x8d8f93, roughness: .9 });
      [-1, 1].forEach(l => { plano(20, 30, madeira, CX + l * 13, 15, Z0 + .6, 0); plano(70, 52, painel, CX + l * 105, 30, Z0 + .6, 0); });
      const prat = new THREE.MeshStandardMaterial({ color: 0x4a4b4e, roughness: .8 });
      [-1, 1].forEach(l => { const pr = new THREE.Mesh(new THREE.BoxGeometry(LARG * .16, 2, 6), prat); pr.position.set(CX + l * LARG * .3, 44, Z0 + 3); sala.add(pr); });
    }
    // paredes diagonais dos dois lados do palco
    const diag = [];
    [-1, 1].forEach(l => {
      const xa = pc.x + l * LP0 / 2, xb = l < 0 ? X0 : X1, comp = Math.hypot(xb - xa, ZL - ZF);
      const m = plano(comp, ALT, matParede(comp), (xa + xb) / 2, ALT / 2, (ZF + ZL) / 2, Math.PI + l * ANG);
      diag.push({ l, xa, xb, comp, m });
    });
    // ===== hall de entrada (foyer) em 3D, atrás da parede do fundo, feito pela foto do hall e pela planta:
    // piso de pedra bege e cinza com faixas escuras, teto branco com caixotões, colunas brancas,
    // fachada de vidro jateado com a marca, balcão de madeira e as portas que dão para a nave
    const sbH = Math.sign(Z0) || -1, DH = 80, WH = Math.min(LARG * .45, 380), HH = 44;
    const zN = Z0, zF = Z0 + sbH * DH, zMid = (zN + zF) / 2, XH = pc.x;
    salaHall = { zN, zF, DH, sbH };
    const pedra = tela(1024, 1024, (g, w, h) => { g.fillStyle = '#9d8f78'; g.fillRect(0, 0, w, h); }, [WH / 140, DH / 140]);
    { const img = new Image(); img.onload = () => { const c = pedra.image, g = c.getContext('2d');
        for (let x = 0; x < 1024; x += 256) for (let y = 0; y < 1024; y += 128) g.drawImage(img, x, y, 256, 128);
        g.fillStyle = '#1f1f22'; g.fillRect(0, 470, 1024, 84); g.fillRect(470, 0, 84, 1024); g.fillRect(760, 760, 180, 180);
        pedra.needsUpdate = true; }; img.src = 'tex/granito.jpg'; }
    const pisoH = new THREE.Mesh(new THREE.PlaneGeometry(WH, DH), new THREE.MeshStandardMaterial({ map: pedra, roughness: .35, metalness: .05 }));
    pisoH.rotation.x = -Math.PI / 2; pisoH.position.set(XH, -.6, zMid); pisoH.receiveShadow = true; sala.add(pisoH);
    const branco = new THREE.MeshStandardMaterial({ color: 0xf1f0ec, roughness: .85 });
    const caixotao = tela(256, 256, (g, w, h) => { g.fillStyle = '#f4f4f1'; g.fillRect(0, 0, w, h); g.fillStyle = '#e2e2de'; g.fillRect(26, 26, w - 52, h - 52); g.strokeStyle = 'rgba(0,0,0,.05)'; for (let x = 26; x < w - 26; x += 25) { g.beginPath(); g.moveTo(x, 26); g.lineTo(x, h - 26); g.stroke(); } }, [WH / 60, DH / 60]);
    const tetoH = new THREE.Mesh(new THREE.PlaneGeometry(WH, DH), new THREE.MeshBasicMaterial({ map: caixotao }));
    tetoH.rotation.x = Math.PI / 2; tetoH.position.set(XH, HH, zMid); sala.add(tetoH);
    const bloco = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); sala.add(m); return m; };
    // paredes laterais do hall
    [-1, 1].forEach(l => bloco(3, HH, DH, branco, XH + l * WH / 2, HH / 2, zMid));
    // parede entre hall e nave, com o vão das portas no centro
    const VAO = 34, AP = 30;
    const madeiraH = new THREE.MeshStandardMaterial({ map: foto('madeira.jpg', 1, 1), color: 0xc89a72, roughness: .55 });
    const madeiraParede = new THREE.MeshStandardMaterial({ map: foto('madeira.jpg', WH / 60, 2.2), color: 0xc89a72, roughness: .55 });
    [-1, 1].forEach(l => { const w = (WH - VAO) / 2; bloco(w, HH, 3, branco, XH + l * (VAO / 2 + w / 2), HH / 2, zN + sbH * 1.5); });
    bloco(VAO, HH - AP, 3, branco, XH, AP + (HH - AP) / 2, zN + sbH * 1.5);
    [-1, 1].forEach(l => { const w = (WH - VAO) / 2; bloco(w, AP + 2, .6, madeiraParede, XH + l * (VAO / 2 + w / 2), (AP + 2) / 2, zN + sbH * 3.2); });
    // TVs sobre o balcão
    [-1, 0, 1].forEach(k => { const tv = bloco(13, 7.5, .6, new THREE.MeshStandardMaterial({ color: 0x3a1f26, roughness: .25, metalness: .3 }), XH + WH * .3 + k * 14, 22, zN + sbH * 3.8); });
    [-1, 1].forEach(l => { const f = bloco(VAO / 2 - 1, AP, 1, madeiraH, XH + l * (VAO / 4 + 6), AP / 2, zN + sbH * 4); f.rotation.y = l * 1.15; }); // portas abertas
    // colunas brancas e balcão de madeira
    for (let i = 0; i < 3; i++) [-1, 1].forEach(l => bloco(5, HH, 5, branco, XH + l * (WH / 2 - 14), HH / 2, zN + sbH * (18 + i * 24)));
    bloco(40, 11, 12, madeiraH, XH + WH * .3, 5.5, zN + sbH * 22); bloco(42, 1, 14, new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: .4 }), XH + WH * .3, 11.4, zN + sbH * 22);
    const fachada = new THREE.MeshStandardMaterial({ map: foto('pastilha-branca.jpg', WH / 40, HH * 2.2 / 60), roughness: .6, color: escuro ? 0x9a9894 : 0xffffff });
    const marrom = new THREE.MeshStandardMaterial({ map: foto('pastilha-marrom.jpg', 1, 3), roughness: .35 });
    // fachada: vidro jateado com a marca, portas de vidro no centro
    const jateado = tela(1024, 256, (g, w, h) => {
      g.fillStyle = '#cfd6db'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(70,70,70,.75)'; g.font = "800 46px 'Nunito Sans', system-ui, sans-serif"; g.textAlign = 'center'; g.fillText('VERBO DA VIDA', w / 2, 70);
      g.fillStyle = '#8a7a6a'; g.fillRect(0, 160, w, 22);
      g.strokeStyle = 'rgba(60,60,60,.35)'; g.lineWidth = 3; for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    });
    const vidroF = new THREE.MeshStandardMaterial({ map: jateado, transparent: true, opacity: .96, roughness: .15, side: THREE.DoubleSide });
    const vidroPorta = new THREE.MeshStandardMaterial({ color: 0xdfe8ee, transparent: true, opacity: .28, roughness: .05, side: THREE.DoubleSide, depthWrite: false });
    const VF = 40;
    [-1, 1].forEach(l => { const w = (WH - VF) / 2, m = plano(w, HH * .72, vidroF, XH + l * (VF / 2 + w / 2), HH * .36, zF, 0); });
    plano(VF, HH * .72, vidroPorta, XH, HH * .36, zF, 0);
    bloco(WH + 6, HH * .28, 3, fachada, XH, HH * .72 + HH * .14, zF);
    // por fora: calçada, letreiro e o prédio
    const calcada = new THREE.Mesh(new THREE.PlaneGeometry(WH * 3, 260), new THREE.MeshStandardMaterial({ color: escuro ? 0x3a3a3c : 0x8d8c88, roughness: 1 }));
    calcada.rotation.x = -Math.PI / 2; calcada.position.set(XH, -.8, zF + sbH * 130); sala.add(calcada);
    for (const k of [-2, -1, 1, 2]) { const col = bloco(9, HH * 1.2, 9, marrom, XH + k * (WH / 4.2), HH * .6, zF + sbH * 8); col.castShadow = true; }
    [-1, 1].forEach(l => bloco(WH, HH * 2.2, 6, fachada, XH + l * WH, HH * 1.1, zF + sbH * 3.5));
    bloco(WH * 3, HH * 1.2, 6, fachada, XH, HH + HH * .6, zF + sbH * 3.5);
    const letreiro = textoPlano('VERBO DA VIDA', 150, 24); letreiro.position.set(XH, HH * 1.35, zF + sbH * 7); letreiro.rotation.set(0, sbH < 0 ? 0 : Math.PI, 0); sala.add(letreiro);
    const luzHall = new THREE.PointLight(0xfff6e8, .5, 0, 0); luzHall.position.set(XH, HH - 6, zMid); sala.add(luzHall);

    // teto curvo em faixas concêntricas ao palco (como na panorâmica): cada faixa um pouco mais alta,
    // com uma borda clara no degrau e luzes redondas seguindo os arcos
    const corTeto = escuro ? 0x8d8e8a : 0xd3d4d0;
    const fundoTeto = new THREE.Mesh(new THREE.PlaneGeometry(LARG, PROF), new THREE.MeshBasicMaterial({ color: escuro ? 0x7e7f7b : 0xc6c7c2 }));
    fundoTeto.rotation.x = Math.PI / 2; fundoTeto.position.set(CX, ALT + 36, CZ); tetoG.add(fundoTeto);
    const cxT = pc.x, czT = pc.z1 != null ? pc.z1 : 0, rMax = Math.hypot(LARG / 2, PROF) + 40;
    const luzTeto = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), discoLuz = new THREE.CircleGeometry(2.4, 14);
    const bordaTeto = new THREE.MeshBasicMaterial({ color: escuro ? 0xb9bab5 : 0xf2f2ee, side: THREE.DoubleSide });
    const faixas = [90, 190, 300, 420, 560];
    faixas.forEach((r, n) => {
      const r2 = faixas[n + 1] || rMax, y = ALT + 30 - n * 7;
      const anel = new THREE.Mesh(new THREE.RingGeometry(r, r2, 96, 1, 0, Math.PI), new THREE.MeshBasicMaterial({ color: corTeto, side: THREE.DoubleSide }));
      anel.rotation.x = -Math.PI / 2; anel.position.set(cxT, y, czT); tetoG.add(anel);
      const borda = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 7, 96, 1, true, Math.PI / 2, Math.PI), bordaTeto);
      borda.position.set(cxT, y - 3.5, czT); tetoG.add(borda);
      const rl = (r + r2) / 2, nLuz = Math.round(Math.PI * rl / 55);
      for (let k = 1; k < nLuz; k++) {
        const a = Math.PI * k / nLuz, x = cxT + rl * Math.cos(a), z = czT - rl * Math.sin(a);
        if (x < X0 + 4 || x > X1 - 4 || z < Z0 + 4) continue;
        const d = new THREE.Mesh(discoLuz, luzTeto); d.rotation.x = Math.PI / 2; d.position.set(x, y - .2, z); tetoG.add(d);
      }
    });
    // parede preta do palco
    const LP = LP0, preto = new THREE.MeshStandardMaterial({ color: 0x141214, roughness: .8 });
    plano(LP, ALT - 14, preto, pc.x, (ALT - 14) / 2, ZF, Math.PI);
    // faixa escura do teto sobre o palco
    const sanca = new THREE.Mesh(new THREE.BoxGeometry(LP + 80, 14, 70), new THREE.MeshStandardMaterial({ color: 0x1c1a1c, roughness: .9 }));
    sanca.position.set(pc.x, ALT - 7, ZF - 35); sala.add(sanca);
    // faixa de LED: dois telões 16:9 nas pontas e a logo no meio
    // proporções medidas na foto do palco (em fração da largura da parede preta)
    const TOPO = 14.5, yC0 = TOPO + LP * .015, hC = LP * .14, wC = LP * .38;
    const yB0 = yC0 + hC + LP * .012, hB = LP * .21, yBanda = yB0 + hB / 2;
    const wTel = LP * .27, hTel = LP * .16;
    const imagem = tela(512, 288, (g, w, h) => {
      const ceu = g.createLinearGradient(0, 0, 0, h); ceu.addColorStop(0, '#8fa6d8'); ceu.addColorStop(.45, '#d9a9b8'); ceu.addColorStop(.62, '#f0a46a'); ceu.addColorStop(.63, '#6b3b2e'); ceu.addColorStop(1, '#2b1a18');
      g.fillStyle = ceu; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(40,25,20,.55)'; g.beginPath(); g.moveTo(0, h * .7); g.quadraticCurveTo(w * .4, h * .58, w, h * .68); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    });
    const matTela = new THREE.MeshBasicMaterial({ map: imagem, toneMapped: false });
    plano(wTel, hTel, matTela, pc.x - LP * .36, yBanda, ZF - 1, Math.PI);
    plano(wTel, hTel, matTela, pc.x + LP * .36, yBanda, ZF - 1, Math.PI);
    const logo = plano(LP * .11, LP * .095, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), pc.x, yBanda, ZF - 1, Math.PI);
    new THREE.TextureLoader().load('logo-vdv.png', t => { t.colorSpace = THREE.SRGBColorSpace; logo.material.map = t; logo.material.opacity = .95; logo.material.needsUpdate = true; });
    // telão largo atrás do púlpito, logo acima do palco
    plano(wC, hC, matTela, pc.x, yC0 + hC / 2, ZF - 1, Math.PI);

    // objetos do palco
    const preto2 = new THREE.MeshStandardMaterial({ color: 0x18171a, roughness: .55, metalness: .2 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: .3, metalness: .9 });
    const vidro = new THREE.MeshStandardMaterial({ color: 0xdde6ee, roughness: .05, metalness: .1, transparent: true, opacity: .22, depthWrite: false });
    const caixa = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; sala.add(m); return m; };
    const zFrente = pc.z0 != null ? pc.z0 : pc.z - 60, zMeio = (zFrente + ZF) / 2;
    // púlpito de acrílico e mesinha
    caixa(6.4, 11, 4, vidro, pc.x, TOPO + 5.5, zFrente + 34); caixa(7, .4, 4.6, vidro, pc.x, TOPO + 11.2, zFrente + 34);
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, .3, 24), metal); mesa.position.set(pc.x + 14, TOPO + 8.5, zFrente + 36); sala.add(mesa);
    caixa(.3, 8.5, .3, metal, pc.x + 14, TOPO + 4.25, zFrente + 36);
    // cabine de vidro da bateria, com tambores
    const bx = pc.x + (pc.x1 - pc.x0) * .36, bz = ZF - 22; // à esquerda de quem olha para o palco
    caixa(30, 24, 22, vidro, bx, TOPO + 12, bz);
    const tambor = new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: .35, metalness: .6 });
    [[-6, 0, 5, 4.5], [5, 2, 3.2, 3], [0, -5, 6, 3.6]].forEach(([dx, dz, r, h]) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), tambor); t.position.set(bx + dx, TOPO + 4 + h / 2, bz + dz); sala.add(t); });
    // retornos (caixas de chão) e pedestais de microfone
    [-.22, .22].forEach(f => { const r = caixa(9, 4, 6, preto2, pc.x + (pc.x1 - pc.x0) * f, TOPO + 2, zFrente + 24); r.rotation.x = -.35; });
    [-.3, .3, .38].forEach(f => caixa(.25, 14, .25, metal, pc.x + (pc.x1 - pc.x0) * f, TOPO + 7, zMeio));
    // degraus na frente do palco, com fita de LED
    const fita = new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false });
    for (let i = 0; i < 3; i++) {
      const h = TOPO * (i + 1) / 4, z = zFrente - 3 - (2 - i) * 6;
      caixa(70, h, 6, preto2, pc.x, h / 2, z);
      caixa(70, .3, .3, fita, pc.x, h + .2, z - 3);
    }
    // treliça com refletores sobre o palco
    const yTr = ALT - 26, zTr = zFrente + 6;
    caixa(LP * .9, 3, 3, metal, pc.x, yTr, zTr);
    const lampada = new THREE.MeshBasicMaterial({ color: 0xfff4dc, toneMapped: false });
    for (let i = 0; i < 12; i++) {
      const x = pc.x - LP * .42 + i * LP * .84 / 11;
      const corpo = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 4, 12), preto2); corpo.position.set(x, yTr - 3.5, zTr); corpo.rotation.x = .5; sala.add(corpo);
      const luz = new THREE.Mesh(new THREE.CircleGeometry(1.3, 16), lampada); luz.position.set(x, yTr - 5.4, zTr + 1.1); luz.rotation.x = Math.PI / 2 + .5; sala.add(luz);
    }
    // caixas de som penduradas nas laterais da parede preta
    [-1, 1].forEach(lado => caixa(7, 46, 7, preto2, pc.x + lado * (LP / 2 + 12), 88, ZF - 16));
    // telões verticais nas paredes de madeira, um de cada lado do palco, virados para a plateia
    const telaVert = tela(288, 512, (g, w, h) => {
      const f = g.createLinearGradient(0, 0, 0, h); f.addColorStop(0, '#1d2a44'); f.addColorStop(1, '#0d1220'); g.fillStyle = f; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9d3e6'; g.beginPath(); g.ellipse(w / 2, h * .42, w * .16, w * .2, 0, 0, Math.PI * 2); g.fill();
      g.fillRect(w * .3, h * .56, w * .4, h * .34);
    });
    const matVert = new THREE.MeshBasicMaterial({ map: telaVert, toneMapped: false });
    [-1, 1].forEach(lado => {
      const hV = LP * .3, wV = hV * 9 / 16;
      const dg = diag.find(d => d.l === lado), t = .3, xv = dg.xa + (dg.xb - dg.xa) * t, zv = ZF + (ZL - ZF) * t;
      const m = plano(wV, hV, matVert, xv, 40 + hV / 2, zv, Math.PI + lado * ANG); m.translateZ(4);
      const moldura = new THREE.Mesh(new THREE.BoxGeometry(wV + 3, hV + 3, 2), new THREE.MeshStandardMaterial({ color: 0x0c0b0c, roughness: .6 }));
      moldura.position.copy(m.position); moldura.rotation.copy(m.rotation); moldura.translateZ(-1.2); sala.add(moldura);
    });
    // refletores (moving heads) na beirada da frente do palco
    for (let i = 0; i < 9; i++) {
      const x = pc.x - (pc.x1 - pc.x0) * .42 + i * (pc.x1 - pc.x0) * .84 / 8;
      const base = caixa(4, 2, 4, preto2, x, TOPO + 1, zFrente + 52);
      const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 3.4, 16), preto2); cab.rotation.z = Math.PI / 2; cab.position.set(x, TOPO + 4, zFrente + 52); sala.add(cab);
      const lente = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), lampada); lente.position.set(x, TOPO + 4, zFrente + 50.1); lente.rotation.y = Math.PI; sala.add(lente);
    }
    // mesa de som e mídia no fundo, com monitores acesos
    if (mesaSom) {
      const telaMon = new THREE.MeshBasicMaterial({ color: 0x9ec9ff, toneMapped: false });
      for (let i = 0; i < 6; i++) {
        const x = mesaSom.x0 + 4 + i * (mesaSom.x1 - mesaSom.x0 - 8) / 5;
        caixa(5, 3.4, .5, preto2, x, 14 + 3, mesaSom.z1 - 6);
        plano(4.4, 2.8, telaMon, x, 17, mesaSom.z1 - 6.3, Math.PI);
      }
    }
    // fita de LED âmbar na beirada da frente de cada plataforma
    const ambar = new THREE.MeshBasicMaterial({ color: 0xffb648, toneMapped: false, side: THREE.DoubleSide });
    Object.keys(loc.setores).forEach(k => {
      const st = loc.setores[k]; if (!st.arco) return;
      const [ri, , a1, a2] = st.arco;
      const f = new THREE.Mesh(new THREE.RingGeometry(ri - .3, ri + .5, 48, 1, a1 * Math.PI / 180, (a2 - a1) * Math.PI / 180), ambar);
      f.rotation.x = -Math.PI / 2; f.position.y = 3.08; sala.add(f);
    });

    // luzes de palco: três focos quentes no púlpito e brilho dos telões
    luzesSala = [];
    [-.25, 0, .25].forEach(f => {
      const sp = new THREE.SpotLight(0xfff0d8, 2.2, 0, Math.PI / 7, .6, 0);
      sp.position.set(pc.x + LP * f, yTr - 6, zTr); sp.target.position.set(pc.x + LP * f * .3, TOPO, zFrente + 30);
      sala.add(sp, sp.target); luzesSala.push(sp);
    });
    const brilho = new THREE.PointLight(0xe6b4a8, 1.2, 0, 0); brilho.position.set(pc.x, 60, ZF - 40); sala.add(brilho);
  }
  function tomRealista(on) {
    if (on && !ambienteEnv) { const pm = new THREE.PMREMGenerator(renderer); ambienteEnv = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose(); }
    renderer.toneMapping = on ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; renderer.toneMappingExposure = 1.05;
    cena.environment = on ? ambienteEnv : null; hemi.intensity = on ? .95 : 1.35;
    cena.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
  }
  function ambiente(on) {
    sala.visible = on; chao.visible = !on; corSala = on; instDet.visible = on; inst.visible = !on;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, on ? 1.5 : 2)); tamanho(); pintar(destaqueAtual); tomRealista(on);
    // plataformas dos setores viram carpete na vista
    if (on && !carpPlat) { carpPlat = new THREE.TextureLoader().load('tex/carpete.jpg'); carpPlat.colorSpace = THREE.SRGBColorSpace; carpPlat.wrapS = carpPlat.wrapT = THREE.RepeatWrapping; carpPlat.repeat.set(1 / 50, 1 / 25); }
    Object.values(plataformas).forEach(m => { if (!m.userData.cor) m.userData.cor = m.material.color.getHex();
      m.material.color.setHex(on ? (BASE === BASE_ESCURO ? 0x5a5a5c : 0xb8b8b8) : m.userData.cor); m.material.map = on ? carpPlat : null; m.material.needsUpdate = true; });
    const ceu = on ? (BASE === BASE_ESCURO ? 0x1c2230 : 0xc9d6e4) : null;
    cena.background = on ? new THREE.Color(ceu) : null;
    cena.fog = on ? new THREE.Fog(ceu, 900, 2600) : null;
  }

  // vista da cadeira: a câmera senta no lugar, na altura dos olhos, virada para o púlpito
  const FOV_MAPA = 30, FOV_VISTA = 54;
  let vista = null, manual = null;
  const olharPara = new THREE.Vector3();
  function animarManual(paraPos, paraAlvo, paraFov, ms, fim) {
    const t0 = performance.now(), dePos = cam.position.clone(), deAlvo = manual ? manual.alvo.clone() : ctr.target.clone(), deFov = cam.fov;
    anim = null; ctr.enabled = false;
    manual = { alvo: deAlvo.clone() };
    anim = agora => {
      let t = Math.min(1, (agora - t0) / ms); t = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      cam.position.lerpVectors(dePos, paraPos, t); manual.alvo.lerpVectors(deAlvo, paraAlvo, t);
      cam.fov = deFov + (paraFov - deFov) * t; cam.updateProjectionMatrix();
      if (t >= 1) { anim = null; if (fim) fim(); }
    };
  }
  function direcaoVista() {
    const base = new THREE.Vector3(vista.palco.x - vista.olho.x, 0, vista.palco.z - vista.olho.z).normalize();
    const yaw = Math.atan2(base.x, base.z) + vista.yaw;
    const inclina = Math.atan2(vista.palco.y - vista.olho.y, Math.hypot(vista.palco.x - vista.olho.x, vista.palco.z - vista.olho.z)) + vista.pitch;
    return new THREE.Vector3(Math.sin(yaw) * Math.cos(inclina), Math.sin(inclina), Math.cos(yaw) * Math.cos(inclina));
  }
  function vistaDaCadeira(setor, num, ms = 1800) {
    const c = posCadeira[setor + '-' + num]; if (!c) return false;
    const e = c.esc || 1, pc = palco || { x: 0, z: 0, alto: 20 };
    // olho um pouco atrás do centro do assento (encostado), a ~1,2 m do chão
    const paraPalco = new THREE.Vector3(pc.x - c.x, 0, pc.z - c.z).normalize();
    const olho = new THREE.Vector3(c.x, 3 + 14 * e, c.z).addScaledVector(paraPalco, -1.2 * e);
    vista = { setor, num, olho, palco: new THREE.Vector3(pc.x, 48, (pc.z1 != null ? pc.z1 : pc.z)), yaw: 0, pitch: 0 };
    pino.visible = false; selos_visiveis(false); mostrarNumeros(null); pintar(null); ambiente(true);
    animarManual(olho, olho.clone().add(direcaoVista().multiplyScalar(100)), FOV_VISTA, ms);
    if (opts.aoMudar) opts.aoMudar({ setor, num, vista: true });
    return true;
  }
  function sairDaVista(ms = 1300) {
    if (!vista) return;
    const { setor, num } = vista; vista = null;
    // calcula onde o mapa vai parar (mesmo enquadramento de focar) e voa até lá sem pulos
    const c = posCadeira[setor + '-' + num], f = enquadrarSetor(setor);
    const ajuste = new THREE.Vector3(c.x, 0, c.z).sub(f.alvo).multiplyScalar(.6);
    const alvo = f.alvo.clone().add(ajuste), pos = f.cam.clone().add(ajuste);
    ambiente(false);
    animarManual(pos, alvo, FOV_MAPA, ms, () => { manual = null; ctr.target.copy(alvo); ctr.enabled = true; focar(setor, num, 1); });
  }
  // arrastar na vista da cadeira = olhar em volta; pinça/roda = aproximar
  let arrasto = null;
  renderer.domElement.addEventListener('pointerdown', e => { if (vista) { arrasto = { x: e.clientX, y: e.clientY, yaw: vista.yaw, pitch: vista.pitch }; renderer.domElement.setPointerCapture(e.pointerId); } });
  renderer.domElement.addEventListener('pointermove', e => {
    if (!vista || !arrasto || anim) return;
    const k = cam.fov * Math.PI / 180 / (renderer.domElement.clientHeight || 300);
    vista.yaw = Math.max(-1.25, Math.min(1.25, arrasto.yaw + (e.clientX - arrasto.x) * k));
    vista.pitch = Math.max(-.45, Math.min(.35, arrasto.pitch + (e.clientY - arrasto.y) * k));
  });
  ['pointerup', 'pointercancel'].forEach(t => renderer.domElement.addEventListener(t, () => { arrasto = null; }));
  renderer.domElement.addEventListener('wheel', e => {
    if (!vista || anim) return; e.preventDefault();
    cam.fov = Math.max(30, Math.min(75, cam.fov + e.deltaY * .03)); cam.updateProjectionMatrix();
  }, { passive: false });

  // toque/clique: setor abre; cadeira de setor aberto é escolhida
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  function acertar(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, cam);
    const alvos = [inst, ...Object.values(plataformas)]; if (numeros) alvos.unshift(...numeros.children);
    const h = ray.intersectObjects(alvos, false)[0]; if (!h) return null;
    if (h.object.userData && h.object.userData.num != null) return h.object.userData;
    if (h.object === inst) { const c = lista[h.instanceId]; return c.fora ? null : { setor: c.k, num: c.num }; }
    const k = Object.keys(plataformas).find(x => plataformas[x] === h.object);
    return k && usados.has(k) ? { setor: k } : null;
  }
  let toque = null;
  renderer.domElement.addEventListener('pointerdown', e => { toque = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!toque || Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 8 || performance.now() - toque.t > 600) { toque = null; return; }
    toque = null;
    if (vista || manual) return;
    const a = acertar(e); if (!a) return;
    if (a.num != null && setorAberto === a.setor) { if (!opts.semDestaqueAoTocar) focar(a.setor, a.num, 700); if (opts.aoTocarCadeira) opts.aoTocarCadeira(a.setor, a.num); }
    else abrirSetor(a.setor);
  });
  if (matchMedia('(hover:hover)').matches) renderer.domElement.addEventListener('pointermove', e => {
    if (e.buttons) return; renderer.domElement.style.cursor = vista ? 'grab' : acertar(e) ? 'pointer' : 'grab';
  });

  function tamanho() {
    const w = el.clientWidth || 300, h = el.clientHeight || 300;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const d = distancia(MEIO_LARG, PROF);
    GERAL.cam.copy(posCam(GERAL.alvo, d)); ctr.maxDistance = d * 1.25;
  }
  const obs = new ResizeObserver(tamanho); obs.observe(el); tamanho();
  ctr.target.copy(GERAL.alvo); cam.position.copy(GERAL.cam);

  let vivo = true, pausado = false; const ini = performance.now();
  (function loop(agora) {
    if (!vivo) return;
    requestAnimationFrame(loop);
    if (pausado) return;
    if (anim) anim(agora);
    if (pino.visible) {
      const t = (agora - ini) / 1000, o = Math.sin(t * 2.6);
      const sobe = (pino.userData.esc || 1) * 8; cab.position.y = 34 + sobe + o * 3; ponta.position.y = 21 + sobe + o * 3;
      halo.scale.setScalar((pino.userData.esc || 1) * (1.1 + (o + 1) * .25)); halo.material.opacity = .65 - (o + 1) * .18;
    }
    if (manual) {
      if (vista && !anim) manual.alvo.copy(vista.olho).add(direcaoVista().multiplyScalar(100));
      cam.lookAt(manual.alvo);
    } else ctr.update();
    renderer.render(cena, cam);
  })(ini);

  if (opts.alvo) focar(opts.alvo.setor, opts.alvo.num, opts.semAnimacao ? 1 : 1500);
  else if (opts.entrada) {
    // chegada pelo alto: a câmera começa bem acima da igreja e desce até a vista do auditório inteiro
    visaoGeral(1);
    const d = GERAL.cam.distanceTo(GERAL.alvo);
    cam.position.set(GERAL.alvo.x, GERAL.alvo.y + d * 2.2, GERAL.alvo.z + d * .25); ctr.target.copy(GERAL.alvo);
    voar(GERAL.alvo.clone(), GERAL.cam.clone(), 2800);
  } else visaoGeral(1);
  // percurso de entrada guiado pelo scroll (t de 0 a 1): entra pela porta do fundo, desce o corredor central
  // em direção ao palco e no fim sobe até a vista do auditório inteiro
  let noPercurso = false;
  const _p = new THREE.Vector3(), _a = new THREE.Vector3();
  function percurso(t) {
    if (!salaGeo) return;
    if (!noPercurso) { noPercurso = true; vista = null; anim = null; selos_visiveis(false); mostrarNumeros(null); pino.visible = false; ambiente(true); ctr.enabled = false; manual = { alvo: new THREE.Vector3() }; }
    t = Math.max(0, Math.min(1, t));
    // distâncias pelo raio a partir do centro dos arcos (o palco fica no centro, a porta no fundo)
    const { Z0, ALT, palcoX: X, riMin: R, rMesa } = salaGeo, sb = Math.sign(Z0) || -1, zr = r => sb * r, R0 = Math.abs(Z0);
    const rM = rMesa || R0 * .8;
    const DH = salaHall ? salaHall.DH : 80;
    const K = [
      { t: 0,   p: [X, 22, zr(R0 + DH + 150)], a: [X, 30, zr(R0 + DH)], fov: 56 },   // na rua, de frente para a fachada
      { t: .14, p: [X, 15, zr(R0 + DH + 6)],   a: [X, 16, zr(R0)], fov: 60 },   // na porta de vidro
      { t: .26, p: [X, 15, zr(R0 + 16)],       a: [X, 18, zr(0)], fov: 60 },    // atravessa o hall
      { t: .34, p: [X, 16, zr(R0 - 10)],       a: [X, 30, zr(0)], fov: 60 },    // passa as portas da nave
      { t: .48, p: [X, 54, zr(rM)],            a: [X, 26, zr(0)], fov: 58 },    // por cima da mesa de som
      { t: .64, p: [X, 17, zr(R * 1.75)],    a: [X, 32, zr(0)], fov: 56 },   // desce o corredor entre as fileiras
      { t: .76, p: [X, 18, zr(R * 1.25)],    a: [X, 34, zr(0)], fov: 54 },   // chegando às primeiras fileiras
      { t: .83, p: [X, 70, zr(R * 2.3)], a: [X, 14, zr(R * .6)], fov: 58 },   // recua pelo corredor subindo, ainda olhando o palco de frente
      { t: 1,   p: GERAL.cam.toArray(), a: GERAL.alvo.toArray(), fov: FOV_MAPA }
    ];
    let i = 0; while (i < K.length - 2 && t > K[i + 1].t) i++;
    const A = K[i], B = K[i + 1]; let u = (t - A.t) / (B.t - A.t); u = u * u * (3 - 2 * u);
    manual.alvo.fromArray(A.a).lerp(_a.fromArray(B.a), u);
    if (i === K.length - 2) {
      // último trecho: sobe girando em arco em volta do auditório até a vista de cima (sem cruzar por cima do palco)
      const c = GERAL.alvo, oA = new THREE.Spherical().setFromVector3(_p.fromArray(A.p).sub(c)), oB = new THREE.Spherical().setFromVector3(_a.copy(GERAL.cam).sub(c));
      let dT = oB.theta - oA.theta; while (dT > Math.PI) dT -= 2 * Math.PI; while (dT < -Math.PI) dT += 2 * Math.PI;
      const phi = Math.max(.05, oA.phi + (oB.phi - oA.phi) * u - .3 * Math.sin(Math.PI * u));
      const sp = new THREE.Spherical(oA.radius + (oB.radius - oA.radius) * u, phi, oA.theta + dT * u);
      cam.position.setFromSpherical(sp).add(c);
    } else { _p.fromArray(A.p).lerp(_a.fromArray(B.p), u); cam.position.copy(_p); }
    cam.fov = A.fov + (B.fov - A.fov) * u; cam.updateProjectionMatrix();
    tetoG.visible = cam.position.y < salaGeo.ALT + 10;
    // na subida final, acima do teto, a sala (palco, paredes, treliça) sai de cena e ficam só os setores
    const dentro = cam.position.y < salaGeo.ALT - 25; sala.visible = dentro; chao.visible = !dentro;
  }
  // fim do percurso: a mesma cena vira o mapa de sempre (setores coloridos, toque no setor e na cadeira)
  function liberar() { if (!noPercurso) return; noPercurso = false; tetoG.visible = true; visaoGeral(1); }
  function olharDe(px, py, pz, tx, ty, tz, fov) { vista = null; selos_visiveis(false); mostrarNumeros(null); ambiente(true); anim = null; ctr.enabled = false; manual = { alvo: new THREE.Vector3(tx, ty, tz) }; cam.position.set(px, py, pz); cam.fov = fov || 60; cam.updateProjectionMatrix(); }
  return { focar, visaoGeral, abrirSetor, vistaDaCadeira, sairDaVista, olharDe, percurso, liberar, livre: () => !noPercurso, pausar(b) { pausado = !!b; }, naVista: () => !!vista, atualizar() { pintar(destaqueAtual); }, setorAberto: () => setorAberto, destruir() { vivo = false; obs.disconnect(); ctr.dispose(); renderer.dispose(); renderer.domElement.remove(); } };
}
