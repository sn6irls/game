// ============================================================
//  SNG:OS 가벼운 다국어 레이어 (한국어 / English)
//  외부 번역 라이브러리 없이 textContent만 바꾸므로 성능 부담이 거의 없습니다.
// ============================================================
const I18N = (() => {
  const dictionaries = {
    ko: {
      loading: 'loading...', loadingSub: 'TWO USERS · ONE SAVE FILE',
      start: '▶ 게임 시작', soundNotice: '🔊 사운드가 함께 재생됩니다',
      theme: '🪟 버전 바꾸기', webEnter: '🖥️ SNG:OS 입장', muteTitle: '소리 켜기/끄기',
      controls: '이동: WASD · 바닥 클릭 · 마우스 드래그 · ESC 닫기',
      osExit: '× 웹사이트 끄기', close: '닫기', closeEverything: '모두 닫기',
      menuShorts: '📺 모먼트 팝업', menuGames: '🕹️ 미니게임', menuWebcam: '📹 시그널 부스',
      menuDiary: '📖 방명록', menuSettings: '⚙️ 설정', menuMute: '🔊 소리 켜기/끄기', taskStart: '시작',
      iconShorts: 'moments', iconGames: 'games', iconDiary: '방명록', iconBooth: 'signal booth',
      iconFriends: 'users', iconNews: 'archive', iconSettings: '설정',
      iconPlaylist: 'playlist', iconWebcam: 'live cam',
      gamesTitle: '🕹️ 게임팩 보관함',
      runnerName: '버블 러너', runnerDesc: '점프 액션', boothName: '시그널 부스', boothDesc: '웹 안에서 찰칵',
      soonName: 'EMPTY SLOT', soonDesc: '새 게임을 넣는 자리', soonToast: '빈 슬롯이야. 다음 게임팩을 기다리는 중!',
      gameHintRhythm: 'D F J K 또는 레인 클릭 · 콤보를 쌓아 FEVER', gameHintRunner: '스페이스바 또는 클릭으로 점프',
      popout: '↗ 새 창', popoutTitle: '별도 창에서 실행',
      webcamTitle: '📹 signal booth · {name} <span class="rec">● LIVE</span>',
      capture: '📸 순간 저장', captureAgain: '📸 다시 찍기', download: '💾 이미지 저장', captureReady: '슈퍼노마 모먼트를 붙잡았어!',
      taskTitle: '📊 S/N METER', followers: '💌 Signals', visitSince: '접속 {count}회 · since 2026',
      newsTitle: '📢 archive', friendsTitle: '👭 user files', hereNow: '지금 접속 중', sayOne: '한마디',
      settingsTitle: '⚙️ SYSTEM SETTINGS', settingsLanguage: 'LANGUAGE / 언어',
      settingsDesc: '컴퓨터 화면의 언어를 바꿀 수 있어요.',
      settingsSaved: '언어 설정을 저장했어요.', korean: '한국어', english: 'English',
      settingsPerformance: '성능 / PERFORMANCE', liteName: '저사양 모드',
      liteDesc: '배경 눈동자 움직임을 쉬게 해요.',
      liteOn: '켜짐 (가볍게)', liteOff: '꺼짐 (예쁘게)', liteSaved: '저사양 모드를 바꿨어요.',
      settingsDesktop: '바탕화면',
      iconsTidy: '아이콘 처음 자리로',
      iconsTidyDesc: '아이콘은 끌어서 원하는 자리에 놓을 수 있어요. 새로고침하면 원래 배치로 돌아갑니다.',
      iconsTidyDone: '아이콘을 처음 자리로 돌려놨어요.',
      diaryReadonly: '이 방명록은 전시장 컴퓨터에서만 작성할 수 있어요. 방문해줘서 고마워요! 💌',
      diaryExport: '📤 백업 내보내기', diaryExported: '방명록을 guestbook.json으로 저장했어요.',
      diaryTitle: '방명록 - 메모장', diaryQuestion: '왔다 간 흔적을 남겨주세요 ♡',
      diaryStateLabel: '지금의 나는', diaryStateSupa: 'SUPA — 뭐든 크게 느끼는 중',
      diaryStateNoma: 'NOMA — 조용히 버티는 중', diaryStateBetween: 'S/N — 그 사이 어딘가',
      diaryName: '닉네임', diaryMessage: '메모를 남겨주세요.', diarySave: '저장',
      diaryLocal: '이 브라우저에 저장됩니다.', diaryArchive: '일촌들이 남긴 말',
      diaryEmpty: '아직 아무도 안 다녀갔어요. 1빠 하실래요?', deleteEntry: '이 기록 지우기',
      stateSupa: 'SUPA', stateNoma: 'NOMA', stateBetween: 'S/N',
    },
    en: {
      loading: 'loading...', loadingSub: 'TWO USERS · ONE SAVE FILE',
      start: '▶ ENTER THE ROOM', soundNotice: '🔊 Sound starts with the room',
      theme: '🪟 SWITCH USER', webEnter: '🖥️ ENTER SNG:OS', muteTitle: 'Sound on/off',
      controls: 'MOVE: WASD · floor click · mouse drag · ESC to close',
      osExit: '× EXIT WEBSITE', close: 'Close', closeEverything: 'Close Everything',
      menuShorts: '📺 MOMENT POPUPS', menuGames: '🕹️ MINI GAMES', menuWebcam: '📹 SIGNAL BOOTH',
      menuDiary: '📖 GUESTBOOK', menuSettings: '⚙️ SETTINGS', menuMute: '🔊 SOUND ON/OFF', taskStart: 'start',
      iconShorts: 'moments', iconGames: 'games', iconDiary: 'Guestbook', iconBooth: 'signal booth',
      iconFriends: 'users', iconNews: 'archive', iconSettings: 'settings',
      iconPlaylist: 'playlist', iconWebcam: 'live cam',
      gamesTitle: '🕹️ GAME PACK ARCHIVE',
      runnerName: 'BUBBLE RUNNER', runnerDesc: 'jump action', boothName: 'SIGNAL BOOTH', boothDesc: 'snap inside the OS',
      soonName: 'EMPTY SLOT', soonDesc: 'drop a new game here', soonToast: 'This slot is empty. A new game pack can go here.',
      gameHintRhythm: 'D F J K or click a lane · build a combo for FEVER', gameHintRunner: 'Press Space or click to jump',
      popout: '↗ POP OUT', popoutTitle: 'Run in a separate window',
      webcamTitle: '📹 signal booth · {name} <span class="rec">● LIVE</span>',
      capture: '📸 CAPTURE MOMENT', captureAgain: '📸 RETAKE', download: '💾 SAVE IMAGE', captureReady: 'Your supernormal moment is ready!',
      taskTitle: '📊 S/N METER', followers: '💌 Signals', visitSince: '{count} visits · since 2026',
      newsTitle: '📢 archive', friendsTitle: '👭 user files', hereNow: 'online now', sayOne: 'message',
      settingsTitle: '⚙️ SYSTEM SETTINGS', settingsLanguage: 'LANGUAGE',
      settingsDesc: 'Change the computer interface language.',
      settingsSaved: 'Language setting saved.', korean: '한국어', english: 'English',
      settingsPerformance: 'PERFORMANCE', liteName: 'Lite mode',
      liteDesc: 'Pause eye tracking and cursor sparkles.',
      liteOn: 'ON (lighter)', liteOff: 'OFF (prettier)', liteSaved: 'Lite mode updated.',
      settingsDesktop: 'Desktop',
      iconsTidy: 'Reset icon spots',
      iconsTidyDesc: 'Drag icons anywhere you like. A refresh puts them back where they started.',
      iconsTidyDone: 'Icons are back where they started.',
      diaryReadonly: 'This guestbook can only be written on the exhibition computer. Thanks for visiting! 💌',
      diaryExport: '📤 Export backup', diaryExported: 'Saved the guestbook as guestbook.json.',
      diaryTitle: 'Guestbook - Notepad', diaryQuestion: 'What ordinary moment felt strangely special today?',
      diaryStateLabel: 'CURRENT SIGNAL', diaryStateSupa: 'SUPA — feeling everything at full volume',
      diaryStateNoma: 'NOMA — quietly getting through it', diaryStateBetween: 'S/N — somewhere in between',
      diaryName: 'nickname', diaryMessage: 'Write down what happened and how it felt…', diarySave: 'Save',
      diaryLocal: 'Saved only in this browser for now.', diaryArchive: 'GUESTBOOK ENTRIES',
      diaryEmpty: 'No entries yet. Leave the first supernormal moment.', deleteEntry: 'Delete this entry',
      stateSupa: 'SUPA', stateNoma: 'NOMA', stateBetween: 'S/N',
    },
  };

  //  저장소가 막혀 있어도(사생활 보호 모드 등) 한국어로 그냥 시작합니다
  let language = Util.store.get('computer-language', 'ko');
  if (!dictionaries[language]) language = 'ko';

  function t(key, vars = {}) {
    if (!key) return '';
    const raw = dictionaries[language][key] ?? dictionaries.ko[key] ?? key;
    const box = (vars && typeof vars === 'object') ? vars : {};
    return Object.entries(box).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), raw);
  }

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.documentElement.lang = language === 'en' ? 'en' : 'ko';
  }

  function set(next) {
    if (!next || !dictionaries[next]) return;
    language = next;
    Util.store.set('computer-language', next);
    apply();
    dispatchEvent(new CustomEvent('computer-language-change', { detail: { language } }));
  }

  const locale = () => language === 'en' ? 'en-US' : 'ko-KR';
  const init = () => apply();
  return { t, set, get: () => language, locale, apply, init };
})();

I18N.init();
