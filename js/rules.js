/* TT Checkers: the rules, the CPU and your brother's tip. No Three.js and no page in here: the same file runs the
   game, the headless checks (js/check.js) and node tools/check.js.
   American checkers (English draughts, 西洋跳棋): 8x8, played on the 32 dark squares, 12 pieces each.
     - Men move one square diagonally forward. Kings (crowned on the far row) move one square any diagonal way.
     - Jump an enemy piece next to you onto the empty square behind it to capture it. Men jump forward only, kings
       both ways. A jump keeps going while the same piece can jump again (a multi-jump is one move), and you may
       pick any jump sequence (not the longest).
     - Captures are compulsory: if you can jump, you must. The MUST JUMP switch (state.forced) turns that off, a
       house rule for Tommy: then jumping is a choice, but a jump still keeps going to the end.
     - A man that reaches the far row is crowned and his move ends there, even if he could jump again as a king.
     - You win when the other side has no pieces left, or can't move on their turn.
     - Draw: 40 moves each (80 in all) with no capture and no crowning.
   Squares are numbered 0..31, four per row; row 0 is the top (orange's back row), row 7 the bottom (blue's).
   A dark square is one where (row + col) is odd, so each player has a dark square in his left-hand corner.
   Blue (Teddy's colour) starts at the bottom and moves up; orange (Tommy's) starts at the top and moves down. */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const CK = (root.CK = root.CK || {});

  const BLUE = 0, ORANGE = 1;
  const EMPTY = 0, BM = 1, BK = 2, OM = 3, OK = 4; // blue man, blue king, orange man, orange king
  const N = 32;
  const DRAW_PLIES = 80;

  const rowOf = (i) => i >> 2;
  const colOf = (i) => 2 * (i & 3) + (((i >> 2) & 1) ? 0 : 1);
  const sq = (r, c) => (r < 0 || r > 7 || c < 0 || c > 7 || (r + c) % 2 === 0 ? -1 : r * 4 + (c >> 1));
  const sideOf = (v) => (v === BM || v === BK ? BLUE : ORANGE);
  const isKing = (v) => v === BK || v === OK;
  const manOf = (s) => (s === BLUE ? BM : OM);
  const kingOf = (s) => (s === BLUE ? BK : OK);
  const CROWN_ROW = [0, 7];

  // the four diagonals: 0 up-left, 1 up-right, 2 down-left, 3 down-right. Men go up (blue) or down (orange).
  const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const FWD = [[1, 1, 0, 0], [0, 0, 1, 1]];
  const STEP = new Int8Array(N * 4), JUMP = new Int8Array(N * 4);
  for (let i = 0; i < N; i++) {
    for (let d = 0; d < 4; d++) {
      const r = rowOf(i), c = colOf(i), [dr, dc] = DIRS[d];
      STEP[i * 4 + d] = sq(r + dr, c + dc);
      JUMP[i * 4 + d] = sq(r + 2 * dr, c + 2 * dc);
    }
  }

  // switches for the checks: js/check.js flips one to prove the checks can fail (never set in the game)
  const SAB = { noforce: false, nomulti: false, nocrownstop: false, backward: false, nodraw: false, blind: false };

  // ---------------------------------------------------------------- moves

  // A move: { from, to, path (every square it lands on, to last), caps (the squares it jumps), capv (what was there),
  // crown (a man reaching the far row), piece (what moved) }.

  function jumpsFrom(b, from, out) {
    const v = b[from], s = sideOf(v), king = isKing(v);
    const path = [], caps = [], capv = [];
    b[from] = EMPTY; // the jumper leaves its square: a king may jump in a ring and land back on it
    const dfs = (at) => {
      let more = false;
      for (let d = 0; d < 4; d++) {
        if (!king && !FWD[s][d]) continue;
        const land = JUMP[at * 4 + d];
        if (land < 0 || b[land] !== EMPTY) continue;
        const over = STEP[at * 4 + d], ov = b[over];
        // a piece already jumped this move is marked negative: it can't be jumped twice, and can't be landed on
        if (ov <= 0 || sideOf(ov) === s) continue;
        more = true;
        b[over] = -ov;
        path.push(land);
        caps.push(over);
        capv.push(ov);
        const crowns = !king && rowOf(land) === CROWN_ROW[s];
        const stop = (crowns && !SAB.nocrownstop) || SAB.nomulti;
        if (stop || !dfs(land)) out.push({ from, to: land, path: path.slice(), caps: caps.slice(), capv: capv.slice(), crown: crowns, piece: v });
        path.pop();
        caps.pop();
        capv.pop();
        b[over] = ov;
      }
      return more;
    };
    dfs(from);
    b[from] = v;
    return out;
  }

  function stepsFrom(b, from, out) {
    const v = b[from], s = sideOf(v), king = isKing(v);
    for (let d = 0; d < 4; d++) {
      if (!king && !FWD[s][d] && !SAB.backward) continue;
      const to = STEP[from * 4 + d];
      if (to < 0 || b[to] !== EMPTY) continue;
      out.push({ from, to, path: [to], caps: [], capv: [], crown: !king && rowOf(to) === CROWN_ROW[s], piece: v });
    }
    return out;
  }

  function genJumps(b, s, out = []) {
    for (let i = 0; i < N; i++) if (b[i] > 0 && sideOf(b[i]) === s) jumpsFrom(b, i, out);
    return out;
  }

  // Every legal move for side s. With forced (the normal rule) a jump, when there is one, is the only kind allowed.
  function gen(b, s, forced = true) {
    const out = genJumps(b, s, []);
    if (out.length && forced && !SAB.noforce) return out;
    for (let i = 0; i < N; i++) if (b[i] > 0 && sideOf(b[i]) === s) stepsFrom(b, i, out);
    return out;
  }

  function make(b, m) {
    b[m.from] = EMPTY;
    for (let k = 0; k < m.caps.length; k++) b[m.caps[k]] = EMPTY;
    b[m.to] = m.crown ? kingOf(sideOf(m.piece)) : m.piece;
  }
  function unmake(b, m) {
    b[m.to] = EMPTY;
    for (let k = 0; k < m.caps.length; k++) b[m.caps[k]] = m.capv[k];
    b[m.from] = m.piece;
  }

  // the number of move sequences from the start, `depth` moves deep (the standard check for a move generator)
  function perft(b, s, depth, forced = true) {
    const ms = gen(b, s, forced);
    if (depth <= 1) return depth === 1 ? ms.length : 1;
    let n = 0;
    for (const m of ms) {
      make(b, m);
      n += perft(b, 1 - s, depth - 1, forced);
      unmake(b, m);
    }
    return n;
  }

  // ---------------------------------------------------------------- the game

  function startBoard() {
    const b = new Int8Array(N);
    for (let i = 0; i < 12; i++) b[i] = OM;
    for (let i = 20; i < N; i++) b[i] = BM;
    return b;
  }

  function newGame(starter = BLUE, opts = {}) {
    return {
      b: startBoard(), turn: starter, starter, ply: 0, quiet: 0, over: false, winner: -1, reason: '', last: null,
      forced: opts.forced !== false, limit: DRAW_PLIES,
    };
  }

  function clone(st) {
    return Object.assign({}, st, { b: st.b.slice(), last: st.last && Object.assign({}, st.last) });
  }

  const legal = (st) => (st.over ? [] : gen(st.b, st.turn, st.forced));
  const legalFrom = (st, i) => legal(st).filter((m) => m.from === i);
  const count = (b, s) => {
    let n = 0;
    for (let i = 0; i < N; i++) if (b[i] > 0 && sideOf(b[i]) === s) n++;
    return n;
  };
  // the squares whose pieces must jump (forced rule on and a jump to make): they glow
  function mustJump(st) {
    if (st.over || !st.forced) return [];
    const out = new Set();
    for (const m of genJumps(st.b, st.turn, [])) out.add(m.from);
    return [...out];
  }
  // the squares of side s that the other side could jump right now
  function threatened(b, s) {
    const out = new Set();
    for (const m of genJumps(b, 1 - s, [])) for (const c of m.caps) out.add(c);
    return [...out];
  }

  // the legal move that matches: same from and to (and the same path, when one is given); the longest jump if two
  // paths end on the same square
  function find(st, mv) {
    let best = null;
    for (const m of legal(st)) {
      if (m.from !== mv.from || m.to !== mv.to) continue;
      if (mv.path && mv.path.join() !== m.path.join()) continue;
      if (!best || m.caps.length > best.caps.length) best = m;
    }
    return best;
  }
  const isLegal = (st, mv) => !!find(st, mv);

  // Play a move ({ from, to, path? }) for the side to move. Returns what happened, or null if it isn't legal.
  function play(st, mv) {
    if (st.over) return null;
    const m = find(st, mv);
    if (!m) return null;
    const side = st.turn;
    make(st.b, m);
    st.ply++;
    st.quiet = m.caps.length || m.crown ? 0 : st.quiet + 1;
    st.last = { from: m.from, to: m.to, path: m.path.slice(), caps: m.caps.slice(), crown: m.crown, side };
    st.turn = 1 - side;
    if (!count(st.b, st.turn)) end(st, side, 'all');
    else if (!gen(st.b, st.turn, st.forced).length) end(st, side, 'stuck');
    else if (st.quiet >= st.limit && !SAB.nodraw) end(st, -1, 'limit');
    return { side, from: m.from, to: m.to, path: m.path.slice(), caps: m.caps.slice(), capv: m.capv.slice(), crown: m.crown, piece: m.piece };
  }
  function end(st, winner, reason) {
    st.over = true;
    st.winner = winner;
    st.reason = reason;
  }

  // ---------------------------------------------------------------- the CPU: how good a board is

  // From side s's point of view, in hundredths of a man. Material first (a king is worth 1.5 men), then: men
  // closer to crowning, men guarding their back row (so the other side can't crown easily), the middle of the board,
  // kings away from the edges, and in the endgame the side ahead likes to trade and to chase with its kings.
  const MAN = 100, KING = 150;
  const CENTER = new Int8Array(N), EDGE = new Int8Array(N);
  for (let i = 0; i < N; i++) {
    const r = rowOf(i), c = colOf(i);
    CENTER[i] = (c >= 2 && c <= 5 ? 2 : 0) + (r >= 2 && r <= 5 ? 2 : 0);
    EDGE[i] = c === 0 || c === 7 || r === 0 || r === 7 ? 1 : 0;
  }
  function evaluate(b, s) {
    let sc = 0, nB = 0, nO = 0, kB = 0, kO = 0;
    for (let i = 0; i < N; i++) {
      const v = b[i];
      if (!v) continue;
      const r = rowOf(i);
      if (v === BM) {
        nB++;
        sc += MAN + (7 - r) * 2 + (r <= 2 ? 6 : 0) + (r === 7 ? 6 : 0) + CENTER[i];
      } else if (v === OM) {
        nO++;
        sc -= MAN + r * 2 + (r >= 5 ? 6 : 0) + (r === 0 ? 6 : 0) + CENTER[i];
      } else if (v === BK) {
        kB++;
        sc += KING + CENTER[i] * 2 - EDGE[i] * 6;
      } else {
        kO++;
        sc -= KING + CENTER[i] * 2 - EDGE[i] * 6;
      }
    }
    const total = nB + nO + kB + kO;
    const matB = nB * MAN + kB * KING, matO = nO * MAN + kO * KING;
    if (total <= 10 && matB !== matO) {
      // ahead? trade down, and send the kings after the other side's pieces
      const ahead = matB > matO ? BLUE : ORANGE, sign = ahead === BLUE ? 1 : -1;
      sc += sign * (24 - total) * 6;
      let chase = 0;
      for (let i = 0; i < N; i++) {
        const v = b[i];
        if (!isKing(v) || sideOf(v) !== ahead) continue;
        let near = 99;
        for (let j = 0; j < N; j++) {
          if (b[j] > 0 && sideOf(b[j]) !== ahead) near = Math.min(near, Math.max(Math.abs(rowOf(i) - rowOf(j)), Math.abs(colOf(i) - colOf(j))));
        }
        if (near < 99) chase += 7 - near;
      }
      sc += sign * chase * 3;
    }
    return s === BLUE ? sc : -sc;
  }

  // ---------------------------------------------------------------- the CPU: alpha-beta search

  const WIN = 100000;
  function order(ms, hist) {
    for (const m of ms) m.k = m.caps.length * 100000 + (m.crown ? 50000 : 0) + hist[m.from * N + m.to];
    return ms.sort((a, b) => b.k - a.k);
  }

  // negamax with alpha-beta. At the bottom it keeps going while jumps are pending, so it never stops in the
  // middle of an exchange (a quiescence search).
  function search(b, s, depth, alpha, beta, ply, ctx) {
    ctx.nodes++;
    const ms = gen(b, s, ctx.forced);
    if (!ms.length) return -WIN + ply;
    const jumping = ms[0].caps.length > 0;
    if (depth <= 0) {
      if (!jumping || ply > 40) return evaluate(b, s);
      if (!ctx.forced) {
        // jumping is a choice: stand pat, then only the jumps
        const stand = evaluate(b, s);
        if (stand >= beta) return stand;
        if (stand > alpha) alpha = stand;
        let best = stand;
        for (const m of ms) {
          if (!m.caps.length) continue;
          make(b, m);
          const v = -search(b, 1 - s, depth - 1, -beta, -alpha, ply + 1, ctx);
          unmake(b, m);
          if (v > best) best = v;
          if (v > alpha) alpha = v;
          if (alpha >= beta) break;
        }
        return best;
      }
    }
    // a single forced reply doesn't use up depth
    const d = ms.length === 1 && depth > 0 && ply < 24 ? depth : depth - 1;
    order(ms, ctx.hist);
    let best = -Infinity;
    for (const m of ms) {
      make(b, m);
      const v = -search(b, 1 - s, d, -beta, -alpha, ply + 1, ctx);
      unmake(b, m);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        if (depth > 0) ctx.hist[m.from * N + m.to] += depth * depth;
        break;
      }
    }
    return best;
  }

  // 🔥 NORMAL: iterative deepening to at least depth 6, on to depth 10 while it's quick. It picks the best move;
  // moves within `tie` points of the best are equally good, picked at random so games differ.
  const NORMAL = { minDepth: 6, maxDepth: 10, nodes: 10000, tie: 3 };
  // 🐣 EASY, for Tommy (5): it looks one move ahead (its move and your answer) with a lot of wobble in its sums,
  // and `random` of the time it just plays any legal move: gentle mistakes, like leaving a piece where you can jump it.
  const EASY = { random: 0.55, depth: 2, noise: 120 };

  // A thinking job, so the page never freezes: job.step(ms) searches for about ms milliseconds (at least one root
  // move, a small tree) and returns true when the move is ready in job.move. cpuMove() runs a job to the end.
  function think(st, level = 'normal', rnd = Math.random, opts = {}) {
    const s = st.turn, b = st.b.slice();
    const ms = gen(b, s, st.forced);
    const job = { move: null, depth: 0, nodes: 0, done: false, step: null, level };
    if (!ms.length) {
      job.done = true;
      job.step = () => true;
      return job;
    }
    if (ms.length === 1) {
      job.move = ms[0];
      job.done = true;
      job.step = () => true;
      return job;
    }
    if (level === 'random' || (level === 'normal' && SAB.blind)) {
      job.move = ms[Math.floor(rnd() * ms.length)];
      job.done = true;
      job.step = () => true;
      return job;
    }
    const cfg = level === 'easy' ? { minDepth: EASY.depth, maxDepth: EASY.depth, nodes: 0, tie: 0 } : Object.assign({}, NORMAL, opts);
    if (level === 'easy' && rnd() < EASY.random) {
      job.move = ms[Math.floor(rnd() * ms.length)];
      job.done = true;
      job.step = () => true;
      return job;
    }
    const ctx = { nodes: 0, hist: new Int32Array(N * N), forced: st.forced };
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const noise = level === 'easy' ? ms.map(() => (rnd() - 0.5) * 2 * EASY.noise) : ms.map(() => 0);
    let roots = ms.map((m, k) => ({ m, k, score: 0 }));
    let depth = 1, i = 0, alpha = -Infinity, cur = [];
    let finished = null; // the root list (with scores) from the last finished depth
    job.step = (budget = 8) => {
      if (job.done) return true;
      const t0 = now();
      do {
        const r = roots[i];
        make(b, r.m);
        // search the first move with a full window, the rest just above (best - tie) so near-equal moves get
        // a real score
        const lo = alpha === -Infinity || level === 'easy' ? -Infinity : alpha - cfg.tie - 1;
        r.score = -search(b, 1 - s, depth - 1, -Infinity, -lo, 1, ctx) + noise[r.k];
        unmake(b, r.m);
        if (r.score > alpha) alpha = r.score;
        cur.push(r);
        i++;
        if (i >= roots.length) {
          // a depth is done: best first for the next one
          finished = cur.slice().sort((x, y) => y.score - x.score);
          job.depth = depth;
          const enough = depth >= cfg.maxDepth || (depth >= cfg.minDepth && ctx.nodes >= cfg.nodes) || Math.abs(finished[0].score) > WIN - 1000;
          if (enough) {
            const top = finished[0].score;
            const near = finished.filter((x) => x.score >= top - cfg.tie);
            job.move = near[Math.floor(rnd() * near.length)].m;
            job.done = true;
            job.nodes = ctx.nodes;
            return true;
          }
          roots = finished;
          depth++;
          i = 0;
          alpha = -Infinity;
          cur = [];
        }
      } while (now() - t0 < budget);
      job.nodes = ctx.nodes;
      return false;
    };
    return job;
  }

  function cpuMove(st, level = 'normal', rnd = Math.random, opts) {
    const job = think(st, level, rnd, opts);
    while (!job.step(1e9));
    return job.move;
  }

  // ---------------------------------------------------------------- your brother's tip

  // The best move for the side to move (NORMAL's thinking, without the coin toss), and what to say about it:
  // win, triple / double / jump, crown, danger (one of your pieces can be jumped: `danger` is its square) or move.
  function hint(st, opts = {}) {
    if (st.over) return null;
    const ms = legal(st);
    if (!ms.length) return null;
    const m = cpuMove(st, 'normal', () => 0, Object.assign({ maxDepth: 8, nodes: 30000, tie: 0 }, opts));
    if (!m) return null;
    const h = { from: m.from, to: m.to, path: m.path.slice(), caps: m.caps.slice(), crown: m.crown, kind: 'move', danger: -1 };
    const after = clone(st);
    play(after, m);
    if (after.over && after.winner === st.turn) h.kind = 'win';
    else if (m.caps.length >= 3) h.kind = 'triple';
    else if (m.caps.length === 2) h.kind = 'double';
    else if (m.caps.length === 1) h.kind = 'jump';
    else if (m.crown) h.kind = 'crown';
    else {
      const t = threatened(st.b, st.turn);
      if (t.length) {
        h.kind = 'danger';
        h.danger = t.includes(m.from) ? m.from : t[0];
      }
    }
    return h;
  }

  CK.rules = {
    BLUE, ORANGE, EMPTY, BM, BK, OM, OK, N, DRAW_PLIES, MAN, KING, WIN, NORMAL, EASY, SAB, STEP, JUMP, DIRS,
    rowOf, colOf, sq, sideOf, isKing, manOf, kingOf, CROWN_ROW,
    gen, genJumps, jumpsFrom, stepsFrom, make, unmake, perft, startBoard, newGame, clone, legal, legalFrom, count,
    mustJump, threatened, find, isLegal, play, evaluate, search, think, cpuMove, hint,
  };
})();
