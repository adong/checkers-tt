/* TT Checkers: your brother. In 1 player the other brother (Kit.roster.buddyFor: Teddy when Tommy plays, Tommy
   for Teddy) comes when called with T or his face button, any time and as often as you like. A visit:
     pop in beside you (at his roster buddyScale, in a puff of stars) → hello with his signature move (Teddy's boxing
     combo, Tommy's Y with ✌️) → toss you a treat (🍦 💧 🧃 🍪 🍉 🍌) → point: the best move glows (the piece, gold
     dots along the whole path of a multi-jump, the square, a 👇) with a toast ("TOMMY SAYS: DOUBLE JUMP!", "JUMP!",
     "TRIPLE JUMP!", "MAKE A KING!", "THIS ONE WINS!", "THAT PIECE CAN BE JUMPED!" with a ❗ over it, or "TRY THIS
     ONE!") → once you've moved, his goodbye move → pop out.
   If it's the CPU's turn when he arrives, he waits for yours before he points. Calling him again while he's there
   brings another treat and points again (at the best move for the board as it is now).
   In 2 players both brothers are already at the board, so T is a high five (CK.highFive): they run together,
   slap hands and run back. It doesn't change the game. */
(function () {
  'use strict';
  const T = THREE;
  const CK = (window.CK = window.CK || {});
  const { pick, emojiTexture, rand } = Kit.gfx;

  const V = { pop: 0.35, treatAt: 2.1, helpAt: 2.7, byeAfter: 0.7, maxWait: 16 };
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];

  let api = null, entry = null, flyers = null;
  const actor = CK.makeActor();
  // phase: off | in | here | bye | out
  const b = { phase: 'off', t: 0, given: false, treatAt: V.treatAt, helped: -1, pointing: -1, movedAt: -1, calls: 0, treats: 0, hints: 0, lastTreat: null, popT: 0, lastHint: null };
  const treat = { sprite: null, flyT: -1, emoji: '', from: new T.Vector3(), to: new T.Vector3() };
  const tmp = new T.Vector3();

  function init(a) {
    api = a;
    treat.sprite = new T.Sprite(new T.SpriteMaterial({ depthWrite: false, depthTest: false, transparent: true }));
    treat.sprite.visible = false;
    treat.sprite.renderOrder = 22;
    CK.stage.scene.add(treat.sprite);
    flyers = a.flyers;
    actor.attach(CK.stage.scene, flyers);
    actor.visible = false;
  }

  // The brother for this player (rebuilt only when he changes). Returns his roster entry.
  function setFor(playerId) {
    const id = Kit.roster.buddyFor(playerId);
    if (entry && entry.id === id) return entry;
    dismiss();
    entry = Kit.roster.get(id);
    actor.set(id, 1);
    const tag = Kit.gfx.nameTag(entry.name, entry.tag || '#ffb02e');
    tag.position.y = 2.75;
    actor.person.root.add(tag);
    actor.visible = false;
    return entry;
  }

  const scaleNow = () => (entry.buddyScale || 0.8) * (api.scale ? api.scale() : 1);

  function call() {
    if (!entry) return 'none';
    b.calls++;
    if (b.phase === 'off' || b.phase === 'out') return summon();
    // another hello, another treat, and he points again
    actor.react('hello');
    b.phase = 'here';
    b.t = Math.min(b.t, V.pop + 0.1);
    b.given = false;
    b.treatAt = b.t + 1.5;
    b.helped = -1;
    b.movedAt = -1;
    b.popT = Math.max(b.popT, V.pop);
    api.toast(`${entry.name}'S HERE!`, 'buddy');
    CK.sfx.pop();
    return 'again';
  }

  function summon() {
    const s = api.spot();
    Object.assign(b, { phase: 'in', t: 0, given: false, treatAt: V.treatAt, helped: -1, pointing: -1, movedAt: -1, popT: 0 });
    actor.setScale(0.01);
    actor.place(s.x, 0, s.z);
    actor.face = null;
    actor.faceDefault = s.face;
    actor.visible = true;
    actor.react('idle');
    const p = actor.root.position;
    for (let i = 0; i < 14; i++) flyers.add(i % 3 ? '⭐' : '✨', p.x, 1 + rand(0, 1), p.z, rand(-2.5, 2.5), rand(1, 4), rand(0.3, 0.5), 0.8, rand(-4, 4), 3);
    api.toast(`${entry.name}'S HERE!`, 'buddy');
    CK.sfx.pop();
    return 'summoned';
  }

  function dismiss() {
    b.phase = 'off';
    actor.visible = false;
    treat.flyT = -1;
    if (treat.sprite) treat.sprite.visible = false;
    if (b.pointing >= 0 && api) api.clearHint();
    b.pointing = -1;
  }

  // You played a square: the hint has done its job.
  function moved() {
    if (b.phase === 'here' && b.pointing >= 0) {
      b.pointing = -1;
      b.movedAt = b.t;
    }
  }

  // A new round (or home): he leaves straight away.
  function reset() {
    dismiss();
  }

  // ---------------------------------------------------------------- the treat

  function giveTreat() {
    const [emoji, label] = pick(TREATS);
    treat.emoji = emoji;
    b.treats++;
    b.lastTreat = emoji;
    treat.sprite.material.map = emojiTexture(emoji);
    treat.sprite.material.needsUpdate = true;
    actor.root.updateMatrixWorld(true);
    Kit.people.handWorld(actor.person, 1, treat.from);
    treat.sprite.position.copy(treat.from);
    treat.sprite.scale.setScalar(0.7);
    treat.sprite.visible = true;
    treat.flyT = 0;
    api.toast(`${emoji} ${label} FROM ${entry.name}!`, 'treat');
    CK.sfx.kit('coin', 6);
  }

  function updateTreat(dt) {
    if (treat.flyT < 0) return;
    const player = api.player();
    treat.flyT += dt / 0.65;
    player.root.updateMatrixWorld(true);
    Kit.people.handWorld(player.person, -1, treat.to);
    const k = Math.min(1, treat.flyT);
    treat.sprite.position.lerpVectors(treat.from, treat.to, k);
    treat.sprite.position.y += Math.sin(k * Math.PI) * 1.6;
    treat.sprite.material.rotation = k * Math.PI * 2;
    if (k >= 1) {
      treat.flyT = -1;
      treat.sprite.visible = false;
      treat.sprite.material.rotation = 0;
      player.hold(treat.emoji, 8);
      player.react('cheer');
    }
  }

  // ---------------------------------------------------------------- the visit

  function update(dt) {
    updateTreat(dt);
    if (b.phase === 'off') return;
    b.t += dt;
    const s = api.spot();
    const full = scaleNow();
    // pop in and out: a springy scale
    if (b.phase === 'in' || b.phase === 'here' || b.phase === 'bye') {
      b.popT += dt;
      const u = Math.min(1, b.popT / V.pop);
      const spring = u < 1 ? 1 + Math.sin(u * Math.PI) * 0.25 : 1;
      actor.setScale(full * Math.max(0.01, u) * spring);
    }
    if (b.phase === 'in' && b.t >= V.pop) {
      b.phase = 'here';
      actor.react('hello');
    }
    if (b.phase === 'here') {
      actor.faceDefault = s.face;
      // the treat: hand it over a moment after hello
      if (!b.given && b.t > b.treatAt - 0.35) actor.act('give', 0.6, 0, true);
      if (!b.given && b.t > b.treatAt) {
        b.given = true;
        giveTreat();
      }
      const ready = b.given && b.t > Math.max(V.helpAt, b.treatAt + 0.5) && b.movedAt < 0;
      if (ready && b.helped !== api.turnId()) {
        // the hint: once the treat's on its way and it's your turn
        const h = api.canHint() ? api.showHint() : null;
        if (h) {
          b.helped = api.turnId();
          b.pointing = h.to;
          b.hints++;
          b.lastHint = { kind: h.kind, from: h.from, to: h.to, path: h.path.slice(), caps: h.caps.length, danger: h.danger };
          api.toast(`${entry.name} SAYS: ${tipText(h)}`, h.kind === 'danger' ? 'save warn' : 'save');
          if (h.kind === 'danger') CK.sfx.alert();
          else CK.sfx.nice();
        }
      }
      if (b.pointing >= 0) {
        // face the square and point at it
        CK.stage.cellPos(b.pointing, tmp);
        const p = actor.root.position;
        actor.face = Math.atan2(-(tmp.x - p.x), -(tmp.z - p.z));
        if (actor.mode !== 'signature') actor.act('point', 0.3, 0);
      } else actor.face = null;
      // leave a moment after you've played, or if the round's over and nothing's left to do
      const idle = b.given && b.pointing < 0 && treat.flyT < 0;
      if ((b.movedAt >= 0 && b.t > b.movedAt + V.byeAfter) || (idle && b.t > V.maxWait) || (idle && api.roundOver() && b.t > V.helpAt + 1.2)) {
        b.phase = 'bye';
        b.t = 0;
        actor.face = null;
        actor.react('goodbye');
      }
    } else if (b.phase === 'bye') {
      if (b.t > 1.7) {
        b.phase = 'out';
        b.t = 0;
        CK.sfx.pop();
      }
    } else if (b.phase === 'out') {
      const u = Math.min(1, b.t / 0.25);
      actor.setScale(full * Math.max(0.01, 1 - u) * (1 + Math.sin(u * Math.PI) * 0.2));
      if (u >= 1) {
        const p = actor.root.position;
        for (let i = 0; i < 8; i++) flyers.add('✨', p.x, 1, p.z, rand(-2, 2), rand(1, 3), 0.35, 0.6, rand(-4, 4), 3);
        dismiss();
      }
    }
    actor.update(dt);
  }

  // What he says, in capitals like every toast.
  const TIPS = { win: 'THIS ONE WINS!', triple: 'TRIPLE JUMP!', double: 'DOUBLE JUMP!', jump: 'JUMP!', crown: 'MAKE A KING!', danger: 'THAT PIECE CAN BE JUMPED!', move: 'TRY THIS ONE!' };
  function tipText(h) {
    return TIPS[h.kind] || TIPS.move;
  }

  // ---------------------------------------------------------------- 2 players: the high five

  // On a tall screen the boys stand in front of and behind the board, so each runs round a corner (api.via) first.
  const hf = { on: false, t: 0, clapped: false, count: 0, legs: [[], []], back: false, raise: -1 };
  const go = (actor, legs) => {
    const p = legs.shift();
    if (p) actor.moveTo(p.x, p.z, 9);
  };
  function highFive() {
    if (hf.on) return 'busy';
    const [a, c] = api.players();
    const [pa, pc] = api.meet();
    const via = api.via ? api.via() : [null, null];
    Object.assign(hf, { on: true, t: 0, clapped: false, back: false, raise: -1 });
    hf.count++;
    hf.legs = [[via[0], pa].filter(Boolean), [via[1], pc].filter(Boolean)];
    a.react('idle');
    c.react('idle');
    go(a, hf.legs[0]);
    go(c, hf.legs[1]);
    return 'high5';
  }
  function updateHighFive(dt) {
    if (!hf.on) return;
    hf.t += dt;
    const [a, c] = api.players();
    if (!a.moving && hf.legs[0].length) go(a, hf.legs[0]);
    if (!c.moving && hf.legs[1].length) go(c, hf.legs[1]);
    const there = !a.moving && !c.moving && !hf.legs[0].length && !hf.legs[1].length;
    const pa = a.root.position, pc = c.root.position;
    if (there && !hf.clapped && !hf.back) {
      // face each other, hands up, jump, clap
      a.face = Math.atan2(-(pc.x - pa.x), -(pc.z - pa.z));
      c.face = Math.atan2(-(pa.x - pc.x), -(pa.z - pc.z));
      if (hf.raise < 0) hf.raise = hf.t;
      a.act('high5', 0.8, 2.6, true);
      c.act('high5', 0.8, 2.6, true);
      if (hf.t > hf.raise + 0.28) {
        hf.clapped = true;
        hf.clapT = hf.t;
        CK.sfx.clap();
        const x = (pa.x + pc.x) / 2, z = (pa.z + pc.z) / 2;
        flyers.add('💥', x, 2.7, z, 0, 0.5, 1.0, 0.5, 0, 0);
        for (let i = 0; i < 8; i++) flyers.add(i % 2 ? '🙌' : '⭐', x, 2.6, z, rand(-2.5, 2.5), rand(1.5, 3.5), rand(0.4, 0.6), 1, rand(-3, 3), 4);
        api.toast('HIGH FIVE! 🙌', 'buddy');
      }
    }
    if (hf.clapped && !hf.back && hf.t > hf.clapT + 0.9) {
      hf.back = true;
      const [ha, hc] = api.homes();
      const via = api.via ? api.via() : [null, null];
      a.face = null;
      c.face = null;
      hf.legs = [[via[0], ha].filter(Boolean), [via[1], hc].filter(Boolean)];
      go(a, hf.legs[0]);
      go(c, hf.legs[1]);
    } else if (hf.back && there) {
      hf.on = false;
      hf.raise = -1;
    }
  }
  function cancelHighFive() {
    if (!hf.on) return;
    hf.on = false;
    hf.raise = -1;
    hf.legs = [[], []];
    const [a, c] = api.players();
    const [ha, hc] = api.homes();
    a.face = c.face = null;
    a.place(ha.x, 0, ha.z);
    c.place(hc.x, 0, hc.z);
  }

  CK.buddy = {
    init, setFor, call, summon, dismiss, moved, reset, update, tipText, V,
    get entry() { return entry; },
    get actor() { return actor; },
    get on() { return b.phase !== 'off'; },
    get phase() { return b.phase; },
    info() {
      const r = actor.root.position;
      return {
        phase: b.phase, id: entry && entry.id, t: +b.t.toFixed(2), given: b.given, pointing: b.pointing, calls: b.calls,
        treats: b.treats, hints: b.hints, lastTreat: b.lastTreat, lastHint: b.lastHint, pose: actor.pose,
        x: +r.x.toFixed(2), z: +r.z.toFixed(2), scale: +actor.scale.toFixed(2), visible: actor.visible, flying: treat.flyT >= 0,
        highFives: hf.count, highFiving: hf.on,
      };
    },
  };
  CK.highFive = { start: highFive, update: updateHighFive, cancel: cancelHighFive, get on() { return hf.on; } };
})();
