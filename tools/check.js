#!/usr/bin/env node
/* Run the headless checks from a terminal, with the same rules and CPU files the page loads (js/rules.js, js/check.js).
     node tools/check.js                       the rules, then CPU games (12 per pairing)
     node tools/check.js 30                    the same with 30 games per pairing
     node tools/check.js --sabotage nomulti    proves the check can fail: a jump stops after one piece
       other sabotages: noforce (jumps never compulsory), nocrownstop (a man crowned in a jump keeps jumping),
       backward (men may step backward), nodraw (no draw rule: some games never end), blind (NORMAL plays at
       random, so it stops beating EASY)
     node tools/check.js rates [n]             win rates of the kids' test bots against both levels (how EASY was tuned)
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Number, JSON, Object, Array, Map, Set, Error, Infinity, Int8Array, Int32Array, Date, performance };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/rules.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
};
if (args[0] === 'rates') {
  console.log(JSON.stringify(ctx.CK.rates(+(args[1] || 40)), null, 1));
  process.exit(0);
}
const out = ctx.CK.check({
  games: +(args.find((a) => /^\d+$/.test(a)) || 12),
  sabotage: opt('sabotage'),
  seed: opt('seed') ? +opt('seed') : undefined,
  verbose: args.includes('--verbose'),
});
if (args.includes('--brief')) {
  console.log(JSON.stringify({ ok: out.ok, rules: out.rules, failed: out.failed, normalBeatsEasy: out.cpu && out.cpu.normalBeatsEasy, allLegal: out.cpu && out.cpu.allLegal, allEnded: out.cpu && out.cpu.allEnded, seconds: out.seconds }));
} else console.log(JSON.stringify(out, null, 1));
console.log(out.ok ? 'CHECK PASSED' : 'CHECK FAILED');
process.exitCode = out.ok ? 0 : 1;
