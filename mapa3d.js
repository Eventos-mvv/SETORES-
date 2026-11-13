/* Mapa 3D do auditório (three.js), no estilo de mapa de teatro: vista de cima e de frente,
 * palco escuro na frente, cadeiras coloridas por região.
 * Uso: import { criarMapa3D } from './mapa3d.js';
 *      const m = criarMapa3D(elemento, { local: LOCAIS['verbo-cg'], setores:['A',...], alvo:{setor:'A',num:12} });
 *      m.focar('H',130); m.visaoGeral(); m.destruir();
 * Cada setor do local precisa de "arco" e "fileiras"; as cores vêm de local.grupos (ver locais.js).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const BASE = { piso: 0xffffff, plataforma: 0xeceaf0, plataformaFora: 0xf6f5f8, cadeiraFora: 0xe4e1e8, palco: 0x3a3238, palcoTopo: 0x4a4048, alvo: 0xf0a20b };

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

  cena.add(new THREE.HemisphereLight(0xffffff, 0xe9e4ee, 1.35));
  const sol = new THREE.DirectionalLight(0xffffff, 1.5);
  sol.position.set(-320, 700, 520); sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0008;
  Object.assign(sol.shadow.camera, { left: -640, right: 640, top: 640, bottom: -640, near: 10, far: 2200 });
  sol.target.position.set(0, 0, -220); cena.add(sol, sol.target);

  // sombra suave no chão (só recebe sombra; o fundo da página aparece)
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.ShadowMaterial({ opacity: .10 }));
  chao.rotation.x = -Math.PI / 2; chao.position.set(0, -.6, -200); chao.receiveShadow = true; cena.add(chao);

  const limites = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  // palco / púlpito e bloco central
  (loc.extras || []).forEach(x => {
    const pts = svgParaPontos(x.d); if (pts.length < 3) return;
    const cx = loc.centro[0], cy = loc.centro[1];
    pts.forEach(([px, py]) => { limites.x0 = Math.min(limites.x0, px - cx); limites.x1 = Math.max(limites.x1, px - cx); limites.z1 = Math.max(limites.z1, py - cy); });
    const sh = new THREE.Shape(pts.map(([px, py]) => new THREE.Vector2(px - cx, -(py - cy))));
    const alto = x.texto ? 22 : 18;
    const geo = new THREE.ExtrudeGeometry(sh, { depth: alto, bevelEnabled: true, bevelSize: 2.5, bevelThickness: 2.5, bevelSegments: 3 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, [new THREE.MeshStandardMaterial({ color: BASE.palcoTopo, roughness: .6 }), new THREE.MeshStandardMaterial({ color: BASE.palco, roughness: .7 })]);
    m.castShadow = m.receiveShadow = true; cena.add(m);
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
  const geoCad = (() => {
    const partes = [new THREE.BoxGeometry(6, 1.8, 5.4).translate(0, 3.2, 0), new THREE.BoxGeometry(6, 6.4, 1.6).translate(0, 5.6, 2.7)];
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
  const inst = new THREE.InstancedMesh(geoCad, new THREE.MeshStandardMaterial({ roughness: .55 }), lista.length);
  inst.castShadow = true; inst.receiveShadow = true;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color(), cinza = new THREE.Color(BASE.cadeiraFora);
  lista.forEach((c, i) => {
    q.setFromAxisAngle(up, c.rot != null ? c.rot : Math.atan2(c.x, c.z));
    const e = c.esc || 1; mtx.compose(new THREE.Vector3(c.x, 3, c.z), q, new THREE.Vector3(e, e, e));
    inst.setMatrixAt(i, mtx);
  });
  // opts.estado(setor, num) -> 'presente' | 'vazia' | outro: pinta quem chegou de verde e cadeira sem reserva de cinza
  const VERDE = new THREE.Color(0x2f9a62), VAZIA = new THREE.Color(0xb9b2bb);
  let destaqueAtual = null;
  function pintar(destaque) {
    destaqueAtual = destaque;
    lista.forEach((c, i) => {
      if (c.fora) col.copy(cinza);
      else {
        const e = opts.estado ? opts.estado(c.k, c.num) : null;
        col.copy(e === 'presente' ? VERDE : e === 'vazia' ? VAZIA : corSetor(c.k));
        if (destaque && c.k !== destaque) col.lerp(cinza, .72);
      }
      inst.setColorAt(i, col);
    });
    inst.instanceColor.needsUpdate = true;
    Object.entries(selos).forEach(([k, s]) => { s.material.opacity = (!destaque || k === destaque) ? 1 : .45; });
  }
  pintar(null);
  cena.add(inst);

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
    const vf = cam.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * cam.aspect);
    return Math.max(meioLarg / Math.tan(hf), (prof * Math.sin(ELEV) * .5 + 40) / Math.tan(vf)) * 1.04;
  }
  function posCam(alvo, d, dx = 0) { return new THREE.Vector3(alvo.x + dx, alvo.y + d * Math.sin(ELEV), alvo.z + d * Math.cos(ELEV)); }
  const GERAL = { alvo: new THREE.Vector3(0, 0, (limites.z0 + Math.max(40, limites.z1)) / 2), cam: new THREE.Vector3() };
  function visaoGeral(ms = 900) { pintar(null); pino.visible = false; setorAberto = null; mostrarNumeros(null); selos_visiveis(true); voar(GERAL.alvo, GERAL.cam, ms); if (opts.aoMudar) opts.aoMudar(null); }
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
    setorAberto = k; pintar(k); pino.visible = false; mostrarNumeros(k); selos_visiveis(false);
    const f = enquadrarSetor(k); voar(f.alvo, f.cam, ms);
    if (opts.aoMudar) opts.aoMudar({ setor: k });
  }

  function focar(setor, num, ms = 1500) {
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
    const a = acertar(e); if (!a) return;
    if (a.num != null && setorAberto === a.setor) { if (!opts.semDestaqueAoTocar) focar(a.setor, a.num, 700); if (opts.aoTocarCadeira) opts.aoTocarCadeira(a.setor, a.num); }
    else abrirSetor(a.setor);
  });
  if (matchMedia('(hover:hover)').matches) renderer.domElement.addEventListener('pointermove', e => {
    if (e.buttons) return; renderer.domElement.style.cursor = acertar(e) ? 'pointer' : 'grab';
  });

  function tamanho() {
    const w = el.clientWidth || 300, h = el.clientHeight || 300;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    const d = distancia(MEIO_LARG, PROF);
    GERAL.cam.copy(posCam(GERAL.alvo, d)); ctr.maxDistance = d * 1.25;
  }
  const obs = new ResizeObserver(tamanho); obs.observe(el); tamanho();
  ctr.target.copy(GERAL.alvo); cam.position.copy(GERAL.cam);

  let vivo = true; const ini = performance.now();
  (function loop(agora) {
    if (!vivo) return;
    requestAnimationFrame(loop);
    if (anim) anim(agora);
    if (pino.visible) {
      const t = (agora - ini) / 1000, o = Math.sin(t * 2.6);
      const sobe = (pino.userData.esc || 1) * 8; cab.position.y = 34 + sobe + o * 3; ponta.position.y = 21 + sobe + o * 3;
      halo.scale.setScalar((pino.userData.esc || 1) * (1.1 + (o + 1) * .25)); halo.material.opacity = .65 - (o + 1) * .18;
    }
    ctr.update(); renderer.render(cena, cam);
  })(ini);

  if (opts.alvo) focar(opts.alvo.setor, opts.alvo.num, opts.semAnimacao ? 1 : 1500); else visaoGeral(1);
  return { focar, visaoGeral, abrirSetor, atualizar() { pintar(destaqueAtual); }, setorAberto: () => setorAberto, destruir() { vivo = false; obs.disconnect(); ctr.dispose(); renderer.dispose(); renderer.domElement.remove(); } };
}
