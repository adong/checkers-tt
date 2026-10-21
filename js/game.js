/* TT Checkers: the menu, the game, the HUD, input and the main loop.
   Screens: home (1 or 2 players, who you are, the level, the UNDO and MUST JUMP switches), play, game over, pause,
   and the rules ("How to play", with pictures). In 1 player you're Teddy (blue) or Tommy (orange) against 🦊 Foxy,
   who plays the other colour: 🐣 EASY (the default, for Tommy) or 🔥 NORMAL (for Teddy). Your brother isn't the CPU:
   he's the one you call for help (js/buddy.js). In 2 players Teddy (blue) and Tommy (orange) take turns on one device.
   The camera looks from your end of the board. You start the first game; after that whoever didn't start last time
   does. The score keeps running until you change who plays or the level.
   Foxy's thinking (js/rules.js think) runs a few milliseconds per frame, so the page never freezes.
   window.game is a test hook: see the README. */
(function () {
  'use strict';
  const CK = window.CK;
  const R = CK.rules;
  const ST = CK.stage;
  const S = Kit.sound;
  const { BLUE, ORANGE } = R;
  const $ = (id) => document.getElementById(id);
  const { rand } = Kit.gfx;

  const KEY = 'checkersTT.v1';
  const SCALE = 0.9;       // the boys beside the board
  const FOX_SCALE = 0.72;  // Foxy on her podium
  const THINK_MS = 6;      // how long Foxy may think in one frame

  const prefs = Object.assign({ players: 1, who: 'teddy', levels: { teddy: 'normal', tommy: 'easy' }, undo: true, forced: true }, load());
  const G = {
    state: 'boot', players: 1, level: 'easy', sides: null, kid: BLUE, st: null, history: [], wins: [0, 0], draws: 0,
    starter: BLUE, sel: -1, prefix: [], cursor: -1, cpuT: -1, job: null, waitT: -1, busy: false, turnId: 0, endT: -1,
    panelT: -1, held: false, last: 0, auto: false, autoLevel: 'normal', demo: null, result: null, setupKey: '', az: 0,
    wide: true, rulesFrom: null, forced: true,
  };
  const boys = { teddy: CK.makeActor(), tommy: CK.makeActor() };
  const foxes = [null, null];
  const badges = [];
  let ui = null, flyers = null, bursts = null, spots = null, art = null;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch (e) { /* private mode */ }
  }
  const levelFor = (who) => (prefs.levels && prefs.levels[who]) || (who === 'tommy' ? 'easy' : 'normal');

  // ---------------------------------------------------------------- who's at the board

  const NAMES = { teddy: 'TEDDY', tommy: 'TOMMY', foxy: 'FOXY' };
  const nameOf = (id) => NAMES[id] || id.toUpperCase();
  // sides[colour]: sides[0] plays blue (Teddy's colour), sides[1] orange (Tommy's)
  function makeSides(players, who) {
    if (players === 2) return [{ id: 'teddy', side: BLUE, human: true }, { id: 'tommy', side: ORANGE, human: true }];
    const mine = who === 'tommy' ? ORANGE : BLUE;
    const out = [];
    out[mine] = { id: who, side: mine, human: true };
    out[1 - mine] = { id: 'foxy', side: 1 - mine, human: false };
    return out;
  }
  const current = () => (G.st && G.sides ? G.sides[G.st.turn] : null);
  const kid = () => G.sides[G.kid];

  function foxFor(side) {
    if (!foxes[side]) {
      foxes[side] = CK.makePilot('foxy', '🦊', 'FOXY', ST.COL[side]);
      foxes[side].attach(ST.scene, flyers);
      foxes[side].setScale(FOX_SCALE);
    }
    return foxes[side];
  }

  function setActors() {
    for (const a of [boys.teddy, boys.tommy, foxes[0], foxes[1]]) if (a) a.visible = false;
    G.sides.forEach((s, k) => {
      const a = s.id === 'foxy' ? foxFor(k) : boys[s.id];
      if (s.id !== 'foxy' && (!a.entry || a.entry.id !== s.id)) a.set(s.id, SCALE);
      s.actor = a;
      a.visible = true;
      setBadge(k);
    });
    CK.buddy.setFor(kid().id);
  }

  // the disc that bobs over the head of whoever's turn it is, in his side's colour
  function badgeTexture(side) {
    const [c, g] = Kit.gfx.makeCanvas(128, 128);
    g.fillStyle = ST.COL[side];
    g.beginPath();
    g.arc(64, 64, 54, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = '#14121f';
    g.beginPath();
    g.arc(64, 64, 60, 0, Math.PI * 2);
    g.stroke();
    g.font = `58px ${Kit.gfx.EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('⭐', 64, 68);
    return Kit.gfx.toTexture(c);
  }
  function setBadge(k) {
    if (badges[k]) return;
    badges[k] = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(k), depthTest: false, transparent: true }));
    badges[k].renderOrder = 23;
    badges[k].scale.setScalar(0.55);
    ST.scene.add(badges[k]);
  }

  // ---------------------------------------------------------------- layout

  function layout() {
    ST.resize();
    CK.fx.overlay.resize();
    const W = ST.W, H = ST.H;
    if (W < 2 || H < 2) return;
    const wide = W / H >= 1.15;
    const flip = G.kid === ORANGE;
    G.wide = wide;
    G.az = flip ? Math.PI : 0;
    ST.layout(wide, flip);
    const HB = ST.HB, f = flip ? -1 : 1;
    const me = ST.spotFor(true), them = ST.spotFor(false);
    spots = { sides: [], buddy: ST.buddySpot() };
    spots.sides[G.kid] = me;
    spots.sides[1 - G.kid] = them;
    // the high five (2 players): they meet beside the board on the left, going round its corners on a tall screen
    const mx = -(HB + 1.0) * f;
    spots.meet = [{ x: mx, z: 0.75 * f }, { x: mx, z: -0.75 * f }];
    spots.via = wide ? [null, null] : [{ x: mx, z: (HB + 1.3) * f }, { x: mx, z: -(HB + 1.3) * f }];
    const V = THREE.Vector3;
    const pts = ST.viewPoints();
    const people = [me, them];
    if (G.state !== 'home') people.push(spots.buddy);
    for (const sp of people) pts.push(new V(sp.x - 0.6, 0, sp.z), new V(sp.x + 0.6, 0, sp.z), new V(sp.x, 2 * SCALE + 0.55, sp.z));
    // the kit's round ? and language buttons sit on the left edge (in a game on a tall screen: the bottom left)
    const kitL = 62;
    const m = { l: kitL, r: 14, t: 14, b: 14 };
    if (G.state === 'home') {
      if (wide) m.r = W * 0.54 + 10;
      else {
        m.b = H * 0.6 + 6;
        m.t = 8;
        m.l = 14;
      }
    } else {
      document.documentElement.style.setProperty('--toolsw', `${ui.tools.offsetWidth + 10}px`);
      const top = ui.hudtop.getBoundingClientRect();
      m.t = Math.max(top.bottom, ui.tools.getBoundingClientRect().bottom) + 8;
      const call = ui.callBtn.getBoundingClientRect();
      if (!wide) {
        m.l = 10;
        m.r = 10;
        const kh = document.getElementById('kit-help-btn');
        const kitTop = kh && kh.getBoundingClientRect().height ? kh.getBoundingClientRect().top : H;
        m.b = Math.max(14, H - Math.min(call.top, kitTop) + 6);
      } else m.r = Math.max(14, W - call.left + 6);
    }
    ST.fit(pts, wide ? 0.98 : 1.12, G.az, m);
    // the boys face the camera, turned a little toward the board
    const cp = ST.cam.position;
    G.sides && G.sides.forEach((s, k) => {
      const sp = spots.sides[k];
      const tx = cp.x * 0.6, tz = cp.z * 0.6;
      sp.face = Math.atan2(-(tx - sp.x), -(tz - sp.z));
      s.actor.faceDefault = sp.face;
      if (!CK.highFive.on) s.actor.place(sp.x, 0, sp.z);
    });
    spots.buddy.face = Math.atan2(-(cp.x * 0.6 - spots.buddy.x), -(cp.z * 0.6 - spots.buddy.z));
  }

  // ---------------------------------------------------------------- the game

  function startGame(opts = {}) {
    gesture();
    G.players = opts.players || prefs.players;
    const who = opts.who || prefs.who;
    G.level = opts.level || (G.players === 1 ? levelFor(who) : 'normal');
    Object.assign(prefs, { players: G.players, who });
    if (G.players === 1) prefs.levels = Object.assign({}, prefs.levels, { [who]: G.level });
    if (opts.undo !== undefined) prefs.undo = !!opts.undo;
    if (opts.forced !== undefined) prefs.forced = !!opts.forced;
    G.forced = prefs.forced;
    save();
    const key = `${G.players}:${who}:${G.level}`;
    if (key !== G.setupKey) {
      G.setupKey = key;
      G.wins = [0, 0];
      G.draws = 0;
      G.starter = null;
    }
    G.sides = makeSides(G.players, who);
    G.kid = G.players === 1 ? (who === 'tommy' ? ORANGE : BLUE) : BLUE;
    if (G.starter === null) G.starter = G.kid; // you start the first game
    G.demo = null;
    setActors();
    show(ui.home, false);
    show(ui.hud, true);
    show(ui.tools, true);
    show(ui.callBtn, true);
    show(ui.gameOver, false);
    show(ui.rules, false);
    document.body.dataset.screen = 'play';
    G.state = 'play';
    CK.highFive.cancel();
    setupHud();
    layout();
    S.music('title');
    newGame();
  }

  function newGame() {
    G.st = R.newGame(G.starter, { forced: G.forced });
    G.history = [];
    Object.assign(G, { sel: -1, prefix: [], busy: false, cpuT: -1, job: null, waitT: -1, endT: -1, panelT: -1, result: null });
    ST.set(G.st);
    ST.last(null);
    ST.hint(null);
    ST.must([]);
    ST.select(-1);
    CK.buddy.reset();
    CK.fx.overlay.clear();
    flyers.clear();
    bursts.clear();
    clearToasts();
    G.sides.forEach((s) => {
      s.actor.react('idle');
      s.actor.drop();
    });
    G.state = 'play';
    show(ui.gameOver, false);
    show(ui.pause, false);
    renderScore();
    beginTurn();
  }

  function beginTurn() {
    G.turnId++;
    const s = current();
    const st = G.st;
    ST.must(s.human && !G.auto ? R.mustJump(st) : []);
    if (!s.human) {
      G.job = R.think(st, G.level);
      G.cpuT = rand(0.75, 1.15);
      s.actor.act('think', G.cpuT + 0.2, 0, true);
      CK.sfx.think();
      const p = s.actor.root.position;
      flyers.add('🤔', p.x, 2.4, p.z, 0, 0.3, 0.55, G.cpuT, 0, 0);
    } else {
      G.job = G.auto ? R.think(st, G.autoLevel) : null;
      if (G.auto) G.cpuT = 0.25;
      // 1 player: his button wiggles when one of your pieces can be jumped, or a double jump is waiting
      if (G.players === 1 && !G.auto && !CK.buddy.on) {
        const danger = R.threatened(st.b, st.turn).length > 0;
        const big = R.legal(st).some((m) => m.caps.length >= 2);
        if (danger || big) {
          ui.callBtn.classList.remove('wiggle');
          void ui.callBtn.offsetWidth;
          ui.callBtn.classList.add('wiggle');
          if (danger) CK.sfx.alert();
        }
      }
    }
    updateTurnText();
  }

  const canAct = () => {
    const s = current();
    return G.state === 'play' && s && s.human && !G.auto && !G.busy && G.waitT <= 0 && !G.st.over;
  };

  // the moves of the picked-up piece that start with the hops chosen so far
  function shownMoves() {
    if (G.sel < 0) return [];
    return R.legalFrom(G.st, G.sel).filter((m) => G.prefix.every((q, k) => m.path[k] === q));
  }

  // A tap (or Enter) on square i, for the kid whose turn it is.
  function onSquare(i) {
    if (!canAct()) return false;
    const st = G.st;
    if (i < 0) {
      if (G.sel >= 0) select(-1);
      return false;
    }
    const v = st.b[i];
    if (G.sel >= 0 && G.sel !== i) {
      const opts = shownMoves();
      // the end of a move: play it (if two jumps end here, the one that takes the most)
      const fin = opts.filter((m) => m.to === i).sort((a, b) => b.caps.length - a.caps.length);
      if (fin.length) return doMove(fin[0], true);
      // a square a multi-jump hops through: keep the jumps that go that way
      const via = opts.filter((m) => m.path.indexOf(i, G.prefix.length) >= 0 && m.path.indexOf(i, G.prefix.length) < m.path.length - 1);
      if (via.length) {
        const k = via[0].path.indexOf(i, G.prefix.length);
        G.prefix = via[0].path.slice(0, k + 1);
        const rest = shownMoves();
        if (rest.length === 1) return doMove(rest[0], true);
        ST.moves(G.sel, rest);
        CK.sfx.tick();
        return true;
      }
    }
    if (v && R.sideOf(v) === st.turn) {
      if (G.sel === i) select(-1);
      else select(i);
      return true;
    }
    if (G.sel >= 0) {
      const why = whyNot(st, G.sel, i);
      CK.sfx.nope();
      if (why) toast(why, 'hint');
      select(-1);
      return false;
    }
    if (v) {
      CK.sfx.nope();
      toast(G.players === 1 ? "THAT'S FOXY'S PIECE!" : `IT'S ${nameOf(current().id)}'S TURN!`, 'hint');
    }
    return false;
  }

  function select(i) {
    G.sel = i;
    G.prefix = [];
    ST.select(i);
    if (i < 0) return;
    const st = G.st;
    const list = R.legalFrom(st, i);
    ST.moves(i, list);
    CK.sfx.pick(R.isKing(st.b[i]));
    if (!list.length) toast(R.mustJump(st).length ? 'YOU MUST JUMP!' : "THIS ONE CAN'T MOVE!", 'hint');
  }

  // Why the picked-up piece can't go to square `to`: the rule in a few words (or '' if there's nothing to say).
  function whyNot(st, from, to) {
    const v = st.b[from], s = R.sideOf(v);
    const dr = R.rowOf(to) - R.rowOf(from), dc = R.colOf(to) - R.colOf(from);
    const diag = Math.abs(dr) === Math.abs(dc) && dr !== 0;
    if (!diag || st.b[to]) return '';
    const back = s === BLUE ? dr > 0 : dr < 0;
    if (!R.isKing(v) && back) return 'ONLY KINGS GO BACKWARD!';
    if (st.forced && R.mustJump(st).length) return 'YOU MUST JUMP!';
    if (Math.abs(dr) > 1) return 'ONE STEP AT A TIME!';
    return '';
  }

  function doMove(m, human) {
    const st = G.st;
    G.history.push(R.clone(st));
    const ev = R.play(st, m);
    if (!ev) {
      G.history.pop();
      if (human) CK.sfx.nope();
      return false;
    }
    G.busy = true;
    G.cpuT = -1;
    G.job = null;
    select(-1);
    ST.must([]);
    ST.last(ev);
    if (human) {
      ST.hint(null);
      CK.buddy.moved();
    }
    const mover = G.sides[ev.side], other = G.sides[1 - ev.side];
    if (mover.actor.mode !== 'signature') mover.actor.act('give', 0.45, 0, true);
    ST.move(ev, {
      hop: (k) => {
        if (ev.caps.length) CK.sfx.jump(k);
      },
      bonk: (k) => {
        CK.sfx.bonk();
        if (k === ev.caps.length - 1) {
          setTimeout(() => {
            if (G.state === 'play' || G.state === 'ended') {
              mover.actor.react('cheer');
              other.actor.react('oops');
            }
          }, 120);
        }
        if (k === 1) toast(ev.caps.length >= 3 ? 'TRIPLE JUMP!' : 'DOUBLE JUMP!', 'save');
      },
      crown: () => {
        CK.sfx.crown();
        if (mover.actor.mode !== 'signature') mover.actor.react('cheer');
      },
      land: landed,
    });
    updateTurnText();
    return true;
  }

  // The piece landed (and was crowned): the sound, then the next turn (or the end).
  function landed(ev) {
    if (G.state === 'home' || !G.sides) return;
    if (!ev.caps.length) CK.sfx.step(R.isKing(ev.piece));
    G.busy = false;
    if (G.st.over) G.endT = 0.35;
    else G.waitT = 0.15;
    updateTurnText();
  }

  const WHY = { all: 'NO PIECES LEFT!', stuck: "THEY CAN'T MOVE!", limit: '40 MOVES EACH WITH NO JUMP AND NO NEW KING.' };
  function endGame() {
    const st = G.st, w = st.winner;
    G.result = w;
    if (w >= 0) G.wins[w]++;
    else G.draws++;
    G.starter = 1 - st.starter;
    const win = w >= 0 ? G.sides[w] : null, lose = win ? G.sides[1 - w] : null;
    ST.must([]);
    ST.hint(null);
    if (win) {
      win.actor.react('signature');
      setTimeout(() => lose.actor.react('shrug'), 250);
      const p = ST.cellPos(st.last.to);
      bursts.add(st.reason === 'all' ? 'ALL GONE!' : 'BOXED IN!', p.x, ST.TOP + 1.4, p.z, 2.2, '#ffd400', '#e8372c');
      for (let i = 0; i < 10; i++) flyers.add(i % 2 ? '⭐' : '🎉', p.x, ST.TOP + 0.8, p.z, rand(-2.5, 2.5), rand(2, 4), 0.5, 1.2, rand(-3, 3), 5);
      if (win.human) {
        CK.sfx.win();
        const a = ST.toScreen(p);
        CK.fx.overlay.burst(a.x, a.y, 70, ['⭐', '🎉', w === BLUE ? '💙' : '🧡'], 1.2);
        CK.fx.overlay.rain(90);
      } else CK.sfx.lose();
      bumpScore(w === G.kid ? ui.scoreL : ui.scoreR);
    } else {
      CK.sfx.draw();
      G.sides.forEach((s) => s.actor.react('shrug'));
      for (let i = 0; i < 6; i++) flyers.add('🤝', 0, ST.TOP + 1, 0, rand(-2, 2), rand(2, 3.5), 0.6, 1.2, rand(-2, 2), 4);
    }
    G.state = 'ended';
    G.endT = -1;
    G.panelT = 2.6;
    renderScore();
    updateTurnText();
  }

  function showOverPanel() {
    const st = G.st, w = st.winner;
    const win = w >= 0 ? G.sides[w] : null;
    ui.oFace.innerHTML = win ? `<img alt="" class="${w === ORANGE ? 'o' : ''}" src="${art[win.id]}"><span class="big">🏆</span>` : '<span class="big">🤝</span>';
    ui.oTitle.textContent = win ? `${nameOf(win.id)} WINS!` : 'DRAW!';
    ui.oWhy.textContent = WHY[st.reason] || '';
    renderPanelScore(ui.oScore);
    G.state = 'over';
    show(ui.gameOver, true);
    if (win) {
      win.actor.react('over');
      G.sides[1 - w].actor.react('sulk');
      if (win.human) CK.fx.overlay.rain(120);
    }
    updateUndo();
  }

  function renderPanelScore(el) {
    const a = G.sides[G.kid], b = G.sides[1 - G.kid];
    const img = (s) => `<img alt="" class="${s.side === ORANGE ? 'o' : ''}" src="${art[s.id]}">`;
    el.innerHTML = `${img(a)}<span>${G.wins[a.side]}</span><span class="dash">–</span><span>${G.wins[b.side]}</span>${img(b)}`;
  }

  function again() {
    gesture();
    if (G.state === 'over' || G.state === 'ended') newGame();
  }

  function restartGame() {
    if (!['play', 'paused', 'ended', 'over'].includes(G.state)) return;
    if (G.state === 'paused' && G.pausedFrom !== 'play') G.state = G.pausedFrom;
    show(ui.pause, false);
    if (G.state === 'ended' || G.state === 'over') return newGame(); // the result already counted
    newGame();
    toast('🔄', 'hint');
  }

  // ---------------------------------------------------------------- undo

  function canUndo() {
    if (!prefs.undo || !G.st || G.busy || !G.sides) return false;
    if (!['play', 'ended', 'over'].includes(G.state)) return false;
    if (G.players === 2) return G.history.length > 0;
    return G.history.some((h) => h.turn === G.kid);
  }

  // Take back your last move (and Foxy's answer, in 1 player). Works after the game ended too: the result comes off
  // the score again. In 2 players it takes back one move.
  function undo() {
    if (!canUndo()) {
      if (prefs.undo && G.state === 'play') CK.sfx.nope();
      return false;
    }
    if (G.state === 'ended' || G.state === 'over') {
      if (G.result >= 0) G.wins[G.result]--;
      else if (G.result === -1) G.draws--;
      G.starter = 1 - G.starter;
      G.result = null;
      show(ui.gameOver, false);
      CK.fx.overlay.clear();
      G.sides.forEach((s) => s.actor.react('idle'));
    }
    let snap = G.history.pop();
    if (G.players === 1) while (snap.turn !== G.kid) snap = G.history.pop();
    G.st = snap;
    Object.assign(G, { cpuT: -1, job: null, waitT: 0.5, endT: -1, panelT: -1, state: 'play' });
    select(-1);
    ST.sync(G.st);
    ST.last(G.st.last);
    ST.hint(null);
    ST.must([]);
    CK.buddy.moved();
    CK.sfx.undo();
    toast('↩️', 'hint');
    renderScore();
    updateTurnText();
    return true;
  }

  // ---------------------------------------------------------------- home

  function goHome() {
    G.state = 'home';
    document.body.dataset.screen = 'home';
    show(ui.hud, false);
    show(ui.tools, false);
    show(ui.callBtn, false);
    show(ui.gameOver, false);
    show(ui.pause, false);
    show(ui.rules, false);
    show(ui.home, true);
    CK.buddy.reset();
    CK.highFive.cancel();
    ST.hint(null);
    ST.select(-1);
    ST.cursor(-1);
    ST.must([]);
    clearToasts();
    CK.fx.overlay.clear();
    G.sides = [{ id: 'teddy', side: BLUE, human: false }, { id: 'tommy', side: ORANGE, human: false }];
    G.kid = BLUE;
    G.st = null;
    G.job = null;
    setActors();
    layout();
    G.sides.forEach((s) => s.actor.react('hello'));
    refreshHome();
    demoStart();
    S.music('title');
  }

  // the board plays itself behind the menu: a slow game between the boys
  function demoStart() {
    G.demo = { st: R.newGame(Math.random() < 0.5 ? BLUE : ORANGE), t: 1.4, end: -1, busy: false, job: null };
    ST.set(G.demo.st);
    ST.last(null);
  }
  function demoUpdate(dt) {
    const d = G.demo;
    if (!d) return;
    if (d.end >= 0) {
      d.end -= dt;
      if (d.end < 0) demoStart();
      return;
    }
    if (d.busy) return;
    if (!d.job) d.job = R.think(d.st, Math.random() < 0.6 ? 'easy' : 'normal', Math.random, { nodes: 2000, minDepth: 4 });
    d.job.step(THINK_MS);
    d.t -= dt;
    if (d.t > 0 || !d.job.done) return;
    const st = d.st;
    const m = d.job.move;
    d.job = null;
    const ev = m && R.play(st, m);
    if (!ev) return demoStart();
    d.busy = true;
    ST.last(ev);
    G.sides[ev.side].actor.act('give', 0.45, 0, true);
    ST.move(ev, {
      bonk: () => {
        if (G.state === 'home' && G.demo === d) {
          G.sides[ev.side].actor.react('cheer');
          G.sides[1 - ev.side].actor.react('oops');
        }
      },
      land: () => {
        if (G.state !== 'home' || G.demo !== d) return;
        d.busy = false;
        d.t = 1.0;
        if (st.over || st.ply >= 120) {
          d.end = 3.2;
          if (st.winner >= 0) {
            G.sides[st.winner].actor.react('signature');
            G.sides[1 - st.winner].actor.react('shrug');
          }
        }
      },
    });
  }

  function refreshHome() {
    const seg = (el, v) => {
      for (const b of el.children) {
        const on = b.dataset.v === String(v);
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on);
        b.setAttribute('role', 'radio');
      }
    };
    seg(ui.segPlayers, prefs.players);
    seg(ui.segWho, prefs.who);
    seg(ui.segLevel, levelFor(prefs.who));
    for (const b of ui.segSwitches.children) {
      const on = !!prefs[b.dataset.v];
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on);
    }
    ui.segWho.style.display = ui.segLevel.style.display = prefs.players === 1 ? '' : 'none';
    ui.duo.style.display = prefs.players === 2 ? '' : 'none';
  }

  function setPref(k, v) {
    gesture();
    if (k === 'level') prefs.levels = Object.assign({}, prefs.levels, { [prefs.who]: v });
    else if (k === 'undo' || k === 'forced') prefs[k] = v;
    else prefs[k] = v;
    save();
    refreshHome();
    CK.sfx.kit('click');
    if (k === 'who' && G.state === 'home') {
      const s = G.sides && G.sides.find((x) => x.id === v);
      if (s) s.actor.react('hello');
    }
  }

  // ---------------------------------------------------------------- the rules screen

  // the little boards in the rules: data-b rows split by '/', one character a square (see index.html)
  function buildMiniBoards() {
    for (const el of document.querySelectorAll('.mb[data-b]')) {
      const rows = el.dataset.b.split('/');
      el.style.gridTemplateColumns = `repeat(${rows[0].length}, 1.25em)`;
      let html = '';
      for (const row of rows) {
        for (const ch of row) {
          let inner = '';
          if (ch === 'b') inner = '<b class="pc"></b>';
          else if (ch === 'o') inner = '<b class="pc o"></b>';
          else if (ch === 'B') inner = '<b class="pc k"></b>';
          else if (ch === 'O') inner = '<b class="pc o k"></b>';
          else if (ch === 'g') inner = '<b class="pc glow"></b>';
          else if (ch === 'x') inner = '<b class="pc hit"></b>';
          else if (ch === 'y') inner = '<b class="pc o hit"></b>';
          else if (ch === '*') inner = '<b class="dot"></b>';
          else if (ch === '1' || ch === '2' || ch === '3') inner = `<b class="dot n">${ch}</b>`;
          html += `<i class="${ch === '.' ? 'l' : 'd'}">${inner}</i>`;
        }
      }
      el.innerHTML = html;
    }
  }

  function openRules() {
    gesture();
    if (G.state === 'rules') return;
    G.rulesFrom = G.state;
    if (G.state === 'paused') show(ui.pause, false);
    G.state = 'rules';
    show(ui.rules, true);
    ui.rules.querySelector('.panel').scrollTop = 0;
    CK.sfx.kit('click');
  }
  function closeRules() {
    if (G.state !== 'rules') return;
    show(ui.rules, false);
    G.state = G.rulesFrom || 'home';
    if (G.state === 'paused') show(ui.pause, true);
    G.rulesFrom = null;
    CK.sfx.kit('click');
  }

  // ---------------------------------------------------------------- HUD

  function setupHud() {
    const a = G.sides[G.kid], b = G.sides[1 - G.kid];
    ui.faceL.src = art[a.id];
    ui.faceR.src = art[b.id];
    ui.faceL.className = a.side === ORANGE ? 'o' : '';
    ui.faceR.className = b.side === ORANGE ? 'o' : '';
    if (G.players === 1) {
      const bud = CK.buddy.entry;
      ui.callBtn.innerHTML = `<img alt="" src="${art[bud.id]}"><kbd>T</kbd>`;
      const nice = bud.name[0] + bud.name.slice(1).toLowerCase();
      ui.callBtn.title = `Call ${nice} (T)`;
      ui.callBtn.setAttribute('aria-label', `Call ${nice}`);
    } else {
      ui.callBtn.innerHTML = '🙌<kbd>T</kbd>';
      ui.callBtn.title = 'High five! (T)';
      ui.callBtn.setAttribute('aria-label', 'High five!');
    }
    ui.undoBtn.classList.toggle('off', !prefs.undo);
  }

  function renderScore() {
    ui.scoreL.textContent = G.wins[G.kid];
    ui.scoreR.textContent = G.wins[1 - G.kid];
    updateUndo();
  }
  function bumpScore(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
  function updateUndo() {
    if (!ui) return;
    ui.undoBtn.disabled = !canUndo();
  }

  const cache = {};
  function setText(el, key, v) {
    if (cache[key] !== v) {
      cache[key] = v;
      el.textContent = v;
    }
  }

  function updateTurnText() {
    if (!G.st || !ui) return;
    const s = current();
    const st = G.st;
    let text = '', mine = false;
    if (G.state === 'ended' || G.state === 'over' || st.over) text = st.winner >= 0 ? `${nameOf(G.sides[st.winner].id)} WINS!` : 'DRAW!';
    else if (!s.human) text = `${nameOf(s.id)} IS THINKING…`;
    else {
      mine = true;
      const jump = !G.busy && st.forced && R.mustJump(st).length > 0;
      if (G.players === 1) text = jump ? 'YOUR TURN: JUMP!' : 'YOUR TURN!';
      else text = jump ? `${nameOf(s.id)}: JUMP!` : `${nameOf(s.id)}'S TURN!`;
    }
    setText(ui.turn, 'turn', text);
    ui.turn.classList.toggle('mine', mine);
    ui.sideL.classList.toggle('now', !st.over && st.turn === G.kid);
    ui.sideR.classList.toggle('now', !st.over && st.turn !== G.kid);
    const left = st.limit - st.quiet;
    show(ui.drawCount, !st.over && left <= 20);
    if (left <= 20) setText(ui.drawCount, 'left', left === 1 ? 'DRAW IN 1 MOVE' : `DRAW IN ${left} MOVES`);
    updateUndo();
  }

  function toast(text, cls) {
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    ui.toasts.appendChild(el);
    setTimeout(() => el.remove(), /save/.test(cls || '') ? 2850 : 1950);
    while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
  }
  function clearToasts() {
    if (ui) ui.toasts.innerHTML = '';
  }

  function show(el, on) {
    el.classList.toggle('hidden', !on);
  }

  // ---------------------------------------------------------------- your brother and the high five

  function call() {
    gesture();
    if (!G.sides || !['play', 'ended', 'over'].includes(G.state)) return 'none';
    if (G.players === 2) return CK.highFive.start();
    ui.callBtn.classList.remove('wiggle');
    return CK.buddy.call();
  }

  const buddyApi = {
    toast: (t, c) => toast(t, c),
    player: () => kid().actor,
    spot: () => spots.buddy,
    scale: () => SCALE,
    turnId: () => G.turnId,
    canHint: () => G.state === 'play' && G.st && !G.st.over && current() === kid() && !G.busy && G.waitT <= 0,
    roundOver: () => G.state !== 'play' || (G.st && G.st.over),
    showHint() {
      const h = R.hint(G.st);
      if (!h) return null;
      select(-1);
      ST.hint(h);
      return h;
    },
    clearHint: () => ST.hint(null),
    players: () => [G.sides[0].actor, G.sides[1].actor],
    meet: () => spots.meet,
    via: () => spots.via,
    homes: () => spots.sides,
    get flyers() { return flyers; },
  };

  // ---------------------------------------------------------------- input

  let audioReady = false;
  function gesture() {
    if (!audioReady) {
      audioReady = true;
      S.init();
      S.music('title');
    } else S.init();
  }

  // the arrow keys move the cursor the way they point on the screen, whichever end the camera looks from. The dark
  // squares are diagonal neighbours: left / right go to the next dark square in the row, up / down to the row above
  // or below, keeping as close as they can to the column you were heading for.
  function moveCursor(sx, sy) {
    if (G.state !== 'play') return;
    const flip = G.az > 1 ? -1 : 1;
    if (G.cursor < 0) {
      const must = R.mustJump(G.st);
      G.cursor = G.sel >= 0 ? G.sel : must.length ? must[0] : G.kid === BLUE ? R.sq(5, 2) : R.sq(2, 5);
      G.curX = R.colOf(G.cursor);
    } else {
      let r = R.rowOf(G.cursor), c = R.colOf(G.cursor);
      if (G.curX === undefined) G.curX = c;
      if (sx) {
        const nc = c + 2 * sx * flip;
        if (nc >= 0 && nc <= 7) c = nc;
        G.curX = c;
      } else {
        const nr = r - sy * flip;
        if (nr >= 0 && nr <= 7) {
          r = nr;
          const opts = [c - 1, c + 1].filter((x) => x >= 0 && x <= 7);
          opts.sort((a, b) => Math.abs(a - G.curX) - Math.abs(b - G.curX) || Math.abs(a - 3.5) - Math.abs(b - 3.5));
          c = opts[0];
        }
      }
      G.cursor = R.sq(r, c);
    }
    CK.sfx.tick();
  }

  function bindInput() {
    ui.canvas.addEventListener('pointerdown', (e) => {
      gesture();
      if (G.state !== 'play') return;
      const i = ST.pick(e.clientX, e.clientY);
      G.cursor = -1;
      onSquare(i);
    });
    ui.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      let on = false;
      if (canAct()) {
        const i = ST.pick(e.clientX, e.clientY);
        on = i >= 0 && ((G.st.b[i] && R.sideOf(G.st.b[i]) === G.st.turn) || shownMoves().some((m) => m.path.includes(i)));
      }
      ui.canvas.style.cursor = on ? 'pointer' : '';
    });
    const tap = (el, fn) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      gesture();
      fn();
    });
    tap(ui.goPlay, () => startGame({}));
    tap(ui.goRules, openRules);
    for (const b of ui.segPlayers.children) tap(b, () => setPref('players', +b.dataset.v));
    for (const b of ui.segWho.children) tap(b, () => setPref('who', b.dataset.v));
    for (const b of ui.segLevel.children) tap(b, () => setPref('level', b.dataset.v));
    for (const b of ui.segSwitches.children) tap(b, () => setPref(b.dataset.v, !prefs[b.dataset.v]));
    ui.callBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      call();
    });
    tap(ui.pauseBtn, () => pause(true));
    tap(ui.undoBtn, undo);
    tap(ui.rulesBtn, openRules);
    tap(ui.rulesOk, closeRules);
    tap(ui.pResume, () => pause(false));
    tap(ui.pRestart, restartGame);
    tap(ui.pRules, openRules);
    tap(ui.pHome, goHome);
    tap(ui.oAgain, again);
    tap(ui.oHome, goHome);
    tap(ui.muteBtn, toggleMute);
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      gesture();
      const k = e.key.toLowerCase();
      if (k === 'm') return toggleMute();
      if (G.state === 'rules') {
        if (k === 'escape' || k === 'enter' || k === ' ' || k === 'h') closeRules();
        return;
      }
      if (G.state === 'home') {
        if (k === 'enter' || k === ' ') startGame({});
        else if (k === 'h') openRules();
        else if (k === 'arrowleft' || k === 'arrowright') setPref('who', prefs.who === 'teddy' ? 'tommy' : 'teddy');
        else if (k === 'arrowup' || k === 'arrowdown') setPref('players', prefs.players === 1 ? 2 : 1);
        else if (k === 'l') setPref('level', levelFor(prefs.who) === 'easy' ? 'normal' : 'easy');
        else if (k === 'u') setPref('undo', !prefs.undo);
        else if (k === 'j') setPref('forced', !prefs.forced);
        if (k.startsWith('arrow') || k === ' ') e.preventDefault();
        return;
      }
      if (k === 't') return call();
      if (k === 'h') return openRules();
      if (k === 'u' || k === 'backspace') {
        e.preventDefault();
        return undo();
      }
      if (G.state === 'paused') {
        if (k === 'escape' || k === 'p' || k === 'enter' || k === ' ') pause(false);
        else if (k === 'r') restartGame();
        return;
      }
      if (G.state === 'over' || G.state === 'ended') {
        if ((k === 'enter' || k === ' ') && G.state === 'over') again();
        else if (k === 'escape') goHome();
        else if (k === 'r') again();
        return;
      }
      if (k === 'p') return pause(true);
      if (k === 'escape') {
        if (G.sel >= 0) return select(-1);
        return pause(true);
      }
      if (k === 'r') return restartGame();
      if (G.state !== 'play') return;
      if (k === 'arrowleft') moveCursor(-1, 0);
      else if (k === 'arrowright') moveCursor(1, 0);
      else if (k === 'arrowup') moveCursor(0, 1);
      else if (k === 'arrowdown') moveCursor(0, -1);
      else if ((k === 'enter' || k === ' ') && G.cursor >= 0) onSquare(G.cursor);
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    });
    addEventListener('resize', layout);
    document.addEventListener('visibilitychange', () => (document.hidden ? S.suspend() : S.resume()));
  }

  function pause(on) {
    if (on && (G.state === 'play' || G.state === 'ended' || G.state === 'over')) {
      G.pausedFrom = G.state;
      G.state = 'paused';
      show(ui.pause, true);
      S.music('pause');
    } else if (!on && G.state === 'paused') {
      G.state = G.pausedFrom || 'play';
      show(ui.pause, false);
      S.music('title');
    }
  }

  function toggleMute() {
    const muted = S.toggleMute();
    ui.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  // ---------------------------------------------------------------- the loop

  const tmp = new THREE.Vector3();
  function step(dt) {
    dt = Math.min(dt, 0.1);
    // the window can start at 0 x 0 (a hidden tab) and resize without an event reaching us: re-fit when it changes
    if ((innerWidth || 1) !== ST.W || (innerHeight || 1) !== ST.H) layout();
    const running = !['paused', 'boot', 'rules'].includes(G.state);
    if (running) {
      if (G.state === 'home') demoUpdate(dt);
      if (G.state === 'play') {
        // Foxy (or the test bot) thinks a few milliseconds a frame
        if (G.job && !G.job.done && !G.busy) G.job.step(THINK_MS);
        if (G.waitT > 0) {
          G.waitT -= dt;
          if (G.waitT <= 0 && !G.st.over && !G.busy) beginTurn();
        } else if (G.cpuT > 0 && !G.busy) {
          G.cpuT = Math.max(0.001, G.cpuT - dt);
          if (G.cpuT <= 0.001 && G.job && G.job.done) {
            G.cpuT = -1;
            const s = current();
            if (G.job.move) doMove(G.job.move, s.human);
          }
        }
        if (G.endT > 0) {
          G.endT -= dt;
          if (G.endT <= 0) endGame();
        }
      }
      if (G.state === 'ended' && G.panelT > 0) {
        G.panelT -= dt;
        if (G.panelT <= 0) showOverPanel();
      }
      ST.update(dt);
      flyers.update(dt);
      bursts.update(dt);
      if (G.sides) G.sides.forEach((s) => s.actor.update(dt));
      CK.buddy.update(dt);
      CK.highFive.update(dt);
    }
    // the star over whoever is to move
    const st = G.state === 'home' ? G.demo && G.demo.st : G.st;
    if (G.sides) {
      G.sides.forEach((s, k) => {
        const on = st && !st.over && st.turn === k && G.state !== 'home';
        const bdg = badges[k];
        bdg.visible = !!on;
        if (on) {
          s.actor.root.getWorldPosition(tmp);
          const top = s.id === 'foxy' ? 2.45 : 2 * SCALE + 0.45;
          bdg.position.set(tmp.x, top + Math.abs(Math.sin(performance.now() / 260)) * 0.16, tmp.z);
        }
      });
    }
    ST.cursor(G.state === 'play' ? G.cursor : -1);
    CK.fx.overlay.update(dt);
    ui.callBtn.classList.toggle('here', CK.buddy.on || CK.highFive.on);
    ST.render();
  }

  function frame(now) {
    const dt = G.last ? (now - G.last) / 1000 : 0.016;
    G.last = now;
    if (!G.held) step(dt);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot

  // Foxy's face for the menus and the score: the 🦊 on a round tile (the boys' come from Kit.portraits)
  function emojiFace(emoji) {
    const [c, g] = Kit.gfx.makeCanvas(160, 160);
    g.font = `112px ${Kit.gfx.EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, 80, 90);
    return c.toDataURL('image/png');
  }

  function boot() {
    ui = {
      canvas: $('game'), home: $('home'), hud: $('hud'), hudtop: document.querySelector('.hudtop'), logo: $('logo'), tools: $('tools'),
      goPlay: $('goPlay'), goRules: $('goRules'), segPlayers: $('segPlayers'), segWho: $('segWho'), segLevel: $('segLevel'), segSwitches: $('segSwitches'),
      duo: $('duo'), duoA: $('duoA'), duoB: $('duoB'), pauseBtn: $('pauseBtn'), muteBtn: $('muteBtn'), sideL: $('sideL'),
      sideR: $('sideR'), faceL: $('faceL'), faceR: $('faceR'), scoreL: $('scoreL'), scoreR: $('scoreR'), turn: $('turn'),
      drawCount: $('drawCount'), undoBtn: $('undoBtn'), rulesBtn: $('rulesBtn'), callBtn: $('callBtn'), toasts: $('toasts'),
      gameOver: $('gameOver'), oFace: $('oFace'), oTitle: $('oTitle'), oWhy: $('oWhy'), oScore: $('oScore'), oAgain: $('oAgain'),
      oHome: $('oHome'), pause: $('pause'), pResume: $('pResume'), pRestart: $('pRestart'), pRules: $('pRules'), pHome: $('pHome'),
      rules: $('rules'), rulesOk: $('rulesOk'),
    };
    // the logo: the first word small on top, the rest big ("TT" / "Checkers"); a one-word name is all big
    const words = window.CK_TITLE.split(' ');
    ui.logo.querySelector('small').textContent = words.length > 1 ? words[0] : '';
    ui.logo.querySelector('big').textContent = words.length > 1 ? words.slice(1).join(' ') : words[0];
    ui.muteBtn.textContent = S.isMuted() ? '🔇' : '🔊';
    buildMiniBoards();
    ST.init(ui.canvas);
    CK.fx.overlay.init($('fx'));
    flyers = CK.fx.flyers(ST.scene, 80);
    bursts = CK.fx.bursts(ST.scene, 6);
    ST.useFx(flyers, bursts);
    for (const a of [boys.teddy, boys.tommy]) a.attach(ST.scene, flyers);
    art = Kit.portraits(['teddy', 'tommy'].map((id) => Kit.roster.get(id)), { size: 160 });
    art.foxy = emojiFace('🦊');
    ui.segWho.children[0].querySelector('img').src = art.teddy;
    ui.segWho.children[1].querySelector('img').src = art.tommy;
    ui.duoA.src = art.teddy;
    ui.duoB.src = art.tommy;
    CK.buddy.init(buddyApi);
    bindInput();
    goHome();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- test hook

  const sq = (r, c) => R.sq(r, c);
  window.game = {
    // advance `secs` of game time in 1/60 s steps, rendering once at the end (works while the pane is hidden)
    step(secs = 0.1) {
      const n = Math.max(1, Math.round(secs * 60));
      for (let i = 0; i < n; i++) step(1 / 60);
      return game.info();
    },
    hold(on = true) { G.held = on; },
    // start({ players: 1 | 2, who: 'teddy' | 'tommy', level: 'easy' | 'normal', undo: true | false, forced: true | false })
    start(opts = {}) {
      startGame(opts);
      return game.info();
    },
    home: () => goHome(),
    tap: (i) => onSquare(i),                     // tap square i (0..31) for the kid whose turn it is
    tapRC: (r, c) => onSquare(sq(r, c)),         // tap the square at row r, column c (row 0 is the top)
    move: (from, to) => (canAct() ? (R.find(G.st, { from, to }) ? doMove(R.find(G.st, { from, to }), true) : false) : false),
    key: (k) => dispatchEvent(new KeyboardEvent('keydown', { key: k })),
    call: () => call(),
    undo: () => undo(),
    pause: (on = true) => pause(on),
    rules: (on = true) => (on ? openRules() : closeRules()),
    again: () => again(),
    restart: () => restartGame(),
    // let a test bot play the kid's side too ('normal', 'easy' or 'random')
    auto(on = true, level = 'normal') {
      G.auto = on;
      G.autoLevel = level;
      if (on && G.state === 'play' && current() && current().human && G.cpuT < 0 && G.waitT <= 0 && !G.busy) {
        G.job = R.think(G.st, level);
        G.cpuT = 0.25;
        ST.must([]);
      }
    },
    // set up a board (for screenshots and tests): pieces [[piece, row, col], ...] (piece 1 blue man, 2 blue king,
    // 3 orange man, 4 orange king), whose turn it is
    setup(list, turn = G.st.turn) {
      const st = R.newGame(turn, { forced: G.forced });
      st.b.fill(0);
      for (const [v, r, c] of list) st.b[sq(r, c)] = v;
      G.st = st;
      G.history = [];
      Object.assign(G, { sel: -1, prefix: [], busy: false, cpuT: -1, job: null, waitT: -1, endT: -1, panelT: -1, state: 'play' });
      ST.set(st);
      ST.last(null);
      ST.hint(null);
      show(ui.gameOver, false);
      beginTurn();
      return game.info();
    },
    check: (opts = {}) => CK.check(Object.assign({ games: 2 }, opts)),
    checkRules: () => CK.checkRules(),
    rates: (n) => CK.rates(n),
    perft: (d) => R.perft(R.startBoard(), BLUE, d),
    info() {
      const st = G.st;
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return r.width ? { x0: Math.round(r.left), y0: Math.round(r.top), x1: Math.round(r.right), y1: Math.round(r.bottom) } : null;
      };
      const br = ST.boardRect();
      return {
        state: G.state, players: G.players, level: G.level, kid: G.kid, forced: G.forced, wide: G.wide,
        sides: G.sides && G.sides.map((s) => ({ id: s.id, side: s.side, human: s.human, pose: s.actor && s.actor.pose })),
        turn: st && st.turn, ply: st && st.ply, quiet: st && st.quiet, over: st && st.over, winner: st && st.winner, reason: st && st.reason,
        pieces: st ? [R.count(st.b, BLUE), R.count(st.b, ORANGE)] : null, kings: st ? [...st.b].filter((v) => R.isKing(v)).length : 0,
        board: st ? [...st.b].join('') : null, wins: G.wins.slice(), draws: G.draws, sel: G.sel, prefix: G.prefix.slice(),
        shown: ST.shown.length, must: st ? R.mustJump(st) : [], busy: G.busy, history: G.history.length, canUndo: canUndo(),
        thinking: !!(G.job && !G.job.done), depth: G.job ? G.job.depth : null,
        buddy: CK.buddy.info(), hint: ST.hinted ? { from: ST.hinted.from, to: ST.hinted.to, kind: ST.hinted.kind, path: ST.hinted.path } : null,
        panel: !ui.gameOver.classList.contains('hidden') ? 'over' : null, rules: !ui.rules.classList.contains('hidden'), undoOn: prefs.undo,
        squarePx: Math.round(ST.squarePx()), boardRect: { x0: Math.round(br.x0), x1: Math.round(br.x1), y0: Math.round(br.y0), y1: Math.round(br.y1) },
        kitButtons: [rect(document.getElementById('kit-help-btn')), rect(document.getElementById('kit-lang-btn')), rect(document.getElementById('kit-sound-btn'))],
      };
    },
    get G() { return G; },
    get R() { return R; },
  };

  let booted = false;
  const go = () => {
    if (booted) return;
    booted = true;
    boot();
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go);
  setTimeout(go, 1500);
})();
