/* Display-only localization. Original Korean strings stay in the game code;
   user-entered notes and form values are never translated. No reload or storage. */
window.initGameLanguage = function(root) {
  const pairs = {
    '으아아 나컴퓨터가이상해':'Aaaah, something is wrong with my computer!',
    '소녀의 방.exe':"Girl’s Room.exe",'모든 프로그램(P)':'All Programs (P)','모든 프로그램':'All Programs',
    '로그오프':'Log Off','컴퓨터 끄기(U)':'Turn Off Computer (U)','사진 보기':'Picture Viewer','내가 조아하는 도구로 아무거나 그려보세여':'Draw anything with your favorite tool.','그림 싹 지우고싶으면 새 화면을 눌르거나 컴퓨터끄기 하세요.':'To clear your picture, click New Desktop or Turn Off Computer.','컴퓨터 끄기':'Turn Off Computer','로그온':'Log On','컴퓨터 켜기':'Turn On Computer','이제 컴퓨터를 꺼도 안전합니다.':'It is now safe to turn off your computer.',
    '내 사진':'My Pictures','투명 지우개':'Transparent Eraser','프리쿠라펜':'Purikura Pen','DS 펜':'DS Pen',
    "응용 프로그램을 제대로 초기화하지 못했습니다(0xc0000142).\n응용 프로그램을 종료하려면 확인을 클릭하십시오.":"The application failed to initialize properly (0xc0000142).\nClick on OK to terminate the application.",
    "소녀의 방.exe에 문제가 발생하여 프로그램을 종료해야 합니다.\n불편을 끼쳐드려서 죄송합니다.":"Girl’s Room.exe has encountered a problem and needs to close.\nWe are sorry for the inconvenience.",
    "지정된 장치, 경로 또는 파일에 액세스할 수 없습니다.\n이 항목에 액세스할 수 있는 권한이 없는 것 같습니다.":"Windows cannot access the specified device, path, or file.\nYou may not have the appropriate permissions to access the item.",
    "0x00401000에 있는 명령이 0x00000000의 메모리를 참조했습니다. 메모리는 read될 수 없습니다.\n프로그램을 마치려면 확인을 클릭하십시오.":"The instruction at 0x00401000 referenced memory at 0x00000000. The memory could not be read.\nClick on OK to terminate the program.",
    "사진이 저장되었습니다.\n내 사진에서 다시 볼 수 있습니다.":"Your picture has been saved.\nYou can view it again in My Pictures.",

    '스티커 사진 펜':'Photo Pen','큐빅 펜':'Gem Pen',
    '스티커를 드래그해서 붙이고, 사진 펜이나 큐빅 펜으로 꾸며 보세요.':'Drag stickers onto the desktop and decorate with the Photo Pen or Gem Pen.',
    "프로그램을 시작할 수 없습니다.\n다시 시도하시겠습니까?":"The program could not start.\nWould you like to try again?",
    "응답이 없습니다.\n아이콘에서 이상한 소리가 납니다.":"Not responding.\nThe icon is making a strange noise.",
    "파일을 읽을 수 없습니다.\n무언가 떨어질 것 같습니다.":"Cannot read the file.\nSomething seems about to fall.",
    "프로그램에 금이 갔습니다.\n한 번만 더 시도해 보세요.":"The program has cracked.\nTry just one more time.",

    "도구를 선택하고 바탕화면에 사용하세요. 아이콘과 창, 스티커는 어떤 도구를 들고 있어도 옮길 수 있습니다.":"Choose a tool and use it on the desktop. You can move icons, windows and stickers with any tool selected.",
    "분필 지우개를 문지르면 낙서가 지워지고 분필가루가 튑니다. 커터칼은 배경을 긁습니다. 젤리는 위에서 철퍽 떨어져 굴러다닙니다. 잡아 늘였다 놓을 수 있습니다. 끈적한 자국은 잠시 후 사라집니다. 지우개는 더러워지면 화면에 팡팡 두 번 털어냅니다.":"Rub the chalk eraser to erase drawings. The craft knife scratches the wallpaper. Jelly drops from above; after it lands, grab it to stretch it and let go. Sticky marks fade with time. A dirty eraser taps twice against the screen. Its dust stays until your next drag.",
    "로 버릴 수 있습니다.":"to discard it.",
    "도구 내려놓기 · 숫자":"Put down tool · Keys",
    "도구 선택":"Select tool",
    "마우스 오른쪽 버튼: 도구창":"Right mouse button: Tools window",
    "새로고침하면 그림·메모·도구 상태가 모두 초기화됩니다. 보관할 그림은 바탕화면의 캡처 도구를 한 번 눌러 PNG로 저장하세요. 모바일에서는 내 그림의 저장·이미지 열기 버튼을 이용할 수 있습니다.":"Refreshing resets drawings, notes and tools. Click Capture to save a PNG. On mobile, you can also use Save PNG or Open Image in My Pictures.",
    "오후":"PM",
    "오전":"AM",
    '바탕화면 꾸미기':'Desktop Games','슈파의 컴퓨터':'Desktop Games','표시할 언어를 선택하세요.':'Select the language to use on this computer.',
    '언어:':'Language:','설정':'Settings','확인':'OK','취소':'Cancel','시작':'start','게임':'Games','솔리테어':'Solitaire','지뢰찾기':'Minesweeper',
    '내 컴퓨터':'My Computer','내 문서':'My Documents','내 그림':'My Pictures','메모장':'Notepad','제목 없음 - 메모장':'Untitled - Notepad','제목 없음':'Untitled','파일 저장':'Save File','글자 크기':'Font Size','텍스트 문서':'Text Document','새로고침하면 초기화':'Resets on refresh',
    '캡처 도구':'Capture','도구':'Tools','도움말':'Help','그림 도구':'Drawing Tools','스티커':'Stickers','슈퍼짱 봇':'superchan bot','슈파':'Supa','휴지통':'Recycle Bin','분필':'Chalk','분필 지우개':'Chalk Eraser','비눗방울':'Bubbles','젤리':'Jelly','커터칼':'Craft Knife','반짝이풀':'Glitter Glue','망치':'Hammer',
    '새 화면':'New Desktop','실행 취소':'Undo','다시 실행':'Redo','떼어 붙이기':'Peel & Stick','최소화':'Minimize','최대화':'Maximize','닫기':'Close','주소':'Address','새 게임':'New Game','깃발 모드':'Flag Mode','되돌리기':'Undo','힌트':'Hint','자동 올리기':'Auto Finish','한 장 뽑기':'Draw One','소리 설정':'Sound','소리 끄기':'Mute','소리 켜기':'Unmute','컴퓨터 다시 시작':'Restart Computer','바탕 화면 보기':'Show Desktop',
    '초급 · 9 × 9 · 지뢰 10개':'Beginner · 9 × 9 · 10 mines','초급 · 한 장 뽑기 · 무제한 다시 돌리기':'Easy · Draw one · Unlimited passes','초급 · 지뢰 10개':'Beginner · 10 mines','남은 지뢰':'Mines left','시간':'Time','성공! 지뢰를 모두 찾았어요.':'You win! All mines found.','앗, 지뢰! 웃는 얼굴을 눌러 다시 시작하세요.':'Boom! Click the face to try again.','✦ 모두 모았어요! ✦':'✦ You collected them all! ✦','한 번 더':'Play Again','그 칸에는 놓을 수 없어요.':'That card cannot go there.','지금 올릴 수 있는 카드가 없어요.':'No cards can go to the foundations yet.','왼쪽 위 카드 묶음을 눌러 보세요.':'Try drawing from the stock at the top left.','옮길 카드가 없어요. 되돌리기나 새 게임을 눌러 주세요.':'No moves left. Try Undo or New Game.',
    '카드 한 장 뽑기 / 다시 돌리기':'Draw one / Recycle stock','뽑은 카드':'Waste pile','뒤집힌 카드':'Face-down card',
    '첫 칸과 주변은 안전해요. 숫자는 주변 8칸의 지뢰 수예요. 우클릭 또는 깃발 모드로 표시하세요. 숫자 주변의 깃발 수가 맞으면 숫자를 눌러 나머지 칸을 열 수 있어요.':'The first cell and its neighbors are safe. Numbers count mines in the 8 neighboring cells. Right-click or use Flag Mode to mark mines. Click a number with the correct number of flags around it to open the remaining neighbors.',
    '왼쪽 위에서 한 장씩 뽑으세요. 아래는 빨강·검정을 번갈아 큰 수부터 작은 수로 쌓아요. 빈 칸에는 K만 놓아요. 위쪽 네 칸은 같은 무늬로 A부터 K까지 모아요. 카드를 누른 뒤 놓을 칸을 누르거나 드래그하세요.':'Draw one card from the top left. Build descending stacks in alternating red and black. Only Kings go in empty columns. Build the four foundations from Ace to King in the same suit. Tap a card then its destination, or drag it.',
    '저장한 그림이 없습니다.':'No saved pictures yet.','PNG 저장':'Save PNG','이미지 열기':'Open Image','공유 / 사진에 저장':'Share / Save to Photos','인스타그램에서 만나요 ♥':'See you on Instagram ♥','구경하기':'Visit','전단지':'Flyer','긴급!! SNG 전단지':'EXTRA!! SNG Flyer','속보! 슈파 출몰주의':'BREAKING! Supa Spotted','★ 단 독 입 수 ★':'★ EXCLUSIVE ★','※ 지나치면 후회 ※':'※ DON’T MISS OUT ※','슈파가':'Supa','또 나타났다!!':'is back again!!','심심한 사람':'Feeling bored?','전 원 집 합!!':'EVERYONE WELCOME!!','무료':'FREE','구경':'LOOK','입장료':'ENTRY','0원':'FREE',
    '★ 특별 경고 ★':'★ SPECIAL ALERT ★','망치 획득?!':'Hammer Unlocked?!','축하합니다!':'Congratulations!','이 컴퓨터는 이제 당신의 것입니다.':'This computer is yours now.','좋아, 부숴 보자!':'Let’s smash it!','다시 시도':'Retry',
    '으앗, 살살!':'Whoa, gently!','안녕! 나 여기 있을게.':'Hi! I’ll hang out here.','어디 가? 같이 가!':'Where are you going? Wait for me!','나는 여기서 놀게.':'I’ll play here.','나도 그려 볼래!':'Let me draw too!','잠깐만… 졸려…':'Just a moment… sleepy…','여기 내 그림도!':'Here’s my drawing!','젤리야, 굴러가!':'Roll, jelly, roll!','앗, 조금 지웠다!':'Oops, I erased a bit!','이 창은 이쪽으로!':'This window goes here!','어질어질…':'Dizzy…',
    '흰색':'White','연분홍':'Pastel Pink','연노랑':'Pastel Yellow','하늘색':'Sky Blue','도구 크기':'Tool Size','분필 색상':'Chalk Color','현재 세션 · 새로고침하면 초기화':'Current session · Resets on refresh',
    '스티커는 한 화면에 100장까지 붙일 수 있습니다.':'You can place up to 100 stickers.','그림을 저장하지 못했습니다.':'Could not save the picture.','그림을 준비하지 못했습니다. 다시 촬영해 주세요.':'Could not capture the picture. Try again.','이미지를 불러오지 못했습니다. 새로고침해 주세요.':'Could not load images. Please refresh.',
    '금붕어':'Goldfish','네잎클로버':'Clover','아쿠아 꽃':'Aqua Flower','초록 휴대폰':'Green Phone','아쿠아 사과':'Aqua Apple','오렌지 수족관':'Orange Aquarium','라무네':'Ramune','뮤직 CD':'Music CD','푸른 지구':'Blue Earth','소다 아이스바':'Soda Popsicle'
  };
  let lang='en';
  const originals=new WeakMap(), attrs=new WeakMap();
  const keys=Object.keys(pairs).sort((a,b)=>b.length-a.length);
    const pattern=new RegExp(keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
  function english(s) {
    if(!s.trim())return s;
    if(s!==s.trim())return s.match(/^\s*/)[0]+english(s.trim())+s.match(/\s*$/)[0];
    if(pairs[s])return pairs[s];
    const rules=[[/^(\d+)개 항목$/,'$1 items'],[/^(\d+)회 ·$/,'$1 moves ·'],[/^(\d+)초$/,'$1s'],[/^초$/,'s'],[/^(\d+)장을 올렸어요\.$/,'Moved $1 cards.'],[/^빛나는 카드를 위쪽 완성 더미로 옮겨요\.$/,'Move the highlighted card to a foundation.'],[/^빛나는 카드를 아래 (\d+)번째 더미로 옮겨요\.$/,'Move the highlighted card to column $1.'],[/^카드 더미 (\d+)$/,'Column $1'],[/^완성 더미 (\d+)$/,'Foundation $1']];
    for(const [re,to] of rules)if(re.test(s))return s.replace(re,to);
    // Longest matches first, without recursively translating the replacement.
    return s.replace(pattern,k=>pairs[k]);
  }
  function visit() {
    observer.disconnect();
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
    while((n=walker.nextNode())){
      if(n.parentElement.closest('script,style,textarea,option,[contenteditable]'))continue;
      const prior=originals.get(n);const source=prior&&n.nodeValue===prior.output?prior.source:n.nodeValue;
      const output=lang==='en'?english(source):source;if(n.nodeValue!==output)n.nodeValue=output;originals.set(n,{source,output});
    }
    for(const el of root.querySelectorAll('[title],[aria-label],[placeholder],[alt]')){
      let map=attrs.get(el)||{};
      for(const key of ['title','aria-label','placeholder','alt']){if(!el.hasAttribute(key))continue;const value=el.getAttribute(key),prior=map[key],source=prior&&value===prior.output?prior.source:value;const output=lang==='en'?english(source):source;if(value!==output)el.setAttribute(key,output);map[key]={source,output};}
      attrs.set(el,map);
    }
    document.documentElement.lang=lang;document.title=lang==='en'?'Desktop Games':'바탕화면 꾸미기';
    observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder','alt']});
  }
  const observer=new MutationObserver(visit);
  const select=root.querySelector('#game-language');
  root.querySelector('#language-help').addEventListener('click',()=>{const tip=root.querySelector('#language-tip');tip.hidden=!tip.hidden;});
  root.querySelector('#language-apply').addEventListener('click',()=>{window.XPSounds?.play('load');lang=select.value;visit();});
  root.querySelector('#language-cancel').addEventListener('click',()=>select.value=lang);
  select.value=lang;visit();
  return {sync(){select.value=lang;},get language(){return lang;}};
};


