/* 中文 for TT Checkers (西洋跳棋): the words on the page, the toasts, the canvas words (the word bursts) and the ?
   panel (Kit.lang, from kit/lang.js). Simple words: Tommy is 5. 跳吃 is a jump, 连跳 a multi-jump, 升王 crowning a
   king. The kids' and Foxy's names and the game's own name stay English. */
(function () {
  const L = Kit.lang;
  L.keep(['TT Checkers', 'TT', 'Checkers', 'TT Checkers · Teddy & Tommy', 'TEDDY', 'TOMMY', 'FOXY', 'Teddy', 'Tommy', 'Foxy', 'Esc', 'Enter', 'Space', 'Backspace']);

  const TIP = {
    'THIS ONE WINS!': '走这步就赢啦！', 'TRIPLE JUMP!': '三连跳！', 'DOUBLE JUMP!': '两连跳！', 'JUMP!': '跳吃！',
    'MAKE A KING!': '去升王！', 'THAT PIECE CAN BE JUMPED!': '那个棋子会被吃掉！', 'TRY THIS ONE!': '走这步试试！',
  };
  L.add({
    // the menu
    'JUMP, BONK AND MAKE A KING!': '西洋跳棋：跳吃、连跳、升王！',
    PLAY: '开始玩', 'Play': '开始玩', 'Play (Enter)': '开始玩 (Enter)',
    'HOW TO PLAY': '怎么玩', 'How to play': '怎么玩', 'How to play (H)': '怎么玩 (H)',
    '1 PLAYER': '1 人玩', '2 PLAYERS': '2 人玩', 'Players': '几个人玩', 'Who are you?': '你是谁？', 'Level': '难度',
    EASY: '简单', NORMAL: '普通', 'Switches': '开关',
    UNDO: '悔棋', 'Undo button (U)': '悔棋按钮 (U)', 'MUST JUMP': '必须跳吃', 'If you can jump, you must (J)': '能跳吃就必须跳吃 (J)',
    // while playing
    'Pause': '暂停', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开 / 关',
    'Undo': '悔棋', 'Undo (U)': '悔棋 (U)',
    'Call your brother': '叫兄弟来帮忙', 'High five!': '击掌！', 'High five! (T)': '击掌！(T)', 'HIGH FIVE! 🙌': '击掌！🙌',
    'YOUR TURN!': '轮到你啦！', 'YOUR TURN: JUMP!': '轮到你：跳吃！', 'DRAW!': '平局！', 'DRAW IN 1 MOVE': '再走 1 步就平局',
    "THAT'S FOXY'S PIECE!": '那是 Foxy 的棋子！', 'YOU MUST JUMP!': '你必须跳吃！', "THIS ONE CAN'T MOVE!": '这个走不了！',
    'ONLY KINGS GO BACKWARD!': '只有王能往后走！', 'ONE STEP AT A TIME!': '一次只走一步！',
    // the game is over, pause
    'NO PIECES LEFT!': '棋子都被吃光啦！', "THEY CAN'T MOVE!": '对方没棋可走啦！',
    '40 MOVES EACH WITH NO JUMP AND NO NEW KING.': '双方各走 40 步，没有跳吃，也没有升王。',
    'Home': '主页', 'Play again': '再玩一次', 'PLAY AGAIN': '再玩一次', 'Keep playing': '继续玩', 'Start a new game': '重新开始',
    // the rules screen
    'MOVE ONE STEP, CORNER TO CORNER.': '斜着走一步。',
    'Forward, on the dark squares. Tap a piece to see where it can go.': '在深色格子上往前走。点一下棋子，看看它能走到哪里。',
    'JUMP OVER A PIECE TO TAKE IT. BONK!': '跳过对方的棋子，就能吃掉它。咚！',
    'Hop over it onto the empty square behind it.': '跳到它后面的空格子上。',
    'KEEP JUMPING: A DOUBLE JUMP!': '还能接着跳：连跳！',
    "If you can jump again from where you land, keep going. It's all one move.": '落下的地方还能再跳，就接着跳。这些都算一步。',
    'REACH THE FAR SIDE: A KING! 👑': '走到对面最后一行：升王！👑',
    'He gets a crown. Crowning ends your move.': '它会戴上王冠。升王以后，这一步就结束了。',
    'KINGS GO BACKWARD TOO.': '王还能往后走。',
    'A king moves and jumps both ways.': '王可以往前走、往后走，也可以往前跳吃、往后跳吃。',
    'IF YOU CAN JUMP, YOU MUST!': '能跳吃，就一定要跳吃！',
    'The pieces that must jump glow. Little ones can switch MUST JUMP off on the menu.': '必须跳吃的棋子会发光。小朋友可以在菜单里关掉“必须跳吃”。',
    'TAKE THEM ALL, OR BOX THEM IN!': '吃光对方，或者把对方堵住！',
    "You win when they have no pieces left, or can't move.": '对方没有棋子了，或者没棋可走，你就赢啦。',
    '40 MOVES EACH WITH NO JUMP AND NO NEW KING IS A DRAW.': '双方各走 40 步，都没有跳吃也没有升王，就是平局。',
    'The count starts again after a jump or a crowning.': '有人跳吃或者升王，就重新开始数。',
    'Got it': '知道啦',
    // canvas word bursts over the board (js/stage.js and js/game.js, through Kit.lang.t)
    'BONK!': '咚！', 'KING ME!': '升王！', 'ALL GONE!': '吃光啦！', 'BOXED IN!': '堵住啦！',
    // the ? panel (js/keys.js)
    'move round the board · pick up a piece or put it down': '在棋盘上移动 · 拿起或放下棋子',
    'put the piece back': '把棋子放回去',
    'undo your last move': '悔一步棋',
    'call your brother (2 players: high five)': '叫兄弟来帮忙（2 人玩：击掌）',
    'new game': '新的一局',
    'how to play (the rules)': '怎么玩（规则）',
    'menu: play · Teddy or Tommy · 1 or 2 players': '菜单：开始 · Teddy 还是 Tommy · 1 人或 2 人',
    'menu: level · undo on or off · must jump on or off': '菜单：难度 · 悔棋 开 / 关 · 必须跳吃 开 / 关',
    'Move one step corner to corner, forward. Jump over a piece to take it, and keep jumping if you can. Reach the far side for a crown 👑: kings go backward too. Take all their pieces, or box them in, to win.':
      '斜着往前走一步。跳过对方的棋子就能吃掉它，还能跳就接着跳。走到对面最后一行就升王 👑：王还能往后走。吃光对方的棋子，或者把对方堵住，就赢啦。',
    "Tap a piece, then tap a glowing square (for a long jump, the last square). Tap your brother's face (bottom right) to call him.":
      '先点一个棋子，再点发光的格子（连跳就点最后一格）。点右下角兄弟的头像，叫他来帮忙。',
  });
  L.add(TIP);

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  L.rule(/^Call (\S+) \(T\)$/, '叫 $1 (T)');
  L.rule(/^Call (\S+)$/, '叫 $1');
  L.rule(/^(\S+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(\S+) SAYS: (.+)$/, (m, who, tip) => `${who} 说：${TIP[tip] || tip}`);
  L.rule(/^IT'S (\S+)'S TURN!$/, '轮到 $1 啦！');
  L.rule(/^(\S+) IS THINKING…$/, '$1 在想…');
  L.rule(/^(\S+): JUMP!$/, '$1：跳吃！');
  L.rule(/^(\S+)'S TURN!$/, '轮到 $1！');
  L.rule(/^(\S+) WINS!$/, '$1 赢啦！');
  L.rule(/^DRAW IN (\d+) MOVES$/, '再走 $1 步就平局');
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (\S+)!$/, (m, emoji, item, who) => `${emoji} ${who} 给你${TREAT[item]}！`);
})();
