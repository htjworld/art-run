# ArtRun — Plan.md

기술 설계 문서. **Process.md는 이 문서의 섹션 번호·제목 구조를 그대로 미러링한다.**

---

## 0. 프로젝트 개요

| 항목 | 값 |
|---|---|
| 이름 | **ArtRun** |
| 레포 | **`art-run`** |
| 배포 | GitHub Pages — `https://<user>.github.io/art-run/` |
| 브랜치 전략 | `main` push → GitHub Actions → `gh-pages` 자동 |
| 타깃 브라우저 | Evergreen 최신 2 버전 (Chrome / Safari / Firefox / Edge). IE 지원 없음. |
| 타깃 기기 | **모바일 우선** (iOS Safari 16+, Android Chrome 최신) |
| 화면 구조 | **단일 화면 (맵)** — 페이지 라우팅 없음 |

---

## 1. 기술 스택

### 1.1 코어

- **Vite 5** + **TypeScript 5** — 빠른 HMR, 작은 산출물
- **pnpm** — lockfile 가볍고 CI 빠름
- **프레임워크 없음** — Vanilla TS + 얇은 컴포넌트 유틸.
  상태 복잡도가 실제로 올라간 시점(M2 이후) Preact(3KB) 도입 재검토. 선제 도입 금지.

### 1.2 지도

**라이브러리: MapLibre GL JS v4 (사실상 확정)**

Leaflet 대비 MapLibre를 택한 이유:
- 벡터 타일 렌더링 (GPU 가속) → 수십 개 코스 오버레이 렌더해도 부드러움
- 단일 GeoJSON source에 다수 Feature 넣어도 성능 안정
- zoom 기반 레이어 가시성(`minzoom/maxzoom`) 내장
- 스타일 커스터마이징 유연

**타일 서비스 후보 (비교 후 택1)**

| 후보 | 무료 한도 | 오버레이 적합성 | 장점 | 주의점 |
|---|---|---|---|---|
| **Protomaps** | 매우 관대 / 자체 호스팅 | ★★★ (PMTiles 단일 파일, 빠름) | OSM 기반, 검열 없음 | 기본 스타일 수수 |
| **MapTiler Cloud** | 10만/월 | ★★★ | 스타일 다양, 한국어 라벨 잘 됨 | 쿼터 소진 주의 |
| **Stadia Maps** | 2500/일 (비상업) | ★★ | Alidade Smooth 미려 | 상업 유료 |

**결정 방법**: 광화문 `[126.977, 37.575]`에서 동일 조건 비교.
체크 항목: ① 한국어 라벨 ② 최신 건물·도로 ③ 오버레이 얹었을 때 가독성 ④ 로딩 속도.

**초기 뷰포트**: `center: [127.766, 36.2], zoom: 6.5` (남한 전체).

**인터랙션 정책**
- ✅ 줌(스크롤·핀치), 드래그(지도 이동)
- ❌ 회전 (`dragRotate: false`, `touchZoomRotate.disableRotation()`)
- ❌ 피치 (`pitchWithRotate: false`)
  → 아트런은 2D top-down이 본질. 회전·피치는 혼란만.

### 1.3 라우팅 (핵심)

**1순위: OpenRouteService (ORS)**
```
POST https://api.openrouteservice.org/v2/directions/foot-walking/geojson
Headers: { Authorization: <API_KEY> }
Body:    { "coordinates": [[lng1,lat1], [lng2,lat2]] }
Response: GeoJSON FeatureCollection (LineString in features[0].geometry)
```
- 무료: **2000 req/day, 40 req/min**
- 프로필: **`foot-walking` 고정**
- 재시도: 429/5xx 시 지수 백오프 1회(500ms) → 실패 시 에러 표시

**2순위: GraphHopper** — ORS 폴백으로 어댑터 교체 가능하게 `RoutingProvider` 인터페이스 분리.

**3순위: OSRM 공개 데모** — 개발 중 테스트용만.

**쿼터 방어 — 점 모드**
- 디바운스 300ms
- AbortController로 진행 중 취소
- `segmentCache` — 좌표쌍 키 (소수점 5자리 반올림), in-memory Map + LocalStorage LRU 500

**쿼터 방어 — 드래그 모드** (§3.2 참조)
- 거리 기반 샘플링 30m
- 단일 드래그 상한 40 waypoints
- pointerup 후 배치 라우팅

### 1.4 지리 유틸

개별 모듈만 설치 (전체 `@turf/turf` 금지):
- `@turf/length` — 총거리
- `@turf/bbox` — fit-to-bounds
- `@turf/simplify` — 오버레이용 Douglas-Peucker 단순화
- `@turf/distance` — 드래그 모드 거리 샘플링

### 1.5 GPX

외부 라이브러리 없이 직접 생성 (약 40줄):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ArtRun"
     xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <n>여의도 고구마런</n>
    <time>2026-04-17T12:00:00Z</time>
  </metadata>
  <trk>
    <n>여의도 고구마런</n>
    <trkseg>
      <trkpt lat="37.527123" lon="126.923456"/>
      ...
    </trkseg>
  </trk>
</gpx>
```

- 좌표 소수점 6자리
- 파일명: `{slug(이름)}_{YYYYMMDD}.gpx` (이름 없으면 `artrun_{YYYYMMDD_HHmm}.gpx`)
- **가상 타임스탬프 옵션** — 페이스 7 min/km로 `<trkpt>`에 `<time>` 부여. 토글 가능.

### 1.6 PMTiles (Protomaps 선택 시)

`pmtiles` 패키지를 MapLibre `addProtocol`로 등록.

---

## 2. 아키텍처

### 2.1 모듈 구성

```
src/
  main.ts                    # 엔트리
  app.ts                     # 앱 초기화, 최상위 조립

  map/
    mapView.ts               # MapLibre 초기화·리사이즈·스타일
    layers.ts                # 레이어 id, 소스 정의, paint 스타일
    interactions.ts          # 클릭/드래그 → drawStore 연결
    overlay.ts               # 인기 코스·아트런 상시 오버레이 (단일 source)

  routing/
    provider.ts              # RoutingProvider 인터페이스
    orsClient.ts             # ORS 구현체
    segmentCache.ts          # 좌표쌍 → LineString LRU (mem + localStorage)

  draw/
    drawStore.ts             # 모드(idle|point|drag) + Point[] + 진행상태
    pointMode.ts             # 점 모드 핸들러
    dragMode.ts              # 드래그 모드 핸들러 (거리 샘플링 + 배치 라우팅)
    routeComposer.ts         # points → 필요 세그먼트 라우팅 → routeStore
    undoStack.ts             # 연산 히스토리(op log)
    debounce.ts              # 공통 디바운스 유틸

  gpx/
    export.ts                # LineString → GPX XML → Blob 다운로드

  gallery/
    courses.json             # 인기 코스 + 인기 아트런 (프리컴퓨트)
    galleryView.ts           # 사이드바 / 바텀시트 UI (탭 2개)
    loadCourse.ts            # 선택 코스를 지도/편집으로 로드

  ui/
    toolbar.ts               # 지도 위 floating toolbar
    sheet.ts                 # 모바일 바텀시트 (3단계, 드래그 제스처)
    modeToggle.ts            # 점/드래그 모드 전환 버튼
    tabs.ts                  # 인기 코스 / 인기 아트런 탭
    styles.css               # CSS variables 기반 전역 스타일

  util/
    coord.ts                 # LngLat / GpxPt 타입 + 변환
    dom.ts                   # 작은 DOM 헬퍼
    format.ts                # 거리·시간 포맷터

scripts/
  build-gallery.ts           # courses.json 프리컴퓨트 (route + routeSimplified)

public/
  courses/                   # 코스 썸네일 (webp)

.github/workflows/
  deploy.yml, ci.yml
```

### 2.2 상태 모델

```ts
type LngLat = [number, number];
type Point = { id: string; lng: number; lat: number };
type DrawMode = 'idle' | 'point' | 'drag';
type Segment = { from: string; to: string; line: GeoJSON.LineString; meters: number };

type CourseType = 'scenic' | 'artrun';

// draw/drawStore.ts
drawStore: {
  mode: DrawMode,
  points: Point[],
  isDragging: boolean,
  subscribe, setMode, add, update, remove, reorder, clear
}

// routing/segmentCache.ts
segmentCache: Map<string, GeoJSON.LineString>
// key: `${lng.toFixed(5)},${lat.toFixed(5)}|${lng.toFixed(5)},${lat.toFixed(5)}`

// draw/routeComposer.ts
routeStore: {
  segments: Segment[],             // N-1개
  composed: GeoJSON.LineString,
  totalMeters: number,
  pending: Set<string>             // 진행 중 세그먼트 키
}

// map/overlay.ts
overlaySource: GeoJSON.FeatureCollection  // 모든 코스 features (routeSimplified 사용)

uiStore: {
  activeTab: CourseType,           // 'scenic' | 'artrun'
  selectedCourseId?: string,
  drawerOpen: boolean,             // 모바일 바텀시트
}
```

### 2.3 데이터 흐름

**점 모드**
```
지도 클릭 → pointMode 핸들러 → drawStore.add(point)
  → routeComposer (인접 세그먼트만 재계산)
      - segmentCache 조회 → 있으면 즉시 사용
      - 없으면 debounced ORS 호출, AbortController
  → routeStore 업데이트 → mapView 레이어 갱신
```

**드래그 모드**
```
pointerdown → dragMode.start()
pointermove
  - 이전 캡처점에서 >= 30m 이동 시 drawStore.add(point) (임시, 점선 표시)
  - 이동 중에는 라우팅 호출 없음
pointerup → dragMode.finalize()
  - 캡처된 전체 points에 대해 routeComposer 실행 (세그먼트 병렬 호출)
  - 성공 세그먼트부터 순차적으로 routeStore에 반영 (progressive render)
```

**오버레이**
```
앱 시작 시 courses.json fetch
  → FeatureCollection 구성 (routeSimplified로)
  → map source "courses-overlay"에 setData
  → overlay-lines 레이어 (min-zoom 10) + overlay-symbols 레이어 (max-zoom 10)
사이드바 카드 클릭
  → uiStore.selectedCourseId 설정
  → map.flyTo(course.center, course.zoom)
  → overlay 레이어는 그대로 (하이라이트만 feature-state로)
"편집하기" 클릭
  → drawStore에 waypoints 로드
  → overlay 레이어 filter에 해당 id 제외 (편집 라인과 겹치지 않게)
```

### 2.4 undo/redo (op log)

```ts
type Op =
  | { t: 'add'; point: Point }
  | { t: 'move'; id: string; from: LngLat; to: LngLat }
  | { t: 'delete'; index: number; point: Point }
  | { t: 'dragBatch'; points: Point[] }    // 드래그 1회는 1 op로 묶음
  | { t: 'clear'; prev: Point[] }
  | { t: 'loadCourse'; prev: Point[]; next: Point[] };
```

---

## 3. 기능 상세

### 3.1 그리기 모드 (점 / 드래그)

**모드 전환 UI**: 지도 우측 상단 또는 하단의 세그먼트 컨트롤.
- `점 모드 / 드래그 모드 / 선택 모드` 3상태.
- 기본은 점 모드. 첫 클릭하면 자동 진입.

**점 모드**
- 지도 클릭 → `drawStore.add` → 끝에 append
- 마커 드래그 → 좌표 갱신 → drag end + 300ms 후 인접 2 세그먼트 라우팅
- 삭제: long-press(모바일) / 더블클릭(데스크톱) / 선택 후 Delete
- Undo/Redo 지원

**드래그 모드**
- pointerdown → 캡처 시작, 첫 점을 waypoint 0으로 추가
- pointermove (throttle rAF):
  - `@turf/distance`로 이전 캡처점과 비교
  - 30m 이상이면 새 waypoint 추가
  - 40개 도달 시 캡처 정지 + 토스트 "드래그 상한에 도달했습니다. 손을 떼면 경로를 계산합니다."
  - 화면엔 임시 직선 점선만 표시 (라우팅 호출 없음)
- pointerup → 배치 라우팅 시작
  - 세그먼트별로 병렬 fetch (동시 6개 제한)
  - 먼저 완료된 세그먼트부터 `route-done`에 순차 반영 (progressive)
  - 실패 세그먼트는 빨간 점선 + 재시도 버튼

**Clear / Reset**
- 툴바 쓰레기통 → confirm 다이얼로그 → `drawStore.clear()`

### 3.2 경로 시각화

| 레이어 | 타입 | 스타일 | 순서 |
|---|---|---|---|
| `basemap-*` | MapLibre 기본 | 타일 서비스 제공 | 바닥 |
| `overlay-lines` | line | `#BDEFFC` 반투명 0.35, width 3, dash `[2,2]` (아트런) / 실선 (코스) | 1 |
| `overlay-symbols` | symbol | 작은 원 + 이름, minzoom 필요 | 2 |
| `route-pending` | line | 회색 점선, width 3 | 3 |
| `route-error` | line | 빨강 점선, width 3 | 4 |
| `route-halo` | line | 흰색, width 7 (halo) | 5 |
| `route-done` | line | `#BDEFFC`, width 5 | 6 |
| `points-halo` | circle | 흰색, radius 10 | 7 |
| `points` | circle | `#BDEFFC` fill, `#0B1220` stroke 1, radius 7 | 8 |
| `points-label` | symbol | 번호 라벨 | 9 |

**총거리**: 툴바 우측 실시간 `X.XX km` (`@turf/length` 결과 합).
**Fit-to-bounds**: 툴바 버튼 (`@turf/bbox` → `map.fitBounds(..., {padding: 80})`).

### 3.3 GPX 내보내기

- 트리거: 툴바 "GPX 저장" 버튼
- 코스 이름 입력 프롬프트 (선택)
- `gpx/export.ts`는 **동적 import** (초기 번들 제외)
- 토글: 가상 타임스탬프 포함 여부 (기본 ON)
- Blob + `URL.createObjectURL` + `<a download>` 자동 클릭

### 3.4 갤러리 (인기 코스 / 인기 아트런)

**통합 데이터 스키마 (`gallery/courses.json`)**
```json
[
  {
    "id": "yeouido-sweetpotato",
    "type": "artrun",
    "name": "여의도 고구마런",
    "distanceKm": 8.0,
    "region": "서울 영등포",
    "description": "한강을 따라 고구마 모양 완성",
    "thumbnail": "/courses/yeouido-sweetpotato.webp",
    "center": [126.924, 37.524],
    "zoom": 13,
    "waypoints": [[126.92, 37.52], [126.93, 37.53], "..."],
    "route": { "type": "LineString", "coordinates": "[...]" },
    "routeSimplified": { "type": "LineString", "coordinates": "[...]" }
  },
  {
    "id": "hangang-night",
    "type": "scenic",
    "name": "한강 야경 코스",
    "distanceKm": 12.0,
    "region": "서울 용산",
    "description": "반포~잠수교 왕복, 야경 맛집",
    "thumbnail": "/courses/hangang-night.webp",
    "center": [126.995, 37.513],
    "zoom": 14,
    "waypoints": ["..."],
    "route": "...",
    "routeSimplified": "..."
  }
]
```

**MVP 시드 — 인기 아트런**
1. 여의도 고구마런 (8 km)
2. 광교 고래런 (10 km)
3. 종로 댕댕이런 (9 km)
4. 백운호수 나비런 (3 km)
5. 어린이대공원 붕어빵런 (10 km)
6. 세종시 거북이런 (9 km)
7. 남산 하트런 (9 km)
8. 한강 옷걸이런 (30 km)

**MVP 시드 — 인기 코스** (관리자 큐레이션, 초안)
1. 한강 야경 코스 (반포~잠수교)
2. 남산 순환로
3. 올림픽공원 한 바퀴
4. 서울숲 둘레길
5. 청계천 하류 러닝
6. 양재천 러닝

> 인기 코스는 내가(관리자) 직접 waypoints 추가 후 프리컴퓨트.

**갤러리 UI**
- 탭 2개: `인기 코스 / 인기 아트런` (카운트 배지 포함)
- 카드: 썸네일 + 이름 + 거리 + 지역
- 카드 클릭 → `flyTo(center, zoom)` + 해당 feature `feature-state { selected: true }`로 오버레이 강조
- 카드 내 액션: `[편집하기]` `[GPX 저장]`
  - 편집하기 → `loadCourse.load(id)` → `drawStore.points` 세팅 + 오버레이에서 해당 id 제외
  - GPX 저장 → 기존 `route` 그대로 GPX 빌드 (ORS 호출 X)

### 3.5 맵 오버레이 (상시 표시)

**원칙**: 하나의 source에 모든 코스. 움직이는 맵과 함께 항상 보인다.

**Source**
- id: `courses-overlay`
- type: `geojson`
- data: FeatureCollection(모든 코스의 `routeSimplified`를 LineString Feature로, type·id를 properties에)

**레이어**
- `overlay-lines` (line)
  - `minzoom: 10`
  - paint: `line-color: #BDEFFC`, `line-opacity: 0.35`, `line-width: 3`
  - `line-dasharray`: `['case', ['==', ['get', 'type'], 'artrun'], ['literal', [2, 2]], ['literal', [1, 0]]]`
  - hover/selected: `line-opacity` 0.85, `line-width` 5
- `overlay-symbols` (symbol)
  - `maxzoom: 10`
  - `icon-image: course-dot`, `text-field: {name}`, `text-size: 11`
- **선택 상태**: `map.setFeatureState({source, id}, {selected: true})` + paint에서 `feature-state`로 스타일 변경
- **편집 중인 코스 제외**: layer `filter` 에 `['!=', ['get', 'id'], editingId]`

**성능 예산**
- 시드 코스 총 14개 × 평균 80 포인트 (simplified) = 1,120 vertex → 매우 가벼움
- 확장 시 100개까지는 같은 구조로 부드러움 유지 예상

### 3.6 반응형 레이아웃

**데스크톱 (≥ 1024px)**
```
┌─────────┬────────────────────────────────┐
│ 사이드바 │                                │
│  (탭 2)  │         지도 (floating toolbar)│
│  320px  │                                │
└─────────┴────────────────────────────────┘
```

**모바일 (< 1024px)**
```
┌────────────────────────┐
│       타이틀 바 48px    │
├────────────────────────┤
│                        │
│        지도            │
│  (floating toolbar     │
│    우측 세로 배치)      │
│                        │
├────────────────────────┤
│ ▁▁ peek 80 / half 45vh │
│  바텀시트 (탭 2)        │
└────────────────────────┘
```
- 바텀시트 3단계: peek 80px / half 45vh / full 90vh
- iOS safe area: `padding-bottom: env(safe-area-inset-bottom)`

---

## 4. 성능 전략

### 4.1 번들 분할
- **main** — 앱 쉘 + MapLibre + 지도 초기화
- **gpx-export** (dynamic) — "GPX 저장" 클릭 시
- **gallery** (dynamic) — 사이드바 탭 열 때 또는 모바일 바텀시트 확장 시

### 4.2 이미지
- 썸네일 WebP, 300×200, 품질 80
- `<img loading="lazy" decoding="async" width="300" height="200">`

### 4.3 폰트
- Pretendard CDN 서브셋, `font-display: swap`

### 4.4 캐싱
- 지도 타일: 브라우저 기본 HTTP 캐시
- 라우팅 세그먼트: LocalStorage LRU 500
- 갤러리 JSON: 빌드 해시 강캐시

### 4.5 성능 목표 (Lighthouse 모바일, 4G throttle)
- Performance ≥ 90, LCP < 1.5s, TBT < 200ms, CLS < 0.05
- 오버레이 렌더 후에도 pan·zoom 중 60fps 유지

---

## 5. 보안 / 키 관리

- 환경변수: `VITE_ORS_KEY`, `VITE_MAP_KEY` (타일 서비스 선택에 따라)
- 로컬: `.env.local` (git ignore). 커밋용 `.env.example` 제공.
- CI: GitHub Actions Secrets
- **반드시**: 각 제공자 대시보드에서 `https://<user>.github.io` 도메인 allowlist
- 키 유출돼도 타 도메인 호출 실패 → 오남용 차단

---

## 6. 배포

### 6.1 GitHub Pages

`vite.config.ts`
```ts
export default defineConfig({
  base: '/art-run/',
  build: { target: 'es2020', sourcemap: false }
});
```

`.github/workflows/deploy.yml` (요지)
```yaml
on: { push: { branches: [main] } }
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions: { pages: write, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          VITE_ORS_KEY: ${{ secrets.ORS_KEY }}
          VITE_MAP_KEY: ${{ secrets.MAP_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - uses: actions/deploy-pages@v4
```

### 6.2 CI (PR)
- `tsc --noEmit`
- ESLint
- 빌드 성공 (환경변수 없이도 — 런타임 fallback)

---

## 7. 향후 확장 (MVP 범위 밖)

- 유저 업로드 갤러리 (Supabase 무료 티어)
- 엘리베이션 프로파일
- 다크모드
- PWA
- 이미지 → 경로 자동 변환 (이미지 벡터화 + 보행로 샘플링)
- 다국어 (EN, JA)

---

## 마일스톤

| 코드 | 정의 | 완료 조건 |
|---|---|---|
| **M0** | 기획/문서 | CLAUDE / Plan / Process 커밋 |
| **M1** | 지도 + 점 모드 2점 → 인도 따라 선 | ORS 라우팅 연동 성공 |
| **M2** | 드래그 모드 + 편집 + GPX 내보내기 | Strava GPX import 성공 |
| **M3** | 오버레이(상시 표시) + 갤러리(두 탭) + 반응형 + 배포 | gh-pages에서 정상 동작 |
| **M4** | 성능 튜닝 + 공개 | Lighthouse 목표치 달성 |

---

## 의사결정 대기

1. 지도 타일 서비스 3종 중 택1 (Protomaps / MapTiler / Stadia) — 광화문 비교 스크린샷 후
2. 가상 타임스탬프 기본 페이스 (7 min/km 제안 → 확정?)
3. 모드 전환 버튼 위치 (지도 우상단 vs 하단 센터)
4. 오버레이 dash 패턴 (인기 아트런 `[2,2]` vs 색 틴트 변경)
5. 인기 코스 초기 시드 목록 확정 (§3.4 초안 검토)
