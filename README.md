# Earthquake data platform

정적 HTML/CSS/JS 지진 데이터 사이트. 1900년부터의 지진 카탈로그를 3D 지구본과
2D 지도로 보여주고, 최근 14일치는 30분마다 USGS 에서 다시 받아온다.

## 페이지 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 랜딩 |
| `app.html` | 통합 콘솔 (아래 페이지들을 iframe 으로 띄운다) |
| `map.html` | 라이브 지도 (Leaflet 2D + Three.js 3D) |
| `dashboard.html` | 24h 통계, 시간대별 차트, 규모 분포, 미니 지도 |
| `insights.html` | 추이 · 규모-빈도 · 깊이 · 에너지 · 지역 핫스팟 |
| `research.html` | 논문 목록 (자동 수집) |
| `news.html` | 지진 뉴스 (자동 수집) |
| `learn.html` | 지진 기초 · 판구조론 · 규모와 진도 · 안전 가이드 |
| `3d/index.html` | Three.js 3D 엔진 (단독 실행도 가능) |

## 실행 방법

빌드 과정이 없다. 정적 파일을 그대로 열면 된다.

```
node serve.js        # http://localhost:8642
```

`file://` 로 직접 열면 fetch 가 막혀 데이터가 안 뜬다. 로컬 서버로 열 것.

## 데이터

모든 통계·차트·지도는 `3d/data/global/` 의 **실제 전세계 지진 카탈로그**
(USGS ANSS ComCat + ISC Bulletin, 중복 제거, 1900~현재, 약 297만 건)를 쓴다.
`js/data.js` 가 M4+ 밴드(약 13MB)를 파싱해 최근 120일 이벤트를 공급하고,
규모-빈도 곡선은 전체 카탈로그로 계산한다. 라이브 지도만 M2+ 전 밴드(약 59MB)를
받는다.

1900년부터의 아카이브 자체는
[earthquake-layer-3d](https://github.com/parkman00771188/earthquake-layer-3d) 의
업데이트 파이프라인(update.bat)으로 오프라인에서 다시 만들어 `3d/` 에 넣는다.

### 25 MiB 넘는 파일

호스팅에 따라 자산 하나가 25 MiB 를 넘으면 배포가 거부된다. 여기 해당하는 게 둘이다.

```
3d/data/quakes.bin              34.2 MiB
3d/data/global/quakes-m3.bin    28.1 MiB
```

그래서 올라가는 건 원본이 아니라 `scripts/split_bins.py` 가 만든 `.part0`,
`.part1` 조각들이고, 매핑은 `3d/data/parts.json` 에 있다. 로더 세 곳
(`js/data.js`, `3d/js/data.js`, `3d/js/globe.js`)이 그 파일을 보고 URL 을 정해
받아서 이어 붙인다. 매니페스트에 없는 이름은 예전처럼 통째로 받으므로, 제한이
없는 호스팅에서도 그대로 돌아간다.

원본은 로컬에만 두고 `.gitignore` 로 뺀다. 파이프라인으로 바이너리를 새로 만들어
넣었으면 다시 한 번 돌리면 된다.

```
python scripts/split_bins.py
```

## 자동 업데이트 (30분 주기, 로컬 PC)

수백만 행짜리 바이너리를 30분마다 다시 올릴 수는 없으므로 **최근 14일치만**
갱신한다. 이 PC 의 작업 스케줄러가 돌린다.

| 파일 | 역할 |
|---|---|
| `auto_update_start.bat` | 30분 주기 예약 작업 등록 + 첫 사이클 즉시 실행 |
| `auto_update_stop.bat` | 예약 작업 해제 |
| `auto_update_run.bat` | 한 사이클 수동 실행 |
| `scripts/run_hidden.vbs` | 창이 뜨지 않게 감싸는 실행기 |
| `scripts/auto_update.py` | 사이클 본체: 확인 → 갱신 → 커밋 → push |
| `scripts/update_live_data.py` | USGS ComCat 에서 최근 14일(M2.0+) 수집 |
| `scripts/update_content.py` | 뉴스 · 논문 수집 |
| `scripts/logs/auto_update.log` | 실행 기록 (git 에 올라가지 않음) |

**한 사이클이 하는 일**

1. USGS 에 **최신 20건**만 물어보고 그중 **최신 5건**을 기존 스냅샷과 대조한다.
2. 5건이 전부 이미 있으면 → **거기서 끝.** 내려받지도, 커밋하지도 않는다.
3. 새 지진이 있으면 최근 14일을 다시 받아 `3d/data/live/{global,japan}.json` 을
   덮어쓴다.
4. 이어서 뉴스와 논문도 확인해 새 것만 `data/` 에 더한다.
5. 셋 중 하나라도 바뀌었으면 **그 파일들만** 커밋해서 push 한다. 작업 폴더의
   다른 수정 사항이나 스테이징해 둔 파일은 건드리지 않는다.

하루 48번 도는 만큼, 직전 커밋이 스크립트가 만든 커밋이면 그 위에 쌓지 않고
**교체**한다(`--amend` + `--force-with-lease`). 사람이 직접 만든 커밋은 절대
교체하지 않는다.

동시 실행은 `%TEMP%\wel_auto_update.lock` 으로 막고, 25분 넘은 잠금은 중단된
사이클로 보고 정리한다. PC 가 꺼져 있거나 로그아웃이면 그 회차는 건너뛴다.

### 뉴스 · 논문

지진 카탈로그는 매번 최근 14일을 통째로 덮어쓰지만, 뉴스와 논문은 그럴 수 없다.
원본 API 가 "지금까지의 주요 기사/논문"을 한 번에 주지 않기 때문에 `data/` 아래에
**쌓아 간다.**

| 파일 | 출처 | 최초 수집 | 이후 매 사이클 |
|---|---|---|---|
| `data/papers.json` | OpenAlex 토픽 T13018 (Seismology and Earthquake Studies) | 최근 10년 피인용 상위 200편 | 최신 + 아직 안 본 다음 페이지 |
| `data/news.json` | Google News RSS + ScienceDaily 지진 피드 | 큰 지진 관련 검색어 8종 | 최신 + 검색어 하나씩 번갈아 |

이미 있는 항목은 버리고 **새 것만** 더하며, 새로 더한 게 없으면 파일을 건드리지
않는다. 각각 300건에서 오래된 것부터 밀어낸다. 키가 필요한 API 는 쓰지 않는다.

`research.html` 의 Featured Publications 와 `news.html` 의 피드가 이 두 파일을
직접 읽는다.

## 브라우저 쪽 데이터 병합

아카이브는 오프라인에서만 다시 만들어지므로, 최근 14일 오버레이를 브라우저에서
아카이브 위에 얹는다. 두 카탈로그가 이걸 다르게 쓴다.

- **전세계**: 오버레이의 `window_start` 를 이음매로 삼아 아카이브의 꼬리를
  **교체**한다. ISC 게시는 2년가량 늦어서 최근 2주 구간은 어차피 USGS 자료이므로,
  교체하면 수정된 규모와 취소된 이벤트까지 반영된다.
  (`js/data.js`, `3d/js/globe.js`)
- **일본**: 아카이브 마지막 발생시각 **이후만 추가**한다. 일본의 최근 구간은 USGS 가
  아예 싣지 않는 JMA 행이 대부분(2주에 JMA 약 100건 : USGS 약 40건)이라 교체하면
  갱신되는 양보다 지워지는 양이 더 많다. (`3d/js/data.js`)

2D 페이지는 5분마다 오버레이를, 10분마다 아카이브 `meta.json` 을 확인해 갱신되면
다시 불러온다. 오버레이 파일이 없어도 아카이브만으로 정상 동작한다.

## 배포

정적 파일이라 어디에 올려도 된다. 도메인 연결과 robots/sitemap 생성은 스크립트에
들어 있다.

```
python scripts/link_domain.py         # DNS 확인만
python scripts/link_domain.py --apply # DNS 가 맞으면 호스팅 설정까지
python scripts/build_seo.py           # robots.txt + sitemap.xml 재생성
```

각 페이지 `<head>` 에 description · canonical · Open Graph 가 들어 있다.
canonical 이 특히 중요하다 — 콘솔이 하위 페이지를 iframe 으로 부를 때 `?embed=1`
이 붙어서 같은 내용이 두 주소로 존재하는데, canonical 이 깨끗한 주소로 신호를
모아 준다.

## 광고

게재 위치는 두 곳이고 둘이 동시에 뜨지 않는다.

| 위치 | 보이는 조건 |
|---|---|
| 콘솔 사이드바 하단 300×250 | 넓은 화면 |
| 화면 하단 앵커 320×50 (닫기 가능) | ≤760px |

폰에서는 사이드바가 드로어라 그 광고는 서랍을 열 때만 보인다. 그래서 그 폭에서는
하단 앵커가 대신 뜬다. 앵커는 **최상위 문서에만** 붙는다 — 콘솔 안 iframe 에도
붙으면 앵커가 두 겹이 된다. 같은 이유로 각 페이지 `<head>` 에 iframe 안일 때 광고
요청을 멈추는 가드가 있다.

두 자리 모두 광고 단위 ID 가 있어야 채워진다. `js/common.js` 의 `AD` 객체 한 곳에
넣으면 된다. 비어 있는 동안에는 채워질 수 없는 `<ins>` 를 밀어 넣지 않는다.

## 모바일

폰에서는 콘솔 사이드바가 **햄버거 드로어**로 바뀌고(≤760px), 태블릿(761~860px)에서는
아이콘 레일을 유지한다. 지도 위 범례는 접히는 버튼이 되고, 스크러버 · 줌 · 레이어
컨트롤은 서로 겹치지 않는 자리로 간다.

가로 스크롤이 생기는 근본 원인은 브레이크포인트가 아니라 **grid/flex 항목의
`min-width: auto`** 였다 — 차트 캔버스 하나가 트랙 전체 폭을 682px 로 고정해서
문서를 옆으로 밀어냈다. 360 / 390 / 768 / 1440px 에서 가로 오버플로 0px 를 확인했다.

## 구조

```
css/style.css     전체 스타일 (디자인 토큰, 컴포넌트, 반응형)
js/common.js      공통 헤더/푸터, 아이콘, 광고 배치
js/data.js        실 카탈로그 로더(밴드 파싱 + 라이브 오버레이 병합) + 집계 함수
js/map.js         라이브 지도 로직
js/dashboard.js   대시보드 차트/통계
js/insights.js    인사이트 차트 + CSV 다운로드
js/news.js        뉴스 피드
js/research.js    논문 목록
3d/js/            Three.js 엔진 (globe, quakeLayer, timeline, feed …)
3d/js/theme.js    씬 팔레트 (다크 기본 / 라이트) — 레이어 패널의 "밝은 배경"
3d/js/chunks.js   25 MiB 초과 파일 조각 이어붙이기
3d/js/live.js     최근 14일 오버레이 로더
scripts/          자동 업데이트 · 콘텐츠 수집 · 파일 분할 · 배포 스크립트
data/             news.json, papers.json (30분마다 누적)
```
