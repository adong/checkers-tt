/* TT Checkers: the renderer, the park and the board.
   A bright wooden checkers board on a red-and-white picnic blanket in a sunny park (trees, bushes, flowers, a picnic
   basket, a watermelon slice and a juice box). The dark squares are green, the light ones cream. Each piece is a chunky
   ridged disc in its side's colour (blue for Teddy's side, orange for Tommy's); a king gets a little gold crown
   stacked on top. A jumped piece gets a BONK! and hops off the board onto the pile beside it.
     set(state)            every piece where the state says, straight away (a new game)
     sync(state)           every piece glides to where the state says (undo)
     move(ev, hooks)       a step, or a jump hop by hop (BONK on each), then the crown if he's crowned
     select(i) / moves(from, list)   the picked-up piece, and where it can go: dots, the hops of a jump, red rings
     must(list)            the pieces that must jump glow
     last(m)               the last move, in soft yellow
     hint(h)               your brother's tip: the piece, the whole path and the square glow, ❗ over a piece in danger
     cursor(i), shake(secs), pick(x, y), toScreen(v), layout(wide, flip)
   fit(points, elev, az, margins) aims the camera so world points fill the screen minus margins (in pixels). */
(function () {
  'use strict';
  const T = THREE;
  const CK = (window.CK = window.CK || {});
  const R = CK.rules;
  const { makeCanvas, toTexture, std, rand, pick: pickOne, radialTexture, emojiTexture } = Kit.gfx;

  const P = 1.0;                        // one square
  const RIM = 0.46;                     // the wooden frame round the squares
  const HB = 4 * P + RIM;               // half the board
  const BASE_H = 0.34;
  const TOP = BASE_H + 0.02;            // the squares' surface
  const PR = 0.39, PH = 0.2;            // a piece: radius, height
  const COL = { 0: '#2f7cf0', 1: '#ff8a1f' };
  const LIGHT = { 0: '#8fbcff', 1: '#ffc078' };
  const DARK = { 0: '#1b4fa8', 1: '#c25f08' };
  const SQ_L = '#fff1d2', SQ_D = '#2e9e58';

  let renderer = null, W = 1, H = 1;
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(36, 1, 0.1, 300);
  const camBase = new T.Vector3();
  const pieces = [];   // 24: { id, side, g, body, crown, shadow, at (square or -1), pile (slot or -1), king, anim }
  const bySq = new Array(R.N).fill(null);
  const fx = { t: 0, shake: 0, sel: -1, cursor: -1, wide: true, flip: 1, lastPath: null, hint: null, must: [] };
  let flyers = null, bursts = null;

  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    buildPark();
    buildBoard();
    buildPieces();
    buildMarks();
    resize();
  }
  function useFx(fl, bu) {
    flyers = fl;
    bursts = bu;
  }

  function resize() {
    W = Math.max(1, innerWidth || 1);
    H = Math.max(1, innerHeight || 1);
    if (renderer) renderer.setSize(W, H, false);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- shapes

  // A rounded rectangle slab, w wide (x) and d deep (z), h tall, centred on the origin, flat on y.
  function slab(w, d, h, r, bevel = 0.04) {
    const s = new T.Shape();
    const x = -w / 2 + bevel, y = -d / 2 + bevel, ww = w - 2 * bevel, dd = d - 2 * bevel, rr = Math.max(0.01, r - bevel);
    s.moveTo(x + rr, y);
    s.lineTo(x + ww - rr, y);
    s.quadraticCurveTo(x + ww, y, x + ww, y + rr);
    s.lineTo(x + ww, y + dd - rr);
    s.quadraticCurveTo(x + ww, y + dd, x + ww - rr, y + dd);
    s.lineTo(x + rr, y + dd);
    s.quadraticCurveTo(x, y + dd, x, y + dd - rr);
    s.lineTo(x, y + rr);
    s.quadraticCurveTo(x, y, x + rr, y);
    const g = new T.ExtrudeGeometry(s, { depth: h - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 5 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -(h - 2 * bevel) / 2, 0);
    return g;
  }

  // ---------------------------------------------------------------- the park

  function grassTexture() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#7fd35a';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,200,0.09)' : 'rgba(20,90,10,0.10)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 5);
    }
    return toTexture(c, true);
  }
  function ginghamTexture() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 256);
    const n = 8, s = 256 / n;
    g.fillStyle = 'rgba(232, 55, 60, 0.55)';
    for (let i = 0; i < n; i += 2) {
      g.fillRect(i * s, 0, s, 256);
      g.fillRect(0, i * s, 256, s);
    }
    g.fillStyle = 'rgba(200, 30, 40, 0.5)';
    for (let i = 0; i < n; i += 2) for (let j = 0; j < n; j += 2) g.fillRect(i * s, j * s, s, s);
    // a little weave
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 256; i += 4) g.fillRect(0, i, 256, 1);
    return toTexture(c, true);
  }

  const blanket = { mesh: null };
  function buildPark() {
    scene.background = new T.Color('#a8e6ff');
    scene.fog = new T.Fog('#a8e6ff', 34, 80);
    scene.add(new T.HemisphereLight('#ffffff', '#5a8a3a', 0.95));
    const sun = new T.DirectionalLight('#fff1d6', 0.9);
    sun.position.set(-6, 14, 9);
    scene.add(sun);

    const tex = grassTexture();
    tex.repeat.set(30, 30);
    const ground = new T.Mesh(new T.PlaneGeometry(160, 160), std('#ffffff', { map: tex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // the picnic blanket, a bit crooked, with a fringe
    const gt = ginghamTexture();
    gt.repeat.set(3, 3);
    const bl = new T.Mesh(new T.PlaneGeometry(16, 16), std('#ffffff', { map: gt, roughness: 0.95 }));
    bl.rotation.x = -Math.PI / 2;
    bl.rotation.z = 0.06;
    bl.position.y = 0.015;
    scene.add(bl);
    blanket.mesh = bl;
    const fringe = std('#f7d9d9');
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 20; i++) {
        const f = new T.Mesh(new T.PlaneGeometry(0.12, 0.4), fringe);
        f.rotation.x = -Math.PI / 2;
        const u = -7.6 + i * 0.8;
        const local = [[u, 8.15], [u, -8.15], [8.15, u], [-8.15, u]][k];
        const a = 0.06;
        f.position.set(local[0] * Math.cos(a) + local[1] * Math.sin(a), 0.012, -local[0] * Math.sin(a) + local[1] * Math.cos(a));
        f.rotation.z = a + (k >= 2 ? Math.PI / 2 : 0);
        scene.add(f);
      }
    }

    // round trees, bushes, flowers round the edge of the park
    const leaf = [std('#3fae4a'), std('#52c25a'), std('#2f9a3e'), std('#6fd06a')];
    const trunkMat = std('#9a6a3a');
    const tree = (x, z, s) => {
      const g = new T.Group();
      const trunk = new T.Mesh(new T.CylinderGeometry(0.22 * s, 0.3 * s, 2.2 * s, 8), trunkMat);
      trunk.position.y = 1.1 * s;
      g.add(trunk);
      for (let k = 0; k < 4; k++) {
        const ball = new T.Mesh(new T.SphereGeometry((1.1 - k * 0.12) * s, 14, 10), leaf[k % 4]);
        ball.position.set(Math.cos(k * 2.2) * 0.6 * s * (k ? 1 : 0), (2.6 + k * 0.45) * s, Math.sin(k * 2.2) * 0.6 * s * (k ? 1 : 0));
        g.add(ball);
      }
      g.position.set(x, 0, z);
      scene.add(g);
    };
    const bush = (x, z, s) => {
      for (let i = 0; i < 3; i++) {
        const b = new T.Mesh(new T.SphereGeometry(0.7 * s, 12, 9), leaf[i]);
        b.position.set(x + (i - 1) * 0.6 * s, 0.42 * s + (i === 1 ? 0.25 * s : 0), z + (i % 2) * 0.2);
        b.scale.y = 0.85;
        scene.add(b);
      }
    };
    const clear = (x, z) => Math.abs(x) < 10 && Math.abs(z) < 10;
    [[-13, -11], [12, -12], [-15, 2], [15, 0], [-12, 13], [13, 12], [0, -16], [-6, -15], [6, -15.5], [-16, -7], [16, -7], [-16, 8], [16, 7], [0, 16], [-6, 15.5], [6, 15]]
      .forEach(([x, z], k) => tree(x + rand(-0.8, 0.8), z + rand(-0.8, 0.8), rand(1.1, 1.5) * (k % 3 ? 1 : 1.2)));
    for (let i = 0; i < 30; i++) {
      const a = rand(0, Math.PI * 2), d = rand(11, 18);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!clear(x, z)) bush(x, z, rand(0.9, 1.5));
    }
    const petals = ['#ff6f91', '#ffd23f', '#ffffff', '#a77bff', '#ff8a1f'];
    const stem = std('#2f8a2a'), centre = std('#ffcc00');
    for (let i = 0; i < 110; i++) {
      const x = rand(-18, 18), z = rand(-17, 17);
      if (Math.abs(x) < 9 && Math.abs(z) < 9) continue;
      const f = new T.Group();
      const s = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.35, 5), stem);
      s.position.y = 0.17;
      f.add(s);
      const head = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), std(pickOne(petals)));
      head.position.y = 0.38;
      head.scale.y = 0.6;
      f.add(head);
      const dot = new T.Mesh(new T.SphereGeometry(0.05, 6, 4), centre);
      dot.position.y = 0.43;
      f.add(dot);
      f.position.set(x, 0, z);
      scene.add(f);
    }
    buildPicnic();
  }

  // the picnic on the blanket: a basket, a watermelon slice, a juice box, a plate of cookies
  const picnic = [];
  function buildPicnic() {
    // the basket
    const basket = new T.Group();
    const [c, g] = makeCanvas(128, 64);
    g.fillStyle = '#d9a35a';
    g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#a8742f';
    g.lineWidth = 3;
    for (let x = 0; x < 128; x += 10) for (let y = 0; y < 64; y += 10) {
      g.beginPath();
      g.moveTo(x, y + ((x / 10) % 2 ? 0 : 5));
      g.lineTo(x + 10, y + ((x / 10) % 2 ? 5 : 0));
      g.stroke();
    }
    const wicker = std('#ffffff', { map: toTexture(c), roughness: 1 });
    const box = new T.Mesh(new T.BoxGeometry(1.5, 0.75, 1.0), wicker);
    box.position.y = 0.38;
    basket.add(box);
    const lid = new T.Mesh(new T.BoxGeometry(1.56, 0.1, 1.06), std('#c78d45'));
    lid.position.y = 0.8;
    basket.add(lid);
    const handle = new T.Mesh(new T.TorusGeometry(0.42, 0.05, 8, 20, Math.PI), std('#a8742f'));
    handle.position.y = 0.84;
    basket.add(handle);
    const cloth = new T.Mesh(new T.BoxGeometry(0.5, 0.02, 1.08), std('#e8373c'));
    cloth.position.set(0.35, 0.86, 0);
    basket.add(cloth);
    picnic.push({ g: basket, at: [6.0, -5.4], ry: 0.5 });
    // the watermelon slice
    const melon = new T.Group();
    const rind = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, 0.22, 20, 1, false, 0, Math.PI), std('#3aa24a'));
    rind.rotation.x = Math.PI / 2;
    rind.position.y = 0.6;
    melon.add(rind);
    const flesh = new T.Mesh(new T.CylinderGeometry(0.52, 0.52, 0.24, 20, 1, false, 0, Math.PI), std('#ff4f5e'));
    flesh.rotation.x = Math.PI / 2;
    flesh.position.y = 0.6;
    melon.add(flesh);
    for (let k = 0; k < 5; k++) {
      const seed = new T.Mesh(new T.SphereGeometry(0.035, 6, 4), std('#2a1a12'));
      const a = 0.4 + k * 0.55;
      seed.position.set(Math.cos(a) * 0.33, 0.6 + Math.sin(a) * 0.33 - 0.0, 0.125);
      melon.add(seed);
    }
    melon.rotation.x = -Math.PI / 2;
    melon.position.y = 0.0;
    const melonHolder = new T.Group();
    melon.position.set(0, 0.13, 0.6);
    melonHolder.add(melon);
    picnic.push({ g: melonHolder, at: [-6.2, 5.6], ry: -0.4 });
    // the juice box with a straw
    const juice = new T.Group();
    const jb = new T.Mesh(new T.BoxGeometry(0.42, 0.62, 0.28), std('#ffcf2e'));
    jb.position.y = 0.31;
    juice.add(jb);
    const label = new T.Mesh(new T.PlaneGeometry(0.3, 0.3), new T.MeshBasicMaterial({ map: emojiTexture('🍊'), transparent: true }));
    label.position.set(0, 0.32, 0.141);
    juice.add(label);
    const straw = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.4, 6), std('#ff3d7f'));
    straw.position.set(0.1, 0.75, 0);
    straw.rotation.z = -0.25;
    juice.add(straw);
    picnic.push({ g: juice, at: [6.4, 5.0], ry: -0.3 });
    // a plate of cookies
    const plate = new T.Group();
    const dish = new T.Mesh(new T.CylinderGeometry(0.62, 0.5, 0.06, 24), std('#ffffff', { roughness: 0.4 }));
    dish.position.y = 0.03;
    plate.add(dish);
    for (let k = 0; k < 4; k++) {
      const ck = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.06, 14), std('#c98a4a'));
      ck.position.set(Math.cos(k * 1.6) * 0.25, 0.09 + k * 0.012, Math.sin(k * 1.6) * 0.25);
      ck.rotation.set(rand(-0.1, 0.1), 0, rand(-0.1, 0.1));
      plate.add(ck);
      for (let j = 0; j < 3; j++) {
        const chip = new T.Mesh(new T.SphereGeometry(0.03, 5, 4), std('#4a2a14'));
        chip.position.set(ck.position.x + rand(-0.1, 0.1), ck.position.y + 0.035, ck.position.z + rand(-0.1, 0.1));
        plate.add(chip);
      }
    }
    picnic.push({ g: plate, at: [-6.0, -5.8], ry: 0 });
    for (const p of picnic) {
      p.g.position.set(p.at[0], 0.02, p.at[1]);
      p.g.rotation.y = p.ry;
      scene.add(p.g);
    }
  }

  // ---------------------------------------------------------------- the board

  function boardTexture() {
    const S = 1024, q = S / 8;
    const [c, g] = makeCanvas(S, S);
    for (let r = 0; r < 8; r++) {
      for (let col = 0; col < 8; col++) {
        const dark = (r + col) % 2 === 1;
        const x = col * q, y = r * q;
        g.fillStyle = dark ? SQ_D : SQ_L;
        g.fillRect(x, y, q, q);
        // a soft bevel: light top-left, shade bottom-right, so each square looks like a chunky tile
        const grad = g.createLinearGradient(x, y, x + q, y + q);
        grad.addColorStop(0, dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.5)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0)');
        grad.addColorStop(1, dark ? 'rgba(0,40,10,0.22)' : 'rgba(150,100,40,0.16)');
        g.fillStyle = grad;
        g.fillRect(x, y, q, q);
        g.strokeStyle = dark ? 'rgba(10,60,25,0.55)' : 'rgba(180,140,80,0.45)';
        g.lineWidth = 3;
        g.strokeRect(x + 1.5, y + 1.5, q - 3, q - 3);
        if (dark) {
          // tiny daisies on the green
          for (let k = 0; k < 3; k++) {
            const fx2 = x + rand(18, q - 18), fy = y + rand(18, q - 18);
            g.fillStyle = 'rgba(255,255,255,0.13)';
            for (let p = 0; p < 5; p++) {
              g.beginPath();
              g.arc(fx2 + Math.cos(p * 1.26) * 4, fy + Math.sin(p * 1.26) * 4, 2.6, 0, 7);
              g.fill();
            }
          }
        }
      }
    }
    const t = toTexture(c);
    t.anisotropy = 4;
    return t;
  }

  function buildBoard() {
    const board = new T.Group();
    scene.add(board);
    const wood = std('#d9984e', { roughness: 0.7 });
    const woodSide = std('#b8742f', { roughness: 0.8 });
    const base = new T.Mesh(slab(HB * 2, HB * 2, BASE_H, 0.45, 0.08), [wood, woodSide]);
    base.position.y = BASE_H / 2;
    board.add(base);
    const top = new T.Mesh(new T.PlaneGeometry(8 * P, 8 * P), std('#ffffff', { map: boardTexture(), roughness: 0.6 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = TOP;
    board.add(top);
    // a raised lip round the squares
    const lipMat = std('#e8a95e', { roughness: 0.6 });
    for (const [w, d, x, z] of [[8 * P + 0.16, 0.08, 0, 4 * P + 0.04], [8 * P + 0.16, 0.08, 0, -4 * P - 0.04], [0.08, 8 * P, 4 * P + 0.04, 0], [0.08, 8 * P, -4 * P - 0.04, 0]]) {
      const m = new T.Mesh(new T.BoxGeometry(w, 0.05, d), lipMat);
      m.position.set(x, TOP + 0.01, z);
      board.add(m);
    }
    // the board's top sits a little above the base: fill the gap
    const under = new T.Mesh(new T.BoxGeometry(8 * P + 0.02, TOP - BASE_H, 8 * P + 0.02), std('#b8742f'));
    under.position.y = BASE_H + (TOP - BASE_H) / 2 - 0.006; // its top just under the squares, never level with them
    board.add(under);
    // short feet
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const f = new T.Mesh(new T.CylinderGeometry(0.22, 0.26, 0.12, 12), woodSide);
      f.position.set(sx * (HB - 0.5), 0.02, sz * (HB - 0.5));
      board.add(f);
    }
  }

  // ---------------------------------------------------------------- the pieces

  function topTexture(side) {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = COL[side];
    g.fillRect(0, 0, 256, 256);
    const grad = g.createRadialGradient(100, 90, 10, 128, 128, 140);
    grad.addColorStop(0, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    // the grooves of a classic checker
    for (const [r, w, a] of [[104, 9, 0.35], [78, 6, 0.28], [52, 5, 0.22]]) {
      g.strokeStyle = `rgba(0,0,0,${a})`;
      g.lineWidth = w;
      g.beginPath();
      g.arc(128, 128, r, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(128, 128, r + w * 0.7, 0, Math.PI * 2);
      g.stroke();
    }
    return toTexture(c);
  }

  function buildCrown() {
    const holder = new T.Group();
    const g = new T.Group();
    g.scale.setScalar(1.3);
    holder.add(g);
    const gold = std('#ffcc1a', { metalness: 0.55, roughness: 0.28, emissive: '#5a3a00', emissiveIntensity: 0.25 });
    const band = new T.Mesh(new T.CylinderGeometry(0.21, 0.24, 0.13, 20, 1, true), gold);
    band.material.side = T.DoubleSide;
    band.position.y = 0.065;
    g.add(band);
    const floor = new T.Mesh(new T.CircleGeometry(0.21, 20), std('#d23a3a'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.03;
    g.add(floor);
    const gems = [std('#ff3d5a', { roughness: 0.2 }), std('#3dd6ff', { roughness: 0.2 })];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const spike = new T.Mesh(new T.ConeGeometry(0.065, 0.16, 6), gold);
      spike.position.set(Math.sin(a) * 0.205, 0.2, Math.cos(a) * 0.205);
      g.add(spike);
      const ball = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), gold);
      ball.position.set(Math.sin(a) * 0.205, 0.29, Math.cos(a) * 0.205);
      g.add(ball);
      const gem = new T.Mesh(new T.SphereGeometry(0.035, 8, 6), gems[k % 2]);
      gem.position.set(Math.sin(a + 0.63) * 0.235, 0.065, Math.cos(a + 0.63) * 0.235);
      gem.scale.set(1, 1.2, 0.6);
      gem.lookAt(0, 0.065, 0);
      g.add(gem);
    }
    return holder;
  }

  let shadowTex = null;
  function buildPieces() {
    shadowTex = radialTexture(64, [[0, 'rgba(20,30,10,0.5)'], [0.7, 'rgba(20,30,10,0.2)'], [1, 'rgba(20,30,10,0)']]);
    const bodyGeo = new T.CylinderGeometry(PR, PR * 1.02, PH, 32);
    const ridgeGeo = new T.TorusGeometry(PR * 1.0, 0.028, 6, 32);
    const capGeo = new T.CircleGeometry(PR * 0.96, 32);
    for (let id = 0; id < 24; id++) {
      const side = id < 12 ? R.ORANGE : R.BLUE;
      const g = new T.Group();
      const body = new T.Group();
      g.add(body);
      const mat = std(COL[side], { roughness: 0.35 });
      const disc = new T.Mesh(bodyGeo, mat);
      disc.position.y = PH / 2;
      body.add(disc);
      for (const y of [0.06, 0.14]) {
        const ridge = new T.Mesh(ridgeGeo, std(DARK[side], { roughness: 0.4 }));
        ridge.rotation.x = Math.PI / 2;
        ridge.position.y = y;
        body.add(ridge);
      }
      const cap = new T.Mesh(capGeo, std('#ffffff', { map: topTexture(side), roughness: 0.35 }));
      cap.rotation.x = -Math.PI / 2;
      cap.position.y = PH + 0.002;
      body.add(cap);
      const crown = buildCrown();
      crown.position.y = PH;
      crown.visible = false;
      body.add(crown);
      const shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.setScalar(PR * 2.7);
      shadow.position.y = 0.012;
      shadow.renderOrder = 1;
      g.add(shadow);
      scene.add(g);
      pieces.push({ id, side, g, body, disc, crown, shadow, at: -1, pile: -1, king: false, crownT: -1, anim: null, lift: 0, land: -1 });
    }
  }

  const cellPos = (i, out = new T.Vector3()) => out.set((R.colOf(i) - 3.5) * P, TOP, (R.rowOf(i) - 3.5) * P);

  // ---------------------------------------------------------------- where the boys, the piles and the buddy go

  // In "kid space" the kid's side is at +z (the camera's end). wide: both stand beside the board on the left, each at
  // his own end, with the piles on the right; tall (a phone held upright): in front of and behind the board, so the
  // board can use the whole width. flip turns it all round for a kid playing orange.
  const SPOT = {
    wide: { me: [-(HB + 1.3), 2.0], them: [-(HB + 1.3), -2.0], buddy: [-(HB + 1.45), 4.1], pile: [[HB + 0.85, 2.0], [HB + 0.85, -2.0]] },
    tall: { me: [-1.6, HB + 1.45], them: [1.6, -(HB + 1.45)], buddy: [-3.45, HB + 1.2], pile: [[1.9, HB + 0.85], [-1.9, -(HB + 0.85)]] },
  };
  function layout(wide, flip) {
    fx.wide = wide;
    fx.flip = flip ? -1 : 1;
    for (const p of pieces) if (p.at < 0 && p.pile >= 0 && !p.anim) pilePos(p.side, p.pile, p.g.position);
  }
  const fl = (xz) => ({ x: xz[0] * fx.flip, z: xz[1] * fx.flip });
  const L = () => SPOT[fx.wide ? 'wide' : 'tall'];
  // kid: the side the camera looks from (fx.flip) — spotFor(true) is the kid's spot, spotFor(false) the other side's
  const spotFor = (mine) => fl(L()[mine ? 'me' : 'them']);
  const buddySpot = () => fl(L().buddy);
  // the pile of pieces side s has taken: next to s's end of the board (the kid's pile is pile[0] in kid space)
  function pilePos(takenFrom, k, out = new T.Vector3()) {
    const taker = 1 - takenFrom;
    const mine = (taker === R.BLUE) === (fx.flip === 1);
    const base = fl(L().pile[mine ? 0 : 1]);
    const stack = Math.floor(k / 6), h = k % 6;
    // two stacks side by side, along the board's edge (x in a tall layout, z in a wide one)
    const along = (stack - 0.5) * 0.92 * (mine ? 1 : -1) * fx.flip;
    return out.set(base.x + (fx.wide ? 0 : along), h * (PH + 0.004), base.z + (fx.wide ? along : 0));
  }
  // the points the camera must keep in view
  function viewPoints() {
    const V = T.Vector3, pts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push(new V(sx * HB, 0, sz * HB), new V(sx * HB, TOP + PH, sz * HB));
    for (const k of [0, 11]) for (const s of [0, 1]) {
      const p = pilePos(s, k);
      pts.push(new V(p.x - 0.45, 0, p.z - 0.45), new V(p.x + 0.45, 0, p.z + 0.45), new V(p.x, 6 * PH, p.z));
    }
    return pts;
  }

  // ---------------------------------------------------------------- set, sync

  function setKing(p, on, pop = false) {
    p.king = on;
    p.crown.visible = on;
    p.crownT = on && pop ? 0 : -1;
    p.crown.scale.setScalar(on && pop ? 0.01 : 1);
  }

  function counts(st) {
    // how many of each side are off the board: the piles
    return [12 - R.count(st.b, R.BLUE), 12 - R.count(st.b, R.ORANGE)];
  }

  function set(st) {
    bySq.fill(null);
    const free = [pieces.filter((p) => p.side === R.BLUE), pieces.filter((p) => p.side === R.ORANGE)];
    for (const p of pieces) {
      p.anim = null;
      p.at = -1;
      p.pile = -1;
      p.lift = 0;
      p.land = -1;
      p.body.position.set(0, 0, 0);
      p.body.rotation.set(0, 0, 0);
      p.body.scale.set(1, 1, 1);
      p.g.visible = true;
    }
    for (let i = 0; i < R.N; i++) {
      const v = st.b[i];
      if (!v) continue;
      const p = free[R.sideOf(v)].shift();
      p.at = i;
      bySq[i] = p;
      setKing(p, R.isKing(v));
      cellPos(i, p.g.position);
    }
    for (const s of [0, 1]) free[s].forEach((p, k) => {
      p.pile = k;
      setKing(p, false);
      pilePos(s, k, p.g.position);
    });
    fx.sel = -1;
  }

  // Glide every piece to where the state says (undo): pieces that are already right stay; pieces come back off the
  // piles onto the board, and crowns come off kings that weren't kings yet.
  function sync(st) {
    const want = new Array(R.N).fill(null);
    const used = new Set();
    for (let i = 0; i < R.N; i++) {
      const v = st.b[i];
      if (!v) continue;
      const p = bySq[i];
      if (p && p.side === R.sideOf(v) && !p.anim) {
        want[i] = p;
        used.add(p);
      }
    }
    for (let i = 0; i < R.N; i++) {
      const v = st.b[i];
      if (!v || want[i]) continue;
      const s = R.sideOf(v);
      // the nearest piece of that side not yet used: on the board first, then off the pile
      const to = cellPos(i);
      let best = null, bd = Infinity;
      for (const p of pieces) {
        if (p.side !== s || used.has(p)) continue;
        if (p.at >= 0 && st.b[p.at] && bySq[p.at] === p && R.sideOf(st.b[p.at]) === s && want[p.at] === p) continue;
        const d = p.g.position.distanceTo(to) + (p.at < 0 ? 50 : 0);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      want[i] = best;
      used.add(best);
    }
    bySq.fill(null);
    const pileN = [0, 0];
    const pileList = pieces.filter((p) => !used.has(p)).sort((a, b) => (a.pile < 0 ? 99 : a.pile) - (b.pile < 0 ? 99 : b.pile));
    for (const p of pieces) {
      p.body.rotation.set(0, 0, 0);
      p.body.scale.set(1, 1, 1);
      p.body.position.set(0, 0, 0);
    }
    for (let i = 0; i < R.N; i++) {
      const p = want[i];
      if (!p) continue;
      bySq[i] = p;
      const was = p.at;
      p.at = i;
      p.pile = -1;
      setKing(p, R.isKing(st.b[i]), R.isKing(st.b[i]) && !p.king);
      const to = cellPos(i);
      if (was !== i || p.g.position.distanceTo(to) > 0.01) p.anim = { kind: 'glide', t: 0, dur: 0.45, from: p.g.position.clone(), to, arc: 0.7 };
      else p.anim = null;
    }
    for (const p of pileList) {
      p.at = -1;
      p.pile = pileN[p.side]++;
      setKing(p, false);
      const to = pilePos(p.side, p.pile);
      if (p.g.position.distanceTo(to) > 0.01) p.anim = { kind: 'glide', t: 0, dur: 0.45, from: p.g.position.clone(), to, arc: 0.7 };
    }
    fx.sel = -1;
  }

  // ---------------------------------------------------------------- moving

  // Animate a move from rules.play(): one hop per square in its path (a little hop for a step, a big one for each
  // jump), the jumped piece BONKed off the board after each jump, and the crown at the end.
  // hooks: { hop(k, ev), bonk(k, ev), land(ev) } — land is called once it has settled (and been crowned).
  function move(ev, hooks = {}) {
    const p = bySq[ev.from];
    if (!p) {
      if (hooks.land) hooks.land(ev);
      return;
    }
    bySq[ev.from] = null;
    bySq[ev.to] = p;
    p.at = ev.to;
    const jump = ev.caps.length > 0;
    p.anim = { kind: 'hops', k: 0, t: 0, squares: [ev.from].concat(ev.path), dur: jump ? 0.4 : 0.3, arc: jump ? 0.95 : 0.35, ev, hooks, jump };
    if (hooks.hop) hooks.hop(0, ev);
    fx.sel = -1;
  }

  function bonk(ev, k) {
    const sqr = ev.caps[k];
    const q = bySq[sqr];
    if (!q) return;
    bySq[sqr] = null;
    q.at = -1;
    const n = pieces.filter((x) => x.side === q.side && x.at < 0 && x.pile >= 0).length;
    q.pile = n;
    const to = pilePos(q.side, n);
    const wasKing = q.king;
    q.anim = { kind: 'fly', t: -0.05, dur: 0.85, from: q.g.position.clone(), to, arc: 2.4, uncrown: wasKing };
    const p = cellPos(sqr);
    if (bursts) bursts.add('BONK!', p.x, TOP + 1.3, p.z, 1.8, '#ffd400', '#e8372c');
    if (flyers) {
      flyers.add('💥', p.x, TOP + 0.5, p.z, 0, 0.6, 0.9, 0.45, 0, 0);
      for (let i = 0; i < 6; i++) flyers.add(i % 2 ? '⭐' : '💫', p.x, TOP + 0.6, p.z, rand(-2, 2), rand(1.5, 3), 0.4, 0.8, rand(-4, 4), 5);
    }
    shake(0.12 + 0.06 * k);
  }

  function crownUp(p) {
    setKing(p, true, true);
    const q = p.g.position;
    if (bursts) bursts.add('KING ME!', q.x, TOP + 1.5, q.z, 2.0, '#ffe25a', '#ff8a1f');
    if (flyers) for (let i = 0; i < 10; i++) flyers.add(i % 2 ? '✨' : '👑', q.x, TOP + 0.6, q.z, rand(-2, 2), rand(2, 3.5), 0.42, 1.0, rand(-3, 3), 5);
  }

  // ---------------------------------------------------------------- the marks: moves, the last move, the hint

  let selRing = null, cursorRing = null, hintTo = null, hintFrom = null, finger = null, dangerMark = null;
  const dots = [], hopDots = [], rings = [], icons = [], arcDots = [], lastMarks = [], mustGlows = [], hintArc = [];
  function flat(geo, mat, order = 5) {
    const m = new T.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = order;
    scene.add(m);
    return m;
  }
  function frameTexture(color, ink) {
    const [c, g] = makeCanvas(128, 128);
    g.strokeStyle = color;
    g.lineWidth = 12;
    Kit.gfx.roundRect(g, 10, 10, 108, 108, 18);
    g.stroke();
    g.strokeStyle = ink;
    g.lineWidth = 4;
    Kit.gfx.roundRect(g, 3, 3, 122, 122, 22);
    g.stroke();
    return toTexture(c);
  }
  function sprite(emoji, size, order = 24) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture(emoji), depthTest: false, transparent: true }));
    s.scale.setScalar(size);
    s.visible = false;
    s.renderOrder = order;
    scene.add(s);
    return s;
  }
  function buildMarks() {
    const dotMat = new T.MeshBasicMaterial({ color: '#4dff88', transparent: true, opacity: 0.95, depthWrite: false });
    const dotEdge = new T.MeshBasicMaterial({ color: '#14121f', transparent: true, opacity: 0.6, depthWrite: false });
    for (let i = 0; i < 12; i++) {
      const d = flat(new T.CircleGeometry(0.22, 24), dotMat.clone(), 7);
      const e = flat(new T.CircleGeometry(0.28, 24), dotEdge, 6);
      dots.push({ d, e });
    }
    const hopMat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
    for (let i = 0; i < 16; i++) hopDots.push(flat(new T.RingGeometry(0.12, 0.2, 20), hopMat, 7));
    const ringMat = new T.MeshBasicMaterial({ color: '#ff3d3d', transparent: true, depthWrite: false });
    for (let i = 0; i < 12; i++) rings.push(flat(new T.RingGeometry(0.42, 0.52, 32), ringMat.clone(), 7));
    for (let i = 0; i < 12; i++) icons.push(sprite('💥', 0.42));
    const arcMat = new T.MeshBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true });
    for (let i = 0; i < 140; i++) {
      const s = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), arcMat);
      s.visible = false;
      s.renderOrder = 8;
      scene.add(s);
      arcDots.push(s);
    }
    const goldMat = new T.MeshBasicMaterial({ color: '#ffd400', depthTest: false, transparent: true });
    for (let i = 0; i < 60; i++) {
      const s = new T.Mesh(new T.SphereGeometry(0.065, 8, 6), goldMat);
      s.visible = false;
      s.renderOrder = 9;
      scene.add(s);
      hintArc.push(s);
    }
    selRing = flat(new T.RingGeometry(0.44, 0.54, 32), new T.MeshBasicMaterial({ color: '#ffd400', transparent: true, depthWrite: false }), 7);
    const lastTex = radialTexture(64, [[0, 'rgba(255,240,120,0.6)'], [0.75, 'rgba(255,220,60,0.45)'], [1, 'rgba(255,220,60,0)']]);
    for (let i = 0; i < 6; i++) lastMarks.push(flat(new T.PlaneGeometry(P * 1.02, P * 1.02), new T.MeshBasicMaterial({ map: lastTex, transparent: true, depthWrite: false }), 4));
    cursorRing = flat(new T.PlaneGeometry(P * 1.08, P * 1.08), new T.MeshBasicMaterial({ map: frameTexture('#ffd400', '#14121f'), transparent: true, depthWrite: false }), 6);
    const glowTex = radialTexture(128, [[0, 'rgba(255,230,90,1)'], [0.45, 'rgba(255,200,40,0.65)'], [1, 'rgba(255,190,0,0)']]);
    const mustTex = radialTexture(128, [[0, 'rgba(255,170,40,0.95)'], [0.5, 'rgba(255,120,20,0.6)'], [1, 'rgba(255,90,0,0)']]);
    for (let i = 0; i < 12; i++) mustGlows.push(flat(new T.PlaneGeometry(P * 1.5, P * 1.5), new T.MeshBasicMaterial({ map: mustTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }), 3));
    hintTo = flat(new T.PlaneGeometry(P * 1.8, P * 1.8), new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }), 5);
    hintFrom = flat(new T.PlaneGeometry(P * 1.7, P * 1.7), new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }), 5);
    finger = sprite('👇', 0.8, 25);
    dangerMark = sprite('❗', 0.6, 25);
  }

  let shown = []; // the moves being shown for the picked-up piece
  function moves(from, list) {
    shown = list || [];
    fx.movesFrom = from;
    fx.movesT = 0;
  }
  function select(i) {
    fx.sel = i;
    if (i < 0) moves(-1, []);
  }
  function last(m) { fx.lastPath = m ? [m.from].concat(m.path) : null; }
  function hint(h) {
    fx.hint = h || null;
    fx.hintT = 0;
  }
  function must(list) { fx.must = list || []; }
  function cursor(i) { fx.cursor = i; }
  function shake(secs) { fx.shake = Math.max(fx.shake, secs); }

  // ---------------------------------------------------------------- every frame

  const tmp = new T.Vector3(), tmp2 = new T.Vector3();
  const ease = (u) => 1 - Math.pow(1 - u, 3);
  function update(dt) {
    fx.t += dt;
    for (const p of pieces) updatePiece(p, dt);
    updateMarks(dt);
    if (fx.shake > 0) {
      fx.shake = Math.max(0, fx.shake - dt);
      const amp = fx.shake * 0.25;
      cam.position.set(camBase.x + (Math.random() - 0.5) * amp, camBase.y + (Math.random() - 0.5) * amp, camBase.z + (Math.random() - 0.5) * amp);
      cam.updateMatrixWorld(true);
    } else if (!cam.position.equals(camBase) && camBase.lengthSq()) {
      cam.position.copy(camBase);
      cam.updateMatrixWorld(true);
    }
  }

  function updatePiece(p, dt) {
    const a = p.anim;
    if (a) {
      a.t += dt;
      if (a.kind === 'hops') {
        const u = Math.max(0, Math.min(1, a.t / a.dur));
        const from = cellPos(a.squares[a.k], tmp), to = cellPos(a.squares[a.k + 1], tmp2);
        p.g.position.lerpVectors(from, to, ease(u));
        p.g.position.y += Math.sin(u * Math.PI) * a.arc;
        const sq = Math.sin(u * Math.PI);
        p.body.scale.set(1 - sq * 0.08, 1 + sq * 0.14, 1 - sq * 0.08);
        if (u >= 1) {
          p.body.scale.set(1, 1, 1);
          p.g.position.copy(to);
          p.land = 0;
          if (a.jump) {
            bonk(a.ev, a.k);
            if (a.hooks.bonk) a.hooks.bonk(a.k, a.ev);
          }
          a.k++;
          a.t = 0;
          if (a.k >= a.squares.length - 1) {
            p.anim = null;
            if (a.ev.crown) {
              crownUp(p);
              p.anim = { kind: 'wait', t: 0, dur: 0.55, ev: a.ev, hooks: a.hooks };
            } else if (a.hooks.land) a.hooks.land(a.ev);
          } else {
            a.t = -0.08; // a breath between hops
            if (a.hooks.hop) a.hooks.hop(a.k, a.ev);
          }
        }
      } else if (a.kind === 'wait') {
        if (a.t >= a.dur) {
          p.anim = null;
          if (a.hooks.land) a.hooks.land(a.ev);
        }
      } else {
        // glide (undo) or fly (jumped, off to the pile)
        const u = Math.max(0, Math.min(1, a.t / a.dur));
        const k = a.kind === 'fly' ? u : ease(u);
        p.g.position.lerpVectors(a.from, a.to, k);
        p.g.position.y += Math.sin(u * Math.PI) * a.arc;
        if (a.kind === 'fly') {
          p.body.rotation.z = u * Math.PI * 4 * (p.side ? -1 : 1);
          if (a.uncrown && u > 0.5) {
            a.uncrown = false;
            setKing(p, false);
            if (flyers) flyers.add('👑', p.g.position.x, p.g.position.y + 0.4, p.g.position.z, rand(-1, 1), 2.5, 0.45, 0.8, 3, 6);
          }
        }
        if (u >= 1 && a.t >= 0) {
          p.anim = null;
          p.body.rotation.z = 0;
          p.g.position.copy(a.to);
          if (a.kind === 'fly') {
            p.land = 0;
            if (CK.sfx) CK.sfx.clink();
          }
        }
      }
    }
    if (p.land >= 0) {
      p.land += dt;
      const k = p.land / 0.22;
      const s = Math.sin(Math.min(1, k) * Math.PI) * 0.2 * (1 - Math.min(1, k));
      p.body.scale.set(1 + s, 1 - s * 1.3, 1 + s);
      if (k >= 1) {
        p.land = -1;
        p.body.scale.set(1, 1, 1);
      }
    }
    // the crown pops on with a bounce
    if (p.crownT >= 0) {
      p.crownT += dt;
      const u = Math.min(1, p.crownT / 0.45);
      p.crown.scale.setScalar(Math.max(0.01, u * (1 + Math.sin(u * Math.PI) * 0.45)));
      p.crown.position.y = PH + Math.sin(u * Math.PI) * 0.5;
      if (u >= 1) {
        p.crownT = -1;
        p.crown.scale.setScalar(1);
        p.crown.position.y = PH;
      }
    }
    // the picked-up piece floats and wiggles
    const lift = p.at >= 0 && p.at === fx.sel && !p.anim ? 0.3 + Math.sin(fx.t * 6) * 0.05 : 0;
    p.lift += (lift - p.lift) * Math.min(1, dt * 14);
    if (!p.anim || p.anim.kind === 'wait') {
      p.body.position.y = p.lift;
      p.body.rotation.z = p.at === fx.sel && p.at >= 0 ? Math.sin(fx.t * 9) * 0.06 : 0;
    }
    // the shadow lies on the board while the piece is on it (or hopping across it), else on the blanket
    const onBoard = p.anim ? p.anim.kind === 'hops' || p.anim.kind === 'wait' || (p.anim.kind === 'glide' && p.at >= 0) : p.at >= 0;
    const groundY = onBoard ? TOP : 0.02;
    p.shadow.position.y = -p.g.position.y + groundY + 0.012;
    p.shadow.material.opacity = 1 / (1 + (Math.max(0, p.g.position.y - groundY) + p.lift) * 2);
    p.shadow.visible = !(p.at < 0 && !p.anim && p.pile >= 0 && p.pile % 6 > 0);
  }

  // dots along a hop from square a to b, `n` of them, lifted in an arc
  function arc(a, b, pool, start, n, height, t, scale) {
    cellPos(a, tmp);
    cellPos(b, tmp2);
    let k = start;
    for (let j = 1; j <= n; j++) {
      const s = pool[k];
      if (!s) break;
      const u = j / (n + 1);
      s.visible = true;
      s.position.lerpVectors(tmp, tmp2, u);
      s.position.y = TOP + 0.12 + Math.sin(u * Math.PI) * height;
      s.scale.setScalar(scale * (0.8 + 0.4 * Math.abs(Math.sin(t * 6 - j * 0.7))));
      k++;
    }
    return k;
  }

  function updateMarks(dt) {
    const t = fx.t;
    // the picked-up piece: a gold ring under it
    selRing.visible = fx.sel >= 0;
    if (fx.sel >= 0) {
      cellPos(fx.sel, tmp);
      selRing.position.set(tmp.x, tmp.y + 0.02, tmp.z);
      selRing.scale.setScalar(1 + Math.sin(t * 6) * 0.05);
    }
    // where it can go: a dot on each square it can finish on, small rings on the squares a multi-jump hops through,
    // dotted arcs over each jump, and red rings and 💥 on the pieces it would take
    let nd = 0, nh = 0, nr = 0, ni = 0, na = 0;
    fx.movesT = (fx.movesT || 0) + dt;
    const pop = Math.min(1, fx.movesT * 6);
    const seenRing = new Set(), seenHop = new Set(), seenDot = new Set();
    for (const m of shown) {
      const squares = [m.from].concat(m.path);
      for (let k = 0; k + 1 < squares.length; k++) {
        if (m.caps.length) na = arc(squares[k], squares[k + 1], arcDots, na, 7, 0.7, t, pop);
        if (k + 2 < squares.length && !seenHop.has(squares[k + 1])) {
          seenHop.add(squares[k + 1]);
          const h = hopDots[nh++];
          if (h) {
            cellPos(squares[k + 1], tmp);
            h.visible = true;
            h.position.set(tmp.x, tmp.y + 0.03, tmp.z);
            h.scale.setScalar(pop);
          }
        }
      }
      for (const c of m.caps) {
        if (seenRing.has(c)) continue;
        seenRing.add(c);
        cellPos(c, tmp);
        const r = rings[nr++];
        if (r) {
          r.visible = true;
          r.position.set(tmp.x, tmp.y + 0.025, tmp.z);
          r.scale.setScalar(pop * (1 + Math.sin(t * 7) * 0.06));
        }
        const ic = icons[ni++];
        if (ic) {
          ic.visible = true;
          ic.position.set(tmp.x, tmp.y + 0.85 + Math.abs(Math.sin(t * 4)) * 0.12, tmp.z);
          ic.scale.setScalar(0.5 * pop);
        }
      }
      if (seenDot.has(m.to)) continue;
      seenDot.add(m.to);
      cellPos(m.to, tmp);
      const d = dots[nd++];
      if (d) {
        d.d.visible = d.e.visible = true;
        d.d.position.set(tmp.x, tmp.y + 0.03, tmp.z);
        d.e.position.set(tmp.x, tmp.y + 0.025, tmp.z);
        const s = pop * (1 + Math.sin(t * 5 + m.to) * 0.08);
        d.d.scale.setScalar(s);
        d.e.scale.setScalar(s);
        d.d.material.color.set(m.crown ? '#ffd400' : '#4dff88');
      }
    }
    for (let i = nd; i < dots.length; i++) dots[i].d.visible = dots[i].e.visible = false;
    for (let i = nh; i < hopDots.length; i++) hopDots[i].visible = false;
    for (let i = nr; i < rings.length; i++) rings[i].visible = false;
    for (let i = ni; i < icons.length; i++) icons[i].visible = false;
    for (let i = na; i < arcDots.length; i++) arcDots[i].visible = false;
    // the pieces that must jump glow (orange, pulsing)
    for (let i = 0; i < mustGlows.length; i++) {
      const sqr = fx.must[i];
      const g = mustGlows[i];
      g.visible = sqr !== undefined && sqr !== fx.sel;
      if (!g.visible) continue;
      cellPos(sqr, tmp);
      g.position.set(tmp.x, tmp.y + 0.008, tmp.z);
      g.scale.setScalar(0.9 + Math.sin(t * 5) * 0.12);
    }
    // the last move: its squares in soft yellow
    const lp = fx.lastPath;
    for (let i = 0; i < lastMarks.length; i++) {
      const m = lastMarks[i];
      m.visible = !!lp && i < lp.length;
      if (!m.visible) continue;
      cellPos(lp[i], tmp);
      m.position.set(tmp.x, tmp.y + 0.012, tmp.z);
    }
    // the keyboard cursor
    cursorRing.visible = fx.cursor >= 0;
    if (fx.cursor >= 0) {
      cellPos(fx.cursor, tmp);
      cursorRing.position.set(tmp.x, tmp.y + 0.03, tmp.z);
      cursorRing.scale.setScalar(1 + Math.sin(t * 7) * 0.035);
    }
    // your brother's tip: the piece and the square glow, gold dots trace the whole path, a bouncing 👇, and ❗ over a
    // piece in danger
    const h = fx.hint;
    hintTo.visible = finger.visible = hintFrom.visible = !!h;
    let ng = 0;
    if (h) {
      fx.hintT += dt;
      const grow = Math.min(1, fx.hintT * 4);
      cellPos(h.to, tmp);
      hintTo.position.set(tmp.x, tmp.y + 0.012, tmp.z);
      hintTo.scale.setScalar(grow * (1 + Math.sin(t * 6) * 0.12));
      finger.position.set(tmp.x, tmp.y + 1.25 + Math.abs(Math.sin(t * 5)) * 0.3, tmp.z + 0.1);
      cellPos(h.from, tmp);
      hintFrom.position.set(tmp.x, tmp.y + 0.014, tmp.z);
      hintFrom.scale.setScalar(grow * (1 + Math.sin(t * 6 + 1.5) * 0.12));
      const squares = [h.from].concat(h.path);
      for (let k = 0; k + 1 < squares.length; k++) ng = arc(squares[k], squares[k + 1], hintArc, ng, 5, h.caps.length ? 0.75 : 0.3, t, grow);
    }
    for (let i = ng; i < hintArc.length; i++) hintArc[i].visible = false;
    dangerMark.visible = !!h && h.danger >= 0;
    if (dangerMark.visible) {
      cellPos(h.danger, tmp);
      dangerMark.position.set(tmp.x - 0.3, tmp.y + 1.2 + Math.abs(Math.sin(t * 7)) * 0.15, tmp.z);
    }
  }

  // ---------------------------------------------------------------- camera

  // Aim the camera down at `elev` radians, from the direction `az` (0: from +z, the bottom of the board), so the
  // world points `pts` fill the screen minus margins { l, r, t, b } in pixels. It fits them in a box of that size in
  // the middle of the picture, then slides the picture (the camera's view offset) over the free part of the screen.
  const right = new T.Vector3(), up = new T.Vector3();
  function fit(pts, elev, az, m) {
    cam.clearViewOffset();
    const dir = new T.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));
    const center = new T.Vector3();
    pts.forEach((p) => center.add(p));
    center.multiplyScalar(1 / pts.length);
    const hw = Math.max(0.1, (W - m.l - m.r) / W), hh = Math.max(0.1, (H - m.t - m.b) / H);
    const box = { x0: -hw, x1: hw, y0: -hh, y1: hh };
    const place = (d) => {
      cam.position.copy(center).addScaledVector(dir, d);
      cam.up.set(0, 1, 0);
      cam.lookAt(center);
      cam.updateMatrixWorld(true);
    };
    const bounds = () => {
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const p of pts) {
        tmp.copy(p).project(cam);
        x0 = Math.min(x0, tmp.x);
        x1 = Math.max(x1, tmp.x);
        y0 = Math.min(y0, tmp.y);
        y1 = Math.max(y1, tmp.y);
      }
      return { x0, x1, y0, y1 };
    };
    for (let iter = 0; iter < 4; iter++) {
      let lo = 2, hi = 300;
      for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        place(mid);
        const b = bounds();
        if (b.x0 >= box.x0 && b.x1 <= box.x1 && b.y0 >= box.y0 && b.y1 <= box.y1) hi = mid;
        else lo = mid;
      }
      place(hi);
      const b = bounds();
      const dx = (b.x0 + b.x1) / 2 - (box.x0 + box.x1) / 2;
      const dy = (b.y0 + b.y1) / 2 - (box.y0 + box.y1) / 2;
      const d = cam.position.distanceTo(center);
      const halfH = d * Math.tan((cam.fov * Math.PI) / 360), halfW = halfH * cam.aspect;
      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
      center.addScaledVector(right, dx * halfW).addScaledVector(up, dy * halfH);
    }
    const bx = (m.l + W - m.r) / 2, by = (m.t + H - m.b) / 2;
    cam.setViewOffset(W, H, W / 2 - bx, H / 2 - by, W, H);
    cam.updateMatrixWorld(true);
    camBase.copy(cam.position);
    return center;
  }

  // The dark square under screen point (x, y), or -1. A tap on a piece (or its crown) picks the piece's square.
  const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -TOP), hit = new T.Vector3();
  function pick(x, y) {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const live = pieces.filter((p) => p.at >= 0 && p.g.visible && !p.anim);
    const objs = [];
    for (const p of live) {
      objs.push(p.disc);
      if (p.king) objs.push(p.crown);
    }
    const hits = ray.intersectObjects(objs, true);
    if (hits.length) {
      const o = hits[0].object;
      const p = live.find((q) => q.disc === o || (q.king && o.parent && o.parent.parent === q.crown));
      if (p) return p.at;
    }
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const c = Math.floor(hit.x / P + 4), r = Math.floor(hit.z / P + 4);
    return R.sq(r, c);
  }
  // one square's size on screen in pixels (the smallest, at the far edge), for the tests
  function squarePx() {
    let min = Infinity;
    const c = new T.Vector3();
    for (const i of [0, 3, 28, 31]) {
      cellPos(i, c);
      const a = toScreen(c.clone().add(new T.Vector3(-P / 2, 0, 0)));
      const b = toScreen(c.clone().add(new T.Vector3(P / 2, 0, 0)));
      const d = toScreen(c.clone().add(new T.Vector3(0, 0, -P / 2)));
      const e = toScreen(c.clone().add(new T.Vector3(0, 0, P / 2)));
      min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y), Math.hypot(d.x - e.x, d.y - e.y));
    }
    return min;
  }
  // the board's outline on screen: { x0, x1, y0, y1 } in pixels
  function boardRect() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const s = toScreen(new T.Vector3(sx * 4 * P, TOP, sz * 4 * P));
      x0 = Math.min(x0, s.x);
      x1 = Math.max(x1, s.x);
      y0 = Math.min(y0, s.y);
      y1 = Math.max(y1, s.y);
    }
    return { x0, x1, y0, y1 };
  }

  function toScreen(v, out = { x: 0, y: 0 }) {
    tmp.copy(v).project(cam);
    out.x = ((tmp.x + 1) / 2) * W;
    out.y = ((1 - tmp.y) / 2) * H;
    return out;
  }

  function render() {
    if (renderer) renderer.render(scene, cam);
  }

  CK.stage = {
    init, useFx, resize, render, update, fit, pick, toScreen, cellPos, pilePos, set, sync, move, select, moves, last, hint, must, cursor, shake,
    layout, spotFor, buddySpot, viewPoints, squarePx, boardRect, scene, cam, HB, TOP, P, PH, COL,
    busy: () => pieces.some((p) => p.anim),
    pieceAt: (i) => bySq[i],
    get W() { return W; },
    get H() { return H; },
    get renderer() { return renderer; },
    get hinted() { return fx.hint; },
    get selected() { return fx.sel; },
    get shown() { return shown; },
    get flip() { return fx.flip; },
    get wide() { return fx.wide; },
  };
})();
