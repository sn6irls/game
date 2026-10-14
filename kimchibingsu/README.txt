bishoujo kimchibingsu maker

김치 → 백김치 → 김치 순서로 만드는 모바일 3D 빙수 게임입니다.
기계는 최신 bingsu_1.glb, 재료는 kimchi1.glb, kimchi2.glb를 사용합니다.
새 bingsu-machine.glb를 원본 그대로 읽고, 뚜껑·양갈래의 회전축만 실행 중에 연결합니다.
desk.glb와 plane.glb는 Blender의 위치·크기·원본 텍스처를 유지합니다.
TV·선풍기·달력·책·리모컨은 plane.glb에 포함된 방 배경입니다.
그릇은 별도로 제공된 assets/models/bowl.glb를 직접 불러옵니다.
소스통은 sauce1.glb(김치), sauce2.glb(백김치)의 원본 모델과 라벨을 사용합니다.
소스통은 처음에는 숨겨져 있고, 소스 붓기 단계부터 등장합니다.
모델의 텍스처는 GLB 안에 포함되어 있으며 외부 CDN이나 API가 필요하지 않습니다.
기계·김치·그릇은 같은 모델 배율을 사용하며, 재료 투입·그릇 이동 중 크기를 바꾸지 않습니다.
모든 카메라는 정투영입니다. 완성 화면은 그릇만 별도 정투영으로 가까이 보여줍니다.
완성된 그릇은 화면 아래에 배치해 뒤쪽 기계의 눈과 안경도 보이게 합니다.
화면은 기본 sRGB 출력이며 톤매핑, 안개, 스캔라인, 비네트, 강제 픽셀 확대를 사용하지 않습니다.
조명은 중립색이고, 모델의 원본 텍스처와 재료별 색상은 유지합니다. 테스트 전용 DOM 상태값은 배포 코드에 포함하지 않습니다.
그릇은 bowl.glb의 형상과 재질을 유지합니다. 얼음은 둥근 꼭대기의 산 모양이며,
얼음 가장자리는 그릇의 꽃잎을 따라가지 않는 원형이며, 끝부분이 둥글게 내려가 그릇 안쪽에 모입니다.
머리카락은 원본 GLB의 unlit 재질과 UV를 유지하며, 부드러운 텍스처 필터를 사용합니다.
눈은 모델에 포함된 bingsugirl.png의 감은 눈 그림을 사용해 불규칙한 간격으로 깜빡입니다.

플레이
 touch to start → 뚜껑 터치 → 떠 있는 김치 터치 → 뚜껑 터치
 → 오른쪽 양갈래를 위아래로 드래그 → 빙수에 소스 그리기 → 완성
김치는 빨간 조각에 초록 조각 4개를 섞습니다. 백김치는 초록·노랑 조각에 빨간 조각 3개를 섞습니다.
같은 색 배합의 조각이 얼음과 함께 떨어지며, 완성된 조각의 위치는 매번 무작위로 배치됩니다.
완성된 그릇을 드래그하면 회전합니다. save로 현재 각도를 저장하고,
re?로 얼음을 한 번에 던진 뒤 다음 재료로 다시 시작합니다.
키보드: 게임 화면에서 Enter/Space, 갈기는 위/아래 방향키,
완성 후 방향키로 회전. 선택지에서는 Tab 또는 방향키로 이동합니다.

폴더
index.html          게임 진입 화면
assets/models/      기계·김치·백김치·그릇·소스통 2종·책상·방 배경 (텍스처 포함)
assets/fonts/       한국어 도트 글꼴
assets/sound/       사용자 제공 효과음 9종 (원본 MP3)
src/game.js         조작, 빙수·소스, 카메라, 게임 진행
src/models.js       모델 로딩 및 크기/재질 설정
src/bowl-fit.js     원본 그릇의 안쪽 테두리 측정
src/seasoning.js    빨강·초록 양념 조각과 작은 반짝임
src/room.js         원본 책상·방 배경 배치
src/sound.js        터치 후 재생되는 효과음
styles/game.css     모바일 배치와 레트로 선택지
vendor/three/       Three.js r180 및 GLTFLoader
licenses/           Three.js와 NeoDunggeunmo 라이선스
tools/              로컬 미리보기, 파일 검사, GLB에 회전축 연결

효과음
shavekimchi는 갈기 세기에 맞춰 기존 얼음 소리와 함께 반복 재생됩니다.
sauce1과 sauce2는 재료와 관계없이 새로 누를 때마다 1 → 2 → 1 순서로 번갈아 재생됩니다.
한 번 누른 동안에는 처음 한 번만 재생됩니다.
누르고 있는 동안 기존 소스 소리는 계속되고, 손을 떼면 다음 푸슉 소리를 낼 수 있습니다.
openlid / Close lid / putinkimchi / end는 각 동작의 기존 효과음을 대체합니다.
그릇 이동·완성 화면·원래 자리로 복귀할 때 bowl1과 bowl2를 순서대로 번갈아 재생합니다.
빙수를 던지는 순간에는 기존 얼음 날리는 소리만 재생되고 그릇 소리는 나지 않습니다.
완성 후 그릇을 직접 돌릴 때에는 효과음이 나지 않습니다.
시작 화면을 터치하면 오디오가 활성화되며, 화면을 벗어나면 재생이 일시 정지됩니다.

로컬 미리보기
Node.js가 설치된 컴퓨터에서 이 폴더를 터미널로 열고 실행합니다.
  node tools/server.cjs
  http://127.0.0.1:4173/
이 주소는 현재 컴퓨터의 미리보기 주소이며, 공개 배포 주소가 아닙니다.
GLB를 불러오므로 index.html을 더블클릭하는 대신 서버로 열어 주세요.
  node tools/check.mjs
명령으로 모듈 문법, 파일 경로, 모델 무결성을 검사할 수 있습니다.

GitHub Pages
이 폴더의 index.html과 assets, src, styles, vendor, licenses, .nojekyll을
같은 위치 관계로 올리면 됩니다. 별도의 빌드나 서버 실행은 필요 없습니다.
모든 웹 경로가 상대 경로라 저장소 하위 주소에서도 동작합니다.
 tools, package.json, README.txt는 개발용이며 게임 실행에는 필요하지 않습니다.

모델 수정
  node tools/prepare-model.mjs "원본 bingsu_1.glb 경로"
원본 GLB는 bingsu-machine.glb로 복사하면 실행 중 회전축이 연결됩니다.
위 도구는 회전축을 파일에 미리 저장할 때만 필요하며 모델·UV·재질·이미지는 보존합니다.
예전 bingsu.blend로 다시 내보내지 마세요. 좌우 머리카락의 UV와 모델 형태가 다릅니다.
김치 파일은 kimchi1.glb → assets/models/kimchi.glb,
kimchi2.glb → assets/models/baekkimchi.glb입니다.
bowl.glb는 원본 그대로 assets/models/bowl.glb에 넣습니다. 기계에 포함된 예전 그릇은 표시하지 않습니다.
sauce1.glb와 sauce2.glb도 원본 그대로 assets/models/에 넣습니다. 노즐 끝을 기준으로 이동·회전하고, 짜는 동안 몸통의 넓은 구간이 납작하게 눌렸다가 돌아옵니다.

글꼴 출처: https://github.com/neodgm/neodgm-webfont
