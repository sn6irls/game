window.buildDesktopUI = (root, A, W, H) => {
  const icon = name => name==='bot'?`<i class="bot-menu-icon" style="background-image:url('${window.BOT_ASSET.src}')" aria-hidden="true"></i>`:`<img class="xp-icon" src="${A.xpIcons[name] || A.xpIcons.folder}" alt="" aria-hidden="true">`;
  const apps = {
    mines: { name: '지뢰찾기', icon: 'mines' },
    settings: { name: '설정', icon: 'run' },
    computer: { name: '내 컴퓨터', icon: 'computer' },
    folders: { name: '내 문서', icon: 'folder' },
    gallery: { name: '내 사진', icon: 'pictures' },
    note: { name: '메모장', icon: 'note' },
    stickers: { name: '스티커', icon: 'sticker' },
    capture: { name: '캡처 도구', icon: 'capture' },
    bot: { name: '슈퍼짱 봇', icon: 'bot' },
    recycle: { name: '휴지통', icon: 'recycle' },
    prize: { name: '망치 획득?!', icon: 'game' },
    secret: { name: '소녀의 방.exe', icon: 'game' },
    tools: { name: '도구', icon: 'paint' },
    help: { name: '도움말', icon: 'computer' },
    'photo-viewer': {name:'사진 보기',icon:'pictures'},
  };
  const toolNames = {
    ds:'DS 펜', chalk:'분필', eraser:'분필 지우개',
    checker:'투명 지우개', bubble:'비눗방울', jelly:'젤리',
    photo:'프리쿠라펜', gem:'큐빅 펜', knife:'커터칼',
    glitter:'반짝이풀', stickers:'스티커', hammer:'망치',
  };
  const titlebar = (id, name, ico, max = true) =>
    `<header class="titlebar" data-drag="${id}">${icon(ico)}<span>${name}</span><div class="controls"><button data-win="min" aria-label="최소화">_</button>${max ? '<button data-win="max" aria-label="최대화">□</button>' : ''}<button data-win="close" aria-label="닫기">×</button></div></header>`;
  const win = (id, title, ico, body, attrs = '') =>
    `<section class="window" id="${id}-window" data-app="${id}" hidden ${attrs}>${id === 'settings' ? titlebar(id, title, ico, false).replace('<button data-win="min" aria-label="최소화">_</button>', '<button id="language-help" aria-label="도움말">?</button>') : titlebar(id, title, ico)}${body}</section>`;
  const colors = ['#fffdf2', '#f3b7c6', '#f5efab', '#acd5ee'];
  root.innerHTML = `<div id="desktop"><div id="surface"><canvas id="underlay" width="${W}" height="${H}"></canvas><canvas id="giant-supa" width="${W}" height="${H}" aria-hidden="true"></canvas><canvas id="wall" width="${W}" height="${H}"></canvas><canvas id="ink" width="${W}" height="${H}" tabindex="0" aria-label="바탕화면에 그리기"></canvas><canvas id="jelly-surface" width="${W}" height="${H}" aria-hidden="true"></canvas><canvas id="soap-surface" width="${W}" height="${H}" aria-hidden="true"></canvas><div id="stickers-layer"></div><canvas id="effects" width="${W}" height="${H}" aria-hidden="true"></canvas></div>
  <button id="desktop-bot" title="잡아당기기 · 봇 아이콘으로 숨기기" aria-label="슈퍼짱 봇 잡아당기기" hidden></button><div id="icons">${['recycle', 'secret', 'capture', 'tools', 'bot', 'note'].map((id, i) => `<button class="desktop-icon" data-open="${id}" style="--x:${10 + Math.floor(i / 5) * 95}px;--y:${10 + (i % 5) * 85}px" title="${apps[id].name}">${icon(apps[id].icon)}<span>${apps[id].name}</span></button>`).join('')}</div>
  ${win(
    'tools',
    '도구',
    'paint',
    `<nav class="menu"><button data-action="new">새 화면</button><button data-open="help">도움말</button></nav><div class="tool-grid">${Object.entries(
      toolNames,
    )
      .map(
        ([id, name]) =>
          `<button class="tool-button ${id === 'chalk' ? 'active' : ''} ${id === 'hammer' ? 'locked' : ''}" data-tool="${id}" title="${name}" aria-pressed="${id === 'chalk'}"><img src="${A.tools[id]}" alt=""><span>${name}</span></button>`,
      )
      .join(
        '',
      )}</div><div class="tool-settings"><div class="colors" aria-label="분필 색상">${colors.map((c, i) => `<button class="color ${i === 0 ? 'active' : ''}" style="--color:${c}" data-color="${c}" aria-label="${['흰색', '연분홍', '연노랑', '하늘색'][i]} 분필" aria-pressed="${i === 0}"></button>`).join('')}</div></div>`,
    `style="--w:286px"`,
  )}
  ${win('mines', '지뢰찾기', 'mines', '<div id="mines-content"></div>')}
  ${win('settings', '설정', 'run', '<div class="language-dialog"><div class="language-intro"><span class="run-dialog-icon"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M4 13h37l-7 25H1z" fill="#fffbe7" stroke="#314e75" stroke-width="2"/><path d="M8 9h37l-5 9H5z" fill="#adc6e4" stroke="#476890"/><path d="M10 12h25" stroke="white" stroke-width="2"/><path d="m10 21 25 0-3 12H7z" fill="#fff" stroke="#7c91a6"/><path d="m3 15-2 7m-1 4h7" stroke="#daa71f" stroke-width="3"/></svg></span><p>표시할 언어를 선택하세요.</p></div><label for="game-language">언어:</label><select id="game-language"><option value="en">ENGLISH</option><option value="ko">한국어</option></select><p id="language-tip" hidden>표시할 언어를 선택하세요.</p><div class="language-actions"><button class="classic" id="language-apply" data-win="close">확인</button><button class="classic" id="language-cancel" data-win="close">취소</button></div></div>', 'style="--w:360px"')}
  ${win('note', '제목 없음 - 메모장', 'note', '<nav class="menu"><button id="note-font">글자 크기</button></nav><textarea id="note" class="note-area" spellcheck="false" aria-label="메모장">안냐세욤 슈퍼짱의 컴퓨터에욬&gt;_&lt;///</textarea>')}
  ${win('stickers', '스티커', 'sticker', '<div class="window-body"><div class="sticker-grid" id="sticker-grid"></div></div><footer class="status"><span id="sticker-status">21개 항목</span></footer>', `style="--w:280px;--h:520px"`)}
  ${win('gallery', '내 사진', 'pictures', '<div class="address">주소<span>내 문서 \\ 내 사진</span></div><div class="gallery" id="gallery"><p class="empty">저장한 그림이 없습니다.</p></div>')}


  ${win('recycle', '휴지통', 'recycle', '<div class="recycle-body" id="recycle-body"></div>', `style="--w:300px;--h:260px"`)}
  <section class="window" id="ad-window" data-app="ad" hidden><button class="ad-close" data-win="close" aria-label="닫기">×</button><a class="ad-body" target="_blank" rel="noopener noreferrer"></a></section>
  ${win('prize', '망치 획득?!', 'game', '<div class="hammer-prize"><strong>망치 획득?!</strong><img src="' + A.tools.hammer + '" alt="망치"><p>축하합니다!<br>이 컴퓨터는 이제 당신의 것입니다.</p><button class="classic" data-win="close">확인</button></div>', 'style="--w:350px;--h:350px"')}
  ${win('error', '소녀의 방.exe', 'game', '<div class="error-content"><span class="error-icon">×</span><p id="error-message"></p></div><div class="dialog-actions"><button class="classic" id="retry-game">다시 시도</button> <button class="classic" id="error-ok">확인</button></div>')}
  ${win('help', '도움말', 'computer', '<div class="window-body help-body"><p>내가 조아하는 도구로 아무거나 그려보세여</p><p>그림 싹 지우고싶으면 새 화면을 눌르거나 컴퓨터끄기 하세요.</p></div>', `style="--w:350px;--h:190px"`)}
  ${win('photo-viewer','사진 보기','pictures','<nav class="menu"><button id="photo-download">파일 저장</button></nav><div class="photo-preview"><img id="photo-preview-image" alt=""></div>', 'style="--w:720px;--h:540px"')}
  </div><footer id="taskbar"><button class="start" id="start">${icon('flag')}시작</button><div id="tasks"></div><span class="input-language" aria-hidden="true">A</span><div class="tray"><span id="save-light" class="save-light" hidden></span><span class="tray-icon" title="보안 센터">${icon("security")}</span><span class="tray-icon" title="컴퓨터 보호">${icon("safe")}</span><button id="sound" title="소리 끄기" aria-label="소리 끄기" aria-pressed="false">${icon("volume")}</button><span class="tray-icon" title="하드웨어 안전하게 제거">${icon("usb")}</span><time id="clock"></time></div></footer>
  <section id="start-menu" hidden><header class="user-head"><img src="${A.portraits[0]}" alt=""><span>슈퍼짱</span></header><div class="start-columns"><div><button data-open="gallery">${icon(apps.gallery.icon)}${apps.gallery.name}</button><div class="start-game-entry"><button data-flyout aria-expanded="false" aria-controls="mines-submenu">${icon('gamesFolder')}게임 <b>▶</b></button><div class="xp-flyout" id="mines-submenu" hidden><button data-open="mines">${icon('mines')}지뢰찾기</button></div></div><div class="programs-entry"><button data-flyout aria-expanded="false" aria-controls="games-menu"><span>모든 프로그램(P)</span><img class="program-arrow" src="${A.xpIcons.programArrow}" alt="" aria-hidden="true"></button><div class="xp-flyout" id="games-menu" hidden>${['gallery','settings','mines','note','tools','stickers','capture','bot','recycle','secret','help'].map(id=>`<button data-open="${id}">${icon(apps[id].icon)}${apps[id].name}</button>`).join('')}</div></div></div><div>${['settings'].map((id) => `<button data-open="${id}">${icon(apps[id].icon)}${apps[id].name}</button>`).join('')}</div></div><footer class="start-footer"><button data-action="shutdown">${icon('shutdown')}컴퓨터 끄기(U)</button></footer></section><div id="toast" class="toast" role="status" hidden></div><img id="tool-cursor" alt=""><section id="blue-screen" hidden aria-label="Windows stop error"><pre>A problem has been detected and Windows has been shut down to prevent damage
to your computer.

UNMOUNTABLE_BOOT_VOLUME

If this is the first time you've seen this Stop error screen,
restart your computer. If this screen appears again, follow
these steps:

Check to make sure any new hardware or software is properly installed.
If this is a new installation, ask your hardware or software manufacturer
for any Windows updates you might need.

If problems continue, disable or remove any newly installed hardware
or software. Disable BIOS memory options such as caching or shadowing.
If you need to use Safe Mode to remove or disable components, restart
your computer, press F8 to select Advanced Startup Options, and then
select Safe Mode.

Technical information:

*** STOP: 0x000000ED (0x823A8900, 0xC0000006, 0x00000000, 0x00000000)
</pre></section><div id="boot"><img src="assets/boot.gif" alt="Windows XP 시작 중"></div>`;

  return { apps, toolNames, colors, icon };
};
