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
공급하고, 규모-빈도 곡선은 전체 카탈로그로 계산합니다. 10분마다 meta.json을 확인해
**데이터가 갱신되면 자동으로 다시 불러옵니다** — `3d/` 폴더를
[earthquake-layer-3d](https://github.com/parkman00771188/earthquake-layer-3d) 저장소의
업데이트 파이프라인(update.bat)으로 갱신하면 사이트 전체에 반영됩니다.

## 3D 지도

Live Map의 **3D 버튼**은 같은 저장소의 Earthquake 4D 엔진(Three.js)을 임베드합니다
(`3d/index.html`). Region 콤보(Global/Japan)와 콘솔 언어 설정이 3D 뷰에 자동으로
동기화되며, 기간·규모·깊이 필터와 타임라인 재생은 3D 화면 안의 패널에서 조작합니다.

## 구조

```
css/style.css     전체 스타일 (디자인 토큰, 컴포넌트, 반응형)
js/common.js      공통 헤더/푸터 주입, 아이콘 세트, 토스트
js/data.js        모의 지진 카탈로그 생성 + 집계 함수
js/map.js         라이브 지도 로직
js/dashboard.js   대시보드 차트/통계
js/insights.js    인사이트 차트 + CSV 다운로드
resource/img/     로고, 배너 이미지
```
