/* TT Checkers: the headless checks (game.check() in the page, node tools/check.js in a terminal).
     1. the rules: move counts from the start position (perft, depths 1 – 6 = 7, 49, 302, 1469, 7361, 36768), then
        little boards set up for each rule: men forward only, kings both ways, compulsory jumps (and the MUST JUMP
        switch off), multi-jumps (no stopping half way, two ways to go), crowning ends the move, winning (no pieces,
        no moves), the draw rule (and what resets it), plus your brother's tip on a few boards
     2. CPU games: both levels and the test bots against each other. Every move is checked legal, every game must
        end, and 🔥 NORMAL must beat 🐣 EASY most of the time
   check({ sabotage }) breaks one rule (or the NORMAL CPU) first, to prove the checks can fail:
     noforce (jumps never compulsory), nomulti (a jump stops after one piece), nocrownstop (a man crowned in a jump
     keeps jumping), backward (men may step backward), nodraw (no draw rule), blind (NORMAL plays at random). */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = (root.CK = root.CK || {});
  const R = CK.rules;
  const { BLUE: B, ORANGE: O, BM, BK, OM, OK, sq } = R;
  const PERFT = [7, 49, 302, 1469, 7361, 36768];

  // a seeded random, so a run can be repeated
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // a board with just these pieces: [piece, row, col]
  function setup(list, turn = B, forced = true) {
    const st = R.newGame(turn, { forced });
    st.b.fill(0);
    for (const [v, r, c] of list) st.b[sq(r, c)] = v;
    return st;
  }
  const movesFrom = (st, r, c) => R.legalFrom(st, sq(r, c));
  const ends = (ms) => ms.map((m) => R.rowOf(m.to) + ',' + R.colOf(m.to)).sort().join(' ');

  // ---------------------------------------------------------------- 1. the rules

  function rules() {
    const out = [];
    const t = (name, ok) => out.push({ name, ok: !!ok });

    // the board and the start
    let dark = true;
    for (let i = 0; i < R.N; i++) dark = dark && (R.rowOf(i) + R.colOf(i)) % 2 === 1 && sq(R.rowOf(i), R.colOf(i)) === i;
    t('board: 32 dark squares, (row + col) odd, numbered row by row', dark);
    const s0 = R.newGame(B);
    t('start: 12 each, orange on rows 0 – 2, blue on rows 5 – 7', R.count(s0.b, B) === 12 && R.count(s0.b, O) === 12 &&
      [...s0.b].every((v, i) => (R.rowOf(i) <= 2 ? v === OM : R.rowOf(i) >= 5 ? v === BM : v === 0)));
    const counts = PERFT.map((_, d) => R.perft(R.startBoard(), B, d + 1));
    t(`perft from the start, depths 1 – 6: ${counts.join(', ')} (known: ${PERFT.join(', ')})`, counts.join() === PERFT.join());
    const countsO = PERFT.slice(0, 5).map((_, d) => R.perft(R.startBoard(), O, d + 1));
    t('perft with orange first is the same (the board is symmetric)', countsO.join() === PERFT.slice(0, 5).join());

    // men and kings
    t('a man steps diagonally forward only (2 squares)', ends(movesFrom(setup([[BM, 4, 3]]), 4, 3)) === '3,2 3,4');
    t('an orange man steps down the board', ends(movesFrom(setup([[OM, 3, 4]], O), 3, 4)) === '4,3 4,5');
    t('a king steps all 4 ways', ends(movesFrom(setup([[BK, 4, 3]]), 4, 3)) === '3,2 3,4 5,2 5,4');
    t('an orange king steps all 4 ways', ends(movesFrom(setup([[OK, 3, 4]], O), 3, 4)) === '2,3 2,5 4,3 4,5');
    t("a man on the board's edge has 1 step", ends(movesFrom(setup([[BM, 5, 0]]), 5, 0)) === '4,1');
    t("a man can't step onto a piece", movesFrom(setup([[BM, 4, 3], [BM, 3, 2], [BM, 3, 4]]), 4, 3).length === 0);

    // jumps
    const j1 = setup([[BM, 5, 2], [OM, 4, 3], [BM, 7, 6]]);
    const j1m = R.legal(j1);
    t('jumps are compulsory: the only legal move is the jump', j1m.length === 1 && j1m[0].caps.length === 1 && j1m[0].caps[0] === sq(4, 3) && j1m[0].to === sq(3, 4));
    const j1off = setup([[BM, 5, 2], [OM, 4, 3], [BM, 7, 6]], B, false);
    const j1offm = R.legal(j1off);
    t('MUST JUMP off: stepping instead of jumping is allowed too', j1offm.length > 1 && j1offm.some((m) => m.caps.length) && j1offm.some((m) => !m.caps.length && m.from === sq(7, 6)));
    t('the jumped piece comes off the board', (() => {
      const st = setup([[BM, 5, 2], [OM, 4, 3], [OM, 0, 1]]);
      const ev = R.play(st, { from: sq(5, 2), to: sq(3, 4) });
      return ev && st.b[sq(4, 3)] === 0 && st.b[sq(3, 4)] === BM && st.b[sq(5, 2)] === 0 && ev.caps[0] === sq(4, 3);
    })());
    t("a man can't jump backward", movesFrom(setup([[BM, 3, 2], [OM, 4, 3]]), 3, 2).every((m) => !m.caps.length));
    t('a king jumps backward', movesFrom(setup([[BK, 3, 2], [OM, 4, 3]]), 3, 2).some((m) => m.caps[0] === sq(4, 3) && m.to === sq(5, 4)));
    t("you can't jump your own piece", movesFrom(setup([[BM, 5, 2], [BM, 4, 3]]), 5, 2).every((m) => !m.caps.length));
    t("you can't jump onto a piece", movesFrom(setup([[BM, 5, 2], [OM, 4, 3], [OM, 3, 4]]), 5, 2).every((m) => !m.caps.length));
    t('the mustJump glow lists exactly the pieces that can jump', (() => {
      const st = setup([[BM, 5, 2], [BM, 5, 6], [OM, 4, 3], [BM, 7, 0]]);
      return R.mustJump(st).sort().join() === [sq(5, 2)].join() && R.mustJump(setup([[BM, 5, 2]])).length === 0;
    })());

    // multi-jumps
    const dj = setup([[BM, 6, 1], [OM, 5, 2], [OM, 3, 4], [OM, 0, 7]]);
    const djm = R.legal(dj);
    t('a double jump is one move: 2 pieces, landing on (4,3) then (2,5)',
      djm.length === 1 && djm[0].caps.length === 2 && djm[0].path.join() === [sq(4, 3), sq(2, 5)].join());
    t("you can't stop half way through a multi-jump", !R.isLegal(dj, { from: sq(6, 1), to: sq(4, 3) }));
    const tj = setup([[BM, 7, 0], [OM, 6, 1], [OM, 4, 3], [OM, 2, 3], [OM, 0, 7]]);
    const tjm = R.legal(tj);
    t('a triple jump zig-zags: 3 pieces in one move', tjm.length === 1 && tjm[0].caps.length === 3 && tjm[0].to === sq(1, 2));
    const br = setup([[BM, 6, 3], [OM, 5, 2], [OM, 5, 4], [OM, 3, 2], [OM, 3, 6], [OM, 0, 1]]);
    const brm = R.legal(br);
    t('two ways to go: both double jumps are legal', brm.length === 2 && brm.every((m) => m.caps.length === 2) && ends(brm) === '2,3 2,7');
    t('a king can jump round in a ring and land on the square it started from', (() => {
      const st = setup([[BK, 6, 3], [OM, 5, 2], [OM, 3, 2], [OM, 3, 4], [OM, 5, 4], [OM, 0, 7]]);
      return R.legal(st).some((m) => m.caps.length === 4 && m.to === sq(6, 3));
    })());
    t('the jumping piece can still jump a different way after a turn (L-shaped double jump)', (() => {
      const st = setup([[BM, 6, 1], [OM, 5, 2], [OM, 3, 2], [OM, 0, 7]]);
      const m = R.legal(st);
      return m.length === 1 && m[0].caps.length === 2 && m[0].to === sq(2, 1);
    })());

    // crowning
    const cr = setup([[BM, 1, 2], [OM, 0, 7]]);
    const crev = R.play(cr, { from: sq(1, 2), to: sq(0, 1) });
    t('a man reaching the far row is crowned', crev && crev.crown && cr.b[sq(0, 1)] === BK);
    const oc = setup([[OM, 6, 5], [BM, 7, 0]], O);
    const ocev = R.play(oc, { from: sq(6, 5), to: sq(7, 4) });
    t('an orange man is crowned on the bottom row', ocev && ocev.crown && oc.b[sq(7, 4)] === OK);
    // the man jumps (1,4) into the far row at (0,3); as a king he could go on over (1,2) to (2,1), but the move ends
    const ce = setup([[BM, 2, 5], [OM, 1, 4], [OM, 1, 2], [OM, 3, 6]]);
    const cem = R.legalFrom(ce, sq(2, 5));
    t('crowning ends the move: the new king stops on the far row', cem.length === 1 && cem[0].caps.length === 1 && cem[0].crown && cem[0].to === sq(0, 3));
    const ceev = R.play(ce, cem[0] || { from: -1, to: -1 });
    t("... and it's the other side's turn, the piece he could have jumped still there", ceev && ce.turn === O && ce.b[sq(1, 2)] === OM && ce.b[sq(0, 3)] === BK);
    const kj = setup([[BK, 2, 5], [OM, 1, 4], [OM, 1, 2], [OM, 3, 6]]);
    t('a king already crowned keeps jumping through the far row', R.legalFrom(kj, sq(2, 5)).some((m) => m.caps.length === 2 && m.to === sq(2, 1)));

    // winning
    const w1 = setup([[BM, 5, 2], [OM, 4, 3]]);
    R.play(w1, { from: sq(5, 2), to: sq(3, 4) });
    t('jumping the last piece wins', w1.over && w1.winner === B && w1.reason === 'all');
    // orange (6,1) is boxed in: both squares in front are blue, and (5,0) and (5,2) stop blue jumping him
    const w2 = setup([[OM, 6, 1], [BM, 7, 0], [BM, 7, 2], [BM, 5, 0], [BM, 5, 2], [BM, 5, 4]]);
    R.play(w2, { from: sq(5, 4), to: sq(4, 3) });
    t("a side that can't move loses", w2.over && w2.winner === B && w2.reason === 'stuck');
    const w3 = setup([[OM, 6, 1], [BM, 7, 0], [BM, 5, 2], [BM, 5, 4]]);
    R.play(w3, { from: sq(5, 4), to: sq(4, 3) });
    t('... but one free square is enough to go on', !w3.over && R.legal(w3).length === 1);

    // the draw rule: 40 moves each with no capture and no crowning
    const dr = setup([[BK, 7, 0], [OK, 0, 7]]);
    let early = false;
    for (let k = 0; k < 80 && !dr.over; k++) {
      // the king that moves keeps as far as it can from the other one, so nobody is caught
      const ms = R.legal(dr);
      const far = (m) => {
        const other = [...dr.b].findIndex((v, i) => v && i !== m.from && R.sideOf(v) !== dr.turn);
        return Math.abs(R.rowOf(m.to) - R.rowOf(other)) + Math.abs(R.colOf(m.to) - R.colOf(other));
      };
      R.play(dr, ms.sort((a, b) => far(b) - far(a))[0]);
      if (k < 79 && dr.over) early = true;
    }
    t('draw: 80 moves in a row (40 each) with no capture and no crowning', !early && dr.over && dr.winner === -1 && dr.reason === 'limit' && dr.ply === 80);
    const rs = setup([[BM, 5, 2], [OM, 4, 3], [OM, 0, 7], [BK, 7, 6]]);
    rs.quiet = 70;
    R.play(rs, { from: sq(5, 2), to: sq(3, 4) });
    t('a capture starts the count again', rs.quiet === 0 && !rs.over);
    const rc = setup([[BM, 1, 2], [OM, 0, 7], [OM, 3, 6]]);
    rc.quiet = 79;
    R.play(rc, { from: sq(1, 2), to: sq(0, 1) });
    t('crowning starts the count again', rc.quiet === 0 && !rc.over);
    const rq = setup([[BK, 4, 3], [OM, 0, 7]]);
    rq.quiet = 79;
    R.play(rq, { from: sq(4, 3), to: sq(3, 2) });
    t('the 80th quiet move is a draw', rq.over && rq.reason === 'limit');

    // the CPU and your brother on little boards
    const easyStuck = setup([[BM, 5, 2], [OM, 4, 3], [BM, 7, 6]]);
    t('EASY and NORMAL both jump when they must', ['easy', 'normal'].every((l) => { const m = R.cpuMove(easyStuck, l); return m && m.caps.length === 1; }));
    t('NORMAL takes a free double jump', (() => {
      const st = setup([[BM, 6, 1], [OM, 5, 2], [OM, 3, 4], [OM, 0, 7], [OM, 0, 1], [BM, 7, 6]], B, false);
      const m = R.cpuMove(st, 'normal');
      return m && m.caps.length === 2;
    })());
    t('NORMAL sees a jump-back trap: it won\'t step into a jump that loses a piece for nothing', (() => {
      // blue (4,3) could step to (3,4), where (2,5) would jump it to (4,3)... which is empty once it has moved
      const st = setup([[BM, 4, 3], [BM, 7, 0], [OM, 2, 5], [OM, 0, 1]]);
      const m = R.cpuMove(st, 'normal', () => 0);
      return m && !(m.from === sq(4, 3) && m.to === sq(3, 4));
    })());
    const h1 = R.hint(setup([[BM, 6, 1], [OM, 5, 2], [OM, 3, 4], [OM, 0, 7], [OM, 0, 1]]));
    t('the tip shows a double jump, the whole path', h1 && h1.kind === 'double' && h1.path.length === 2 && h1.caps.length === 2);
    const h2 = R.hint(setup([[BM, 7, 0], [OM, 6, 1], [OM, 4, 3], [OM, 2, 3], [OM, 0, 7]]));
    t('the tip shows a triple jump', h2 && h2.kind === 'triple' && h2.path.length === 3);
    // blue (5,2) can be jumped by orange (4,1) to (6,3), and can't jump back ((3,0) is taken): the tip warns, and
    // its move gets him out of the way
    const h3st = setup([[BM, 5, 2], [BM, 7, 6], [OM, 4, 1], [OM, 3, 0], [OM, 0, 5]]);
    const h3 = R.hint(h3st);
    t('the tip warns: that piece can be jumped!', h3 && h3.kind === 'danger' && h3.danger === sq(5, 2));
    t('... and its move saves it', (() => {
      if (!h3) return false;
      const st = R.clone(h3st);
      R.play(st, h3);
      return !R.threatened(st.b, B).length;
    })());
    const h4 = R.hint(setup([[BM, 1, 2], [OM, 5, 6], [BM, 7, 0]]));
    t('the tip crowns a king when it can', h4 && (h4.kind === 'crown' || h4.kind === 'win') && h4.crown);
    t('the tip takes a winning jump', (() => {
      const h = R.hint(setup([[BM, 5, 2], [OM, 4, 3], [BM, 7, 6]]));
      return h && h.kind === 'win';
    })());
    return out;
  }

  // ---------------------------------------------------------------- 2. CPU games

  // kids-like test bots for the win rates: "little" (5): jumps when he must, steps somewhere at random, and half the
  // time notices that a step leaves the piece to be jumped. "kid" (8): looks one move ahead, a bit wobbly.
  function botMove(st, bot, rnd) {
    if (bot === 'easy' || bot === 'normal' || bot === 'random') return R.cpuMove(st, bot, rnd);
    const ms = R.legal(st);
    if (bot === 'little') {
      const jumps = ms.filter((m) => m.caps.length);
      if (jumps.length) return jumps[Math.floor(rnd() * jumps.length)];
      const careful = rnd() < 0.5;
      const safe = careful ? ms.filter((m) => {
        const b = st.b.slice();
        R.make(b, m);
        return !R.threatened(b, st.turn).includes(m.to);
      }) : [];
      const list = safe.length ? safe : ms;
      return list[Math.floor(rnd() * list.length)];
    }
    // kid: one move ahead (his move, then the best answer), with a little wobble
    let best = null, bs = -Infinity;
    for (const m of ms) {
      const b = st.b.slice();
      R.make(b, m);
      const v = -R.search(b, 1 - st.turn, 1, -Infinity, Infinity, 1, { nodes: 0, hist: new Int32Array(R.N * R.N), forced: st.forced }) + (rnd() - 0.5) * 40;
      if (v > bs) {
        bs = v;
        best = m;
      }
    }
    return best;
  }

  // one game: a and b are the bots for blue and orange. Every move is checked against the legal list.
  function playGame(a, b, starter, rnd, forced = true, cap = 400) {
    const st = R.newGame(starter, { forced });
    const bots = [a, b];
    let illegal = 0, moves = 0;
    while (!st.over && st.ply < cap) {
      const m = botMove(st, bots[st.turn], rnd);
      const ok = m && R.legal(st).some((x) => x.from === m.from && x.to === m.to && x.path.join() === m.path.join());
      if (!ok) {
        illegal++;
        break;
      }
      R.play(st, m);
      moves++;
    }
    return { winner: st.over ? st.winner : -2, reason: st.over ? st.reason : 'never', plies: st.ply, illegal, moves };
  }

  function check(opts = {}) {
    const t0 = Date.now();
    for (const k in R.SAB) R.SAB[k] = false;
    if (opts.sabotage) {
      if (!(opts.sabotage in R.SAB)) return { ok: false, error: 'unknown sabotage ' + opts.sabotage };
      R.SAB[opts.sabotage] = true;
    }
    try {
      const rnd = rng(opts.seed || 12345);
      const list = rules();
      const n = opts.games || 4;
      const pairs = [['normal', 'easy'], ['easy', 'normal'], ['easy', 'easy'], ['normal', 'normal'], ['random', 'easy'], ['little', 'normal'], ['kid', 'easy']];
      const games = [];
      let nVsE = 0, nWins = 0, nDraws = 0;
      for (const [a, b] of pairs) {
        for (let g = 0; g < n; g++) {
          const forced = g % 4 !== 3; // every fourth game with MUST JUMP off
          const r = playGame(a, b, g % 2 ? O : B, rnd, forced);
          games.push(Object.assign({ a, b, forced }, r));
          if ((a === 'normal' && b === 'easy') || (a === 'easy' && b === 'normal')) {
            nVsE++;
            const normalSide = a === 'normal' ? B : O;
            if (r.winner === normalSide) nWins++;
            else if (r.winner === -1) nDraws++;
          }
        }
      }
      const allLegal = games.every((g) => !g.illegal);
      const allEnded = games.every((g) => g.winner >= -1);
      const rate = nVsE ? nWins / nVsE : 0;
      const failed = list.filter((x) => !x.ok).map((x) => x.name);
      const cpu = {
        games: games.length, moves: games.reduce((s, g) => s + g.moves, 0), allLegal, allEnded,
        draws: games.filter((g) => g.winner === -1).length, longest: Math.max(...games.map((g) => g.plies)),
        normalBeatsEasy: `${nWins}/${nVsE} (${Math.round(rate * 100)}%, ${nDraws} draws)`, normalRateOk: rate >= 0.8,
        unfinished: games.filter((g) => g.winner < -1).length, illegalGames: games.filter((g) => g.illegal).length,
      };
      return {
        ok: !failed.length && allLegal && allEnded && cpu.normalRateOk,
        rules: `${list.length - failed.length}/${list.length}`, failed, cpu, sabotage: opts.sabotage || null,
        seconds: (Date.now() - t0) / 1000, list: opts.verbose ? list : undefined,
      };
    } finally {
      for (const k in R.SAB) R.SAB[k] = false;
    }
  }

  // how the kids' test bots do against both levels (how EASY was tuned): not a pass or fail check
  function rates(n = 40, seed = 777) {
    const rnd = rng(seed);
    const out = {};
    for (const bot of ['little', 'kid', 'random']) {
      for (const level of ['easy', 'normal']) {
        let w = 0, l = 0, d = 0;
        for (let g = 0; g < n; g++) {
          const botSide = g % 2 ? O : B;
          const r = botSide === B ? playGame(bot, level, g % 4 < 2 ? B : O, rnd) : playGame(level, bot, g % 4 < 2 ? B : O, rnd);
          if (r.winner === botSide) w++;
          else if (r.winner < 0) d++;
          else l++;
        }
        out[`${bot} vs ${level}`] = `${bot} wins ${w}, loses ${l}, draws ${d} (${Math.round((w / n) * 100)}%)`;
      }
    }
    return out;
  }

  CK.check = check;
  CK.checkRules = rules;
  CK.rates = rates;
  CK.botMove = botMove;
})();
