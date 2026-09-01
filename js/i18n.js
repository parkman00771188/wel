/* World Earthquake Labs — lightweight UI translation (en / ja / ko)
   Exact text-node matches + a few pattern rules; long-form articles stay in English. */
(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var lang = params.get("lang") || (function () {
    try { return localStorage.getItem("wel-lang"); } catch (e) { return null; }
  })() || "en";
  if (["en", "ja", "ko"].indexOf(lang) === -1) lang = "en";

  window.WEL_I18N = { lang: lang };
  if (lang === "en") return;

  var IX = lang === "ko" ? 0 : 1;

  /* "English": ["한국어", "日本語"] */
  var DICT = {
    /* console shell */
    "Overview": ["개요", "概要"],
    "Live Map": ["실시간 지도", "ライブマップ"],
    "Earthquake Guide": ["지진 가이드", "地震ガイド"],
    "Seismic Insights": ["지진 분석", "地震インサイト"],
    "Research Hub": ["연구 허브", "研究ハブ"],
    "News & Updates": ["뉴스 및 업데이트", "ニュース＆更新情報"],
    "All Systems Operational": ["모든 시스템 정상", "全システム正常稼働"],
    "Dashboard Overview": ["대시보드 개요", "ダッシュボード概要"],

    /* site header (standalone pages) */
    "Platform": ["플랫폼", "プラットフォーム"],
    "Research": ["연구", "研究"],
    "Data": ["데이터", "データ"],
    "About": ["소개", "会社概要"],
    "Resources": ["리소스", "リソース"],
    "Get Started": ["시작하기", "はじめる"],
    "Insights": ["인사이트", "インサイト"],
    "News": ["뉴스", "ニュース"],
    "Built on open data from": ["오픈 데이터 출처", "オープンデータ提供元"],
    "Dashboard": ["대시보드", "ダッシュボード"],

    /* dashboard */
    "A real-time snapshot of global seismic activity and key insights.": ["전 세계 지진 활동과 핵심 인사이트를 실시간으로 요약합니다.", "世界の地震活動と主要インサイトをリアルタイムで一望できます。"],
    "Earthquakes (24h)": ["지진 횟수 (24시간)", "地震回数（24時間）"],
    "vs previous period": ["전 기간 대비", "前期間比"],
    "Period": ["기간", "期間"],
    "No events in this window.": ["이 기간에 해당하는 지진이 없습니다.", "この期間に該当する地震はありません。"],
    "Total Magnitude": ["규모 합계", "マグニチュード合計"],
    "Largest Event": ["최대 지진", "最大イベント"],
    "Stations Online": ["온라인 관측소", "稼働中の観測点"],
    "Active Alerts": ["활성 경보", "有効なアラート"],
    "96% uptime": ["가동률 96%", "稼働率 96%"],
    "vs yesterday": ["전일 대비", "前日比"],
    "Earthquakes Over Time": ["시간대별 지진 발생", "時間別の地震発生"],
    "All detected events, including micro-earthquakes": ["미소지진을 포함한 전체 관측 이벤트", "微小地震を含む全検出イベント"],
    "Worldwide M 4.0+ events · USGS + ISC": ["전 세계 M 4.0+ 지진 · USGS + ISC", "世界のM4.0以上の地震・USGS + ISC"],
    "Full catalog since 1900 (M 4+) · USGS + ISC": ["1900년 이후 전체 카탈로그 (M 4+) · USGS + ISC", "1900年以降の全カタログ（M4+）・USGS + ISC"],
    "Other regions": ["기타 지역", "その他の地域"],
    "Magnitude Distribution": ["규모 분포", "マグニチュード分布"],
    "Recent Significant Earthquakes": ["최근 주요 지진", "最近の主要地震"],
    "View all events": ["전체 이벤트 보기", "すべてのイベントを見る"],
    "Global Seismic Activity": ["전 세계 지진 활동", "世界の地震活動"],
    "(Live)": ["(실시간)", "（ライブ）"],
    "View full map": ["전체 지도 보기", "フルマップを見る"],
    "System Status": ["시스템 상태", "システム状態"],
    "View all updates": ["전체 업데이트 보기", "すべての更新を見る"],
    "Data Ingestion": ["데이터 수집", "データ取り込み"],
    "Processing": ["데이터 처리", "データ処理"],
    "Alerting": ["경보 시스템", "アラート"],
    "Station Network": ["관측망", "観測網"],
    "Operational": ["정상", "正常"],
    "Understand earthquakes, and you're already safer.": ["지진을 이해하면, 이미 더 안전해진 것입니다.", "地震を理解すれば、それだけで安全に近づきます。"],
    "Basics, magnitude and intensity, plate tectonics, and a practical safety guide — explained simply.": ["기초 지식, 규모와 진도, 판구조론, 실전 안전 가이드까지 — 쉽게 설명합니다.", "基礎知識、マグニチュードと震度、プレートテクトニクス、実践的な安全ガイドまで、わかりやすく解説します。"],
    "Open the Earthquake Guide": ["지진 가이드 열기", "地震ガイドを開く"],
    "Local time": ["현지 시간", "現地時間"],
    "All Regions": ["전체 지역", "すべての地域"],
    "Pacific Ring of Fire": ["환태평양 조산대", "環太平洋火山帯"],
    "Indonesia": ["인도네시아", "インドネシア"],
    "South America": ["남미", "南米"],
    "Japan Region": ["일본 지역", "日本周辺"],
    "Alaska Region": ["알래스카 지역", "アラスカ周辺"],

    /* live map */
    "Live Earthquake Map": ["실시간 지진 지도", "ライブ地震マップ"],
    "Real-time global seismic activity.": ["전 세계 지진 활동을 실시간으로 표시합니다.", "世界の地震活動をリアルタイムで表示します。"],
    "Region": ["지역", "地域"],
    "Global": ["전 세계", "全世界"],
    "Japan": ["일본", "日本"],
    "Filters": ["필터", "フィルター"],
    "Legend": ["범례", "凡例"],
    "Minimum magnitude": ["최소 규모", "最小マグニチュード"],
    "Depth": ["깊이", "深さ"],
    "Shallow (< 70 km)": ["천발 (< 70 km)", "浅発（< 70 km）"],
    "Intermediate (70–300 km)": ["중발 (70–300 km)", "やや深発（70–300 km）"],
    "Deep (> 300 km)": ["심발 (> 300 km)", "深発（> 300 km）"],
    "Magnitude": ["규모", "マグニチュード"],
    "Map layers": ["지도 레이어", "地図レイヤー"],
    "Plate boundaries": ["판 경계", "プレート境界"],
    "Recent Earthquakes": ["최근 지진", "最近の地震"],
    "Location": ["위치", "場所"],
    "Time (UTC)": ["시간 (UTC)", "時刻（UTC）"],
    "View All Earthquakes": ["전체 지진 보기", "すべての地震を見る"],
    "Show Fewer": ["접기", "表示を減らす"],
    "Now": ["현재", "現在"],
    "Live": ["라이브", "ライブ"],
    "View Details": ["상세 보기", "詳細を見る"],
    "Type": ["유형", "種別"],
    "Status": ["상태", "状態"],
    "Earthquake": ["지진", "地震"],
    "Reviewed": ["검토됨", "検証済み"],
    "Automatic": ["자동", "自動"],
    "Origin time": ["발생 시각", "発生時刻"],
    "Epicenter": ["진앙", "震央"],
    "Event ID": ["이벤트 ID", "イベントID"],
    "Review status": ["검토 상태", "検証状態"],
    "Display mode": ["표시 방식", "表示方式"],
    "Window length": ["구간 길이", "期間の長さ"],
    "Older quakes opacity": ["과거 지진 진하기", "過去の地震の濃さ"],
    "Recent highlight": ["최근 강조 기간", "直近ハイライト"],
    "Start": ["시작", "開始"],
    "End": ["끝", "終了"],
    "Turning a band off removes it (e.g. M3 = M3.0–3.9) from the globe, list, and stats.": ["밴드를 끄면 해당 규모대(예: M3 = M3.0–3.9)가 지도·목록·통계에서 제외됩니다.", "帯をオフにすると、その規模帯（例: M3 = M3.0–3.9）が地図・一覧・統計から除外されます。"],
    "Min (km)": ["최소 (km)", "最小 (km)"],
    "Max (km)": ["최대 (km)", "最大 (km)"],
    "Visual": ["시각", "表示効果"],
    "Depth exaggeration": ["깊이 과장", "深さ強調"],
    "Dot size": ["점 크기", "点サイズ"],
    "Master scale": ["전체 배율", "全体スケール"],
    "Per-magnitude dot size": ["규모별 점 크기", "規模別の点サイズ"],
    "Reset to defaults": ["기본값으로", "初期値に戻す"],
    "Sharpness": ["선명도", "シャープネス"],
    "Opacity": ["불투명도", "不透明度"],
    "Additive glow": ["발광 합성", "加算発光"],
    "Map": ["지도", "地図"],
    "Map opacity": ["지도 불투명도", "地図の不透明度"],
    "Basemap": ["배경 지도", "ベースマップ"],
    "Light Gray": ["밝은 회색", "ライトグレー"],
    "Topographic": ["지형도", "地形図"],
    "Ocean": ["해양", "海洋"],
    "Streets": ["거리 지도", "道路地図"],
    "Overlays": ["오버레이", "オーバーレイ"],
    "Night tint": ["야간 톤", "ナイトトーン"],
    "Range M": ["규모 범위", "規模範囲"],
    "Range km": ["깊이 범위 km", "深さ範囲 km"],
    "Admin boundaries": ["행정 경계", "行政界"],
    "Depth box & grid": ["깊이 상자·격자", "深さボックス・グリッド"],
    "Plate line width": ["판 경계 굵기", "プレート境界の太さ"],
    "Fault line width": ["활성 단층 굵기", "活断層の太さ"],
    "Admin line width": ["행정 경계 굵기", "行政界の太さ"],
    "Volcano size": ["화산 크기", "火山サイズ"],
    "Camera": ["시점", "視点"],
    "Isometric": ["입체", "立体"],
    "Top (map)": ["위 (지도)", "上（地図）"],
    "S→N section": ["남→북 단면", "南→北断面"],
    "E→W section": ["동→서 단면", "東→西断面"],
    "Japan Trench": ["일본해구", "日本海溝"],
    "Accumulate": ["누적", "累積"],
    "Moving window": ["이동 구간", "移動ウィンドウ"],
    "Period": ["기간", "期間"],
    "10 y": ["10년", "10年"],
    "1 y": ["1년", "1年"],
    "30 d": ["30일", "30日"],
    "7 d": ["7일", "7日"],
    "Min": ["최소", "最小"],
    "Max": ["최대", "最大"],
    "Shallow": ["천발", "浅発"],
    "Intermediate": ["중발", "やや深発"],
    "Deep": ["심발", "深発"],
    "Color by": ["색상 기준", "色の基準"],
    "Time": ["시간", "時間"],
    "Density": ["밀도", "密度"],
    "Map style": ["지도 스타일", "地図スタイル"],
    "None": ["없음", "なし"],
    "Fill": ["면 채우기", "塗りつぶし"],
    "Satellite": ["위성사진", "衛星写真"],
    "Layers": ["레이어", "レイヤー"],
    "Coastlines": ["해안선", "海岸線"],
    "Active faults": ["활성 단층", "活断層"],
    "Volcanoes": ["화산", "火山"],
    "Ocean floor": ["해저 지형", "海底地形"],
    "Auto-rotate": ["자동 회전", "自動回転"],
    "Solution by the World Earthquake Labs global network. Magnitudes are moment magnitude (Mw) unless otherwise noted.": ["World Earthquake Labs 글로벌 관측망의 분석 결과입니다. 별도 표기가 없으면 모멘트 규모(Mw)입니다.", "World Earthquake Labs グローバル観測網による解析結果です。特記がない限りモーメントマグニチュード（Mw）です。"],

    /* insights */
    "Explore trend patterns, key forecasts across time and space.": ["시간과 공간에 걸친 추세 패턴과 주요 예측을 살펴보세요.", "時間と空間にわたる傾向と主要な予測を探索します。"],
    "Time Range": ["기간", "期間"],
    "7 Days": ["7일", "7日間"],
    "30 Days": ["30일", "30日間"],
    "90 Days": ["90일", "90日間"],
    "Export CSV": ["CSV 내보내기", "CSVエクスポート"],
    "Magnitude Frequency Distribution": ["규모-빈도 분포", "マグニチュード頻度分布"],
    "Number of events vs magnitude": ["규모별 이벤트 수", "マグニチュード別イベント数"],
    "Depth Distribution": ["깊이 분포", "深さ分布"],
    "Distribution of earthquake depths": ["지진 깊이의 분포", "地震の深さの分布"],
    "Seismic Energy Release": ["지진 에너지 방출", "地震エネルギー放出"],
    "Relative seismic energy release over time": ["시간에 따른 상대적 에너지 방출량", "時間に伴う相対エネルギー放出量"],
    "Regional Hotspots": ["지역별 핫스팟", "地域別ホットスポット"],
    "Top regions by event count": ["발생 건수 상위 지역", "発生数上位の地域"],
    "View all": ["전체 보기", "すべて見る"],
    "Model Performance": ["모델 성능", "モデル性能"],
    "Skill scores vs observed": ["관측 대비 스킬 스코어", "観測値に対するスキルスコア"],
    "Skill Score": ["스킬 스코어", "スキルスコア"],
    "Short-term (24h) forecast": ["단기(24시간) 예측", "短期（24時間）予測"],
    "Long-term (30d) forecast": ["장기(30일) 예측", "長期（30日）予測"],
    "Statistics": ["통계", "統計"],
    "Magnitude Analysis": ["규모 분석", "マグニチュード分析"],
    "Depth Analysis": ["깊이 분석", "深さ分析"],
    "Regional Insights": ["지역 인사이트", "地域インサイト"],
    "Station Performance": ["관측소 성능", "観測点性能"],
    "Forecast Models": ["예측 모델", "予測モデル"],
    "Custom Analysis": ["사용자 분석", "カスタム分析"],
    "Insights": ["인사이트", "インサイト"],
    "Tonga–Kermadec": ["통가-케르마덱", "トンガ・ケルマデック"],
    "Mediterranean": ["지중해", "地中海"],
    "Central America": ["중미", "中米"],
    "Philippines": ["필리핀", "フィリピン"],
    "New Zealand": ["뉴질랜드", "ニュージーランド"],
    "North America": ["북미", "北米"],

    /* research hub */
    "Explore our research, data, and resources.": ["연구, 데이터, 리소스를 살펴보세요.", "研究・データ・リソースを探索します。"],
    "Publications": ["논문", "論文"],
    "Datasets": ["데이터셋", "データセット"],
    "Tools & Software": ["도구 및 소프트웨어", "ツール＆ソフトウェア"],
    "Active Projects": ["진행 중인 프로젝트", "進行中のプロジェクト"],
    "Featured Publications": ["주요 논문", "注目の論文"],
    "View all publications": ["전체 논문 보기", "すべての論文を見る"],
    "Latest Datasets": ["최신 데이터셋", "最新データセット"],
    "View all datasets": ["전체 데이터셋 보기", "すべてのデータセットを見る"],
    "Explore Resources": ["리소스 살펴보기", "リソースを探索"],
    "Data Library": ["데이터 라이브러리", "データライブラリ"],
    "Learning Resources": ["학습 자료", "学習リソース"],
    "Collaborate": ["협업", "コラボレーション"],
    "Submit Your Work": ["연구 성과 제출", "成果を投稿"],
    "Stay Informed": ["소식 받기", "最新情報を受け取る"],
    "Projects": ["프로젝트", "プロジェクト"],
    "Partners": ["파트너", "パートナー"],
    "RESEARCH ARTICLE": ["연구 논문", "研究論文"],
    "TECHNICAL REPORT": ["기술 보고서", "技術レポート"],

    /* news */
    "Event reports, advisories, and platform announcements.": ["이벤트 리포트, 경보, 플랫폼 공지를 한곳에서 확인하세요.", "イベントレポート、注意情報、プラットフォームのお知らせ。"],
    "All": ["전체", "すべて"],
    "Events & Advisories": ["이벤트·경보", "イベント＆注意情報"],
    "Network": ["네트워크", "ネットワーク"],
    "ADVISORY": ["경보", "注意情報"],
    "EVENT REPORT": ["이벤트 리포트", "イベントレポート"],
    "NEWS": ["뉴스", "ニュース"],
    "NETWORK": ["네트워크", "ネットワーク"],
    "DATA RELEASE": ["데이터 릴리스", "データリリース"],
    "RESEARCH": ["연구", "研究"],
    "No image": ["이미지 없음", "画像なし"],
    "No updates in this category.": ["이 카테고리에는 업데이트가 없습니다.", "このカテゴリーに更新はありません。"],

    /* guide */
    "Earthquakes strike without warning — pick a topic above, or start with the safety guide.": ["지진은 예고 없이 찾아옵니다 — 위 메뉴에서 주제를 고르거나 안전 가이드부터 시작하세요.", "地震は突然やってきます。上のメニューからトピックを選ぶか、安全ガイドから始めましょう。"],
    "See the Safety Guide": ["안전 가이드 보기", "安全ガイドを見る"],
    "Browse the guide": ["가이드 둘러보기", "ガイドを見る"],
    "Basics": ["기초", "基礎"],
    "Plate Tectonics": ["판구조론", "プレートテクトニクス"],
    "Magnitude & Intensity": ["규모와 진도", "マグニチュードと震度"],
    "Key Terms": ["핵심 용어", "主要用語"],
    "Safety Guide": ["안전 가이드", "安全ガイド"],
    "What is an earthquake?": ["지진이란 무엇인가요?", "地震とは？"],
    "Where earthquakes happen": ["지진은 어디서 발생하나요", "地震はどこで起こるのか"],
    "How magnitude works": ["규모는 어떻게 정해지나요", "マグニチュードの仕組み"],
    "The magnitude scale": ["규모 등급표", "マグニチュード階級"],
    "Frequently Asked Questions": ["자주 묻는 질문", "よくある質問"],
    "Small habits now build big safety later.": ["지금의 작은 습관이 큰 안전을 만듭니다.", "今の小さな習慣が、大きな安全をつくります。"],
    "If you're indoors": ["실내에 있을 때", "屋内にいるとき"],
    "If you're outdoors": ["실외에 있을 때", "屋外にいるとき"],
    "If you're driving": ["운전 중일 때", "運転中のとき"],
    "If you're in an elevator": ["엘리베이터에 있을 때", "エレベーターにいるとき"],
    "when the shaking starts": ["흔들림이 시작되면", "揺れが始まったら"],
    "away from buildings and wires": ["건물과 전선에서 떨어지기", "建物や電線から離れる"],
    "pull over safely, stay inside": ["안전하게 정차 후 차 안에서 대기", "安全に停車し車内で待機"],
    "get out at the first chance": ["가장 먼저 열리는 층에서 내리기", "最初に開いた階で降りる"],
    "Drop": ["엎드리기", "伏せる"],
    "Cover": ["가리기", "隠れる"],
    "Hold on": ["잡기", "つかまる"],
    "Watch above": ["낙하물 주의", "落下物に注意"],
    "Open ground": ["넓은 곳으로", "広い場所へ"],
    "Stay put": ["침착하게 대기", "その場で待機"],
    "Slow down": ["서서히 감속", "ゆっくり減速"],
    "Hazards on": ["비상등 켜기", "ハザード点灯"],
    "Wait inside": ["차 안 대기", "車内で待機"],
    "All buttons": ["모든 층 누르기", "全階ボタン"],
    "First stop": ["첫 정차 층 하차", "最初の階で降車"],
    "Take stairs": ["계단으로 대피", "階段で避難"],
    "Emergency Kit Checklist": ["비상용품 체크리스트", "非常用品チェックリスト"],
    "Prepare it together with your family — check what you already have.": ["가족과 함께 준비하고, 이미 있는 물품을 체크해 보세요.", "家族と一緒に準備し、すでにある物をチェックしましょう。"],
    "ESSENTIAL": ["필수", "必須"],
    "RECOMMENDED": ["권장", "推奨"],
    "Water — 3 L per person per day, 3+ days": ["생수 — 1인 1일 3L, 3일 이상", "水 — 1人1日3L、3日分以上"],
    "Non-perishable food for 3+ days": ["3일 이상의 비상식량", "3日分以上の非常食"],
    "First-aid kit & personal medications": ["구급상자 및 상비약", "救急セットと常備薬"],
    "Flashlight & spare batteries": ["손전등과 여분 배터리", "懐中電灯と予備電池"],
    "Portable radio": ["휴대용 라디오", "携帯ラジオ"],
    "Power bank for phones": ["휴대폰 보조배터리", "モバイルバッテリー"],
    "Dust masks & sanitation supplies": ["마스크 및 위생용품", "マスクと衛生用品"],
    "Blanket or warm clothing": ["담요 또는 보온용품", "毛布や防寒着"],
    "Whistle to signal for help": ["구조 요청용 호루라기", "救助を求める笛"],
    "Copies of ID documents & some cash": ["신분증 사본과 현금", "身分証のコピーと現金"],
    "Sturdy shoes & work gloves": ["튼튼한 신발과 장갑", "丈夫な靴と軍手"],
    "Family contact card & meeting point": ["가족 연락 카드와 집결 장소", "家族の連絡カードと集合場所"],
    "Is your home ready?": ["우리 집은 준비됐나요?", "あなたの家は大丈夫？"],
    "Three things to check this week.": ["이번 주에 확인할 세 가지.", "今週確認したい3つのこと。"],
    "Remember!": ["기억하세요!", "覚えておこう！"],
    "Drop, Cover, Hold On": ["엎드리고, 가리고, 잡으세요", "伏せて、隠れて、つかまる"],
    "keep the safe position until the shaking stops": ["흔들림이 멈출 때까지 안전한 자세 유지", "揺れが収まるまで安全な姿勢を保つ"],
    "Agree on a family plan": ["가족 대피 계획 정하기", "家族で防災計画を決める"],
    "an out-of-area contact and a meeting point": ["비상 연락처와 집결 장소를 미리 정해두세요", "遠方の連絡先と集合場所を決めておく"],
    "Review your kit twice a year": ["비상용품은 1년에 두 번 점검", "備蓄品は年2回点検"],
    "check expiry dates, batteries, and storage spots": ["유통기한, 배터리, 보관 위치 확인", "賞味期限・電池・保管場所を確認"]
  };

  /* pattern rules for strings with numbers */
  var RULES = [
    [/^(\d+)\s*min ago$/, function (m) { return IX === 0 ? m[1] + "분 전" : m[1] + "分前"; }],
    [/^(\d+)\s*h ago$/, function (m) { return IX === 0 ? m[1] + "시간 전" : m[1] + "時間前"; }],
    [/^(\d+)\s*d ago$/, function (m) { return IX === 0 ? m[1] + "일 전" : m[1] + "日前"; }],
    [/^(\d+) events$/, function (m) { return IX === 0 ? m[1] + "건" : m[1] + "件"; }],
    [/^\((\d+) Days\)$/, function (m) { return IX === 0 ? "(" + m[1] + "일)" : "（" + m[1] + "日間）"; }],
    [/^(\d+) \/ (\d+) done$/, function (m) { return IX === 0 ? m[1] + " / " + m[2] + " 완료" : m[1] + " / " + m[2] + " 完了"; }],
    [/^1 Watch\s+•\s+2 Advisory$/, function () { return IX === 0 ? "관심 1 · 주의 2" : "警戒 1 ・ 注意 2"; }],
    [/^Earthquakes \((24h|7d|30d|90d|1y|3y|5y|10y)\)$/, function (m) { return (IX === 0 ? "지진 횟수 (" : "地震回数（") + m[1] + (IX === 0 ? ")" : "）"); }]
  ];

  function translate(text) {
    var key = text.trim();
    if (!key) return null;
    var hit = DICT[key];
    if (hit) return text.replace(key, hit[IX]);
    for (var i = 0; i < RULES.length; i++) {
      var m = key.match(RULES[i][0]);
      if (m) return text.replace(key, RULES[i][1](m));
    }
    return null;
  }

  var applying = false;

  function walk(root) {
    if (!root) return;
    applying = true;
    var it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = it.nextNode())) {
      var p = n.parentNode && n.parentNode.nodeName;
      if (p === "SCRIPT" || p === "STYLE") continue;
      var out = translate(n.nodeValue);
      if (out !== null) n.nodeValue = out;
    }
    applying = false;
  }

  function boot() {
    walk(document.body);
    new MutationObserver(function (muts) {
      if (applying) return;
      muts.forEach(function (mu) {
        if (mu.type === "characterData") { var o = translate(mu.target.nodeValue); if (o !== null) { applying = true; mu.target.nodeValue = o; applying = false; } return; }
        Array.prototype.forEach.call(mu.addedNodes, function (node) {
          if (node.nodeType === 3) { var o2 = translate(node.nodeValue); if (o2 !== null) { applying = true; node.nodeValue = o2; applying = false; } }
          else if (node.nodeType === 1) walk(node);
        });
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
