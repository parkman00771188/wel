# World Earthquake Labs

실시간 지진 데이터 플랫폼 데모 웹사이트 (정적 HTML/CSS/JS).

## 페이지 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 메인 랜딩 (히어로 배너, 미션, 플랫폼 소개) |
| `map.html` | 라이브 지진 지도 (Leaflet, 시간 필터/재생, 이벤트 카드, 최근 지진 테이블) |
| `dashboard.html` | 대시보드 (24h 통계, 시간대별 차트, 규모 분포 도넛, 미니 지도, 시스템 상태) |
| `insights.html` | 세부 분석 (추이·규모-빈도·깊이·에너지 차트, 지역 핫스팟, 모델 성능) |
| `research.html` | 리서치 허브 (논문, 데이터셋, 리소스) |

## 실행 방법

빌드 과정 없이 바로 열 수 있습니다.

- 가장 간단하게: `index.html` 을 브라우저로 열기 (더블클릭)
- 또는 로컬 서버: 프로젝트 폴더에서
  ```
  npx serve .
  ```

지도 타일(Esri), 차트 라이브러리(Chart.js), 폰트(Google Fonts)는 CDN에서 로드되므로
인터넷 연결이 필요합니다.

## 데이터 (실데이터)

모든 통계·차트·지도는 [`3d/data/global/`](3d/data/global/)의 **실제 전세계 지진 카탈로그**
(USGS ANSS ComCat + ISC Bulletin, 중복 제거, 1900~현재, 약 297만 건)를 기반으로 합니다.
`js/data.js`가 M4+ 밴드(quakes-m4/m5.bin, 약 13MB)를 파싱해 최근 120일 이벤트를 페이지에
공급하고, 규모-빈도 곡선은 전체 카탈로그로 계산합니다. 1900년부터의 아카이브 자체는
[earthquake-layer-3d](https://github.com/parkman00771188/earthquake-layer-3d) 저장소의
업데이트 파이프라인(update.bat)으로 오프라인에서 다시 만들어 `3d/` 폴더에 넣습니다.

## 자동 업데이트 (30분 주기, 이 PC에서)

수백만 행짜리 바이너리를 30분마다 다시 올릴 수는 없으므로 **최근 14일치만** 갱신합니다.
[earthquake-layer-3d](https://github.com/parkman00771188/earthquake-layer-3d) 의
`auto_update_*.bat` 과 같은 방식입니다 — GitHub Actions 가 아니라 이 PC의 작업
스케줄러가 돌립니다.

| 파일 | 역할 |
|---|---|
| `auto_update_start.bat` | 30분 주기 예약 작업 등록 + 첫 사이클 즉시 실행 |
| `auto_update_stop.bat` | 예약 작업 해제 (이미 만들어진 커밋은 그대로) |
| `auto_update_run.bat` | 한 사이클 수동 실행 (더블클릭 가능) |
| `scripts/run_hidden.vbs` | 창이 뜨지 않게 감싸는 실행기 — 스케줄러가 여기를 가리킴 |
| `scripts/auto_update.py` | 한 사이클 본체: 확인 → 갱신 → 커밋 → push |
| `scripts/update_live_data.py` | USGS ComCat 에서 최근 14일(M2.0+)을 받아 스냅샷 작성 |
| `scripts/logs/auto_update.log` | 실행 기록 (git 에 올라가지 않음) |

**한 사이클이 하는 일**

1. USGS 에 **최신 20건**만 물어보고 그중 **최신 5건**을 기존 스냅샷과 대조합니다.
2. 5건이 전부 이미 있으면 → **거기서 끝.** 내려받지도, 커밋하지도, push 하지도 않습니다.
3. 새 지진이 있으면 최근 14일을 다시 받아 `3d/data/live/{global,japan}.json` 을
   덮어쓰고, **그 두 파일만** 커밋해서 push 합니다. 작업 폴더의 다른 수정 사항이나
   스테이징해 둔 파일은 건드리지 않습니다.

하루 48번 도는 만큼, 직전 커밋이 우리가 만든 `[auto]` 커밋이면 그 위에 쌓지 않고
**교체**합니다(`--amend` + `--force-with-lease`). 사람이 직접 만든 커밋은 절대
교체하지 않습니다.

동시 실행은 `%TEMP%\wel_auto_update.lock` 으로 막고, 25분 넘은 잠금은 중단된
사이클로 보고 정리합니다. PC가 꺼져 있거나 로그아웃 상태면 그 회차는 건너뜁니다
(하루 48번 중 일부라 문제되지 않습니다).

**브라우저 쪽 병합** — 두 카탈로그가 오버레이를 다르게 씁니다.

- **전세계**: 오버레이의 `window_start` 를 이음매로 삼아 아카이브의 꼬리를 **교체**합니다.
  ISC 게시는 2년가량 늦어서 최근 2주 구간은 어차피 USGS 자료이므로, 교체하면 수정된
  규모와 취소된 이벤트까지 반영됩니다. (`js/data.js`, `3d/js/globe.js`)
- **일본**: 아카이브 마지막 발생시각 **이후만 추가**합니다. 일본의 최근 구간은 USGS가
  아예 싣지 않는 JMA 행이 대부분(2주에 JMA 약 100건 : USGS 약 40건)이라 교체하면
  갱신되는 양보다 지워지는 양이 더 많습니다. (`3d/js/data.js`)

2D 페이지는 5분마다 오버레이를, 10분마다 아카이브 `meta.json` 을 확인해
**갱신되면 다시 불러옵니다.** 오버레이 파일이 없어도 아카이브만으로 정상 동작합니다.

## 3D 지도

Live Map의 **3D 버튼**은 같은 저장소의 Earthquake 4D 엔진(Three.js)을 임베드합니다
(`3d/index.html`). Region 콤보(Global/Japan)와 콘솔 언어 설정이 3D 뷰에 자동으로
동기화되며, 기간·규모·깊이 필터와 타임라인 재생은 3D 화면 안의 패널에서 조작합니다.

## 구조

```
css/style.css     전체 스타일 (디자인 토큰, 컴포넌트, 반응형)
js/common.js      공통 헤더/푸터 주입, 아이콘 세트, 토스트
js/data.js        실 카탈로그 로더(밴드 파싱 + 라이브 오버레이 병합) + 집계 함수
js/map.js         라이브 지도 로직
js/dashboard.js   대시보드 차트/통계
js/insights.js    인사이트 차트 + CSV 다운로드
resource/img/     로고, 배너 이미지
scripts/          auto_update.py (30분 사이클) + update_live_data.py (USGS 오버레이)
3d/js/live.js     오버레이 로더 (3D 전세계/일본 공용)
```
