/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.CK_TITLE, // the name lives in js/title.js
  button: { top: 'var(--kh-top)' }, // index.html moves it (and the language button) to the bottom left on tall screens
  keys: [
    ['move round the board · pick up a piece or put it down', '← ↑ → ↓ · Enter or Space'],
    ['put the piece back', 'Esc'],
    ['undo your last move', 'U or Backspace'],
    ['call your brother (2 players: high five)', 'T'],
    ['new game', 'R'],
    ['how to play (the rules)', 'H'],
    ['pause · sound', 'P or Esc · M'],
    ['menu: play · Teddy or Tommy · 1 or 2 players', 'Enter · ← → · ↑ ↓'],
    ['menu: level · undo on or off · must jump on or off', 'L · U · J'],
  ],
  note: 'Move one step corner to corner, forward. Jump over a piece to take it, and keep jumping if you can. Reach the far side for a crown 👑: kings go backward too. Take all their pieces, or box them in, to win.',
  touch: 'Tap a piece, then tap a glowing square (for a long jump, the last square). Tap your brother\'s face (bottom right) to call him.',
});
Kit.lang.setup({ button: { top: 'var(--kl-top)' } });
