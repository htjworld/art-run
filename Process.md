# ArtRun — Process.md

**Plan.md의 섹션 번호·제목을 그대로 미러링한 진행상황 트래커.**
코드 변경이 있을 때마다 이 문서를 같은 커밋에서 업데이트한다 (1:1 매핑).

- 상태 범례: 🟢 완료 / 🟡 진행 중 / ⚪ 미착수 / 🔴 블록
- 부분 구현이면 **어디까지 됐는지** 파일·함수 레벨로 기입.

**최종 업데이트**: 2026-04-17
**현재 마일스톤**: **M1 — 지도 + 점 모드** 🟡

---

## 0. 프로젝트 개요 🟡

- [x] 프로젝트명 확정: **ArtRun**
- [x] 레포명 확정: **`art-run`**
- [ ] GitHub 레포지토리 생성
- [ ] GitHub Pages 활성화 (Settings → Pages → Source: GitHub Actions)
- [x] README 기본 버전 작성 (CLAUDE.md)

---

## 1. 기술 스택

### 1.1 코어 🟢
- [x] `pnpm create vite` 대응 — package.json 수동 작성 (vanilla-ts)
- [x] `pnpm install` 완료
- [x] TypeScript strict 옵션 확인 (`tsconfig.json`, `tsconfig.node.json`)
- [x] `package.json` scripts: `dev`, `build`, `typecheck`, `precompute`
- [ ] ESLint + Prettier 설정 (CI 포함, 추후)

### 1.2 지도 🟢
- [x] MapLibre GL JS v4 설치 (`maplibre-gl@4.7.1`)
- [x] `map/mapView.ts` — 초기화, 스타일 url, resize 핸들러
  - `getMapStyle()`: VITE_MAP_KEY 있으면 MapTiler Streets v2, 없으면 OpenFreeMap Liberty
- [x] 초기 뷰포트 남한 (`[127.766, 36.2]`, zoom 6.5)
- [x] 회전·피치 비활성 (`dragRotate: false`, `pitchWithRotate: false`, `disableRotation()`)
- [x] 줌 컨트롤 추가 (NavigationControl)
- [ ] 타일 서비스 3종 비교 — MapTiler 기본 채택, 추후 비교 가능

### 1.3 라우팅 🟢
- [ ] ORS 계정 생성 + API key 발급 (사용자 작업)
- [ ] ORS 대시보드 allowlist 등록 (사용자 작업)
- [x] `routing/provider.ts` — RoutingProvider 인터페이스, RoutingError
- [x] `routing/orsClient.ts` — fetch + AbortController + 지수 백오프 1회 재시도
- [x] `routing/segmentCache.ts` — in-memory LRU 500 + LocalStorage LRU 500

### 1.4 지리 유틸 🟢
- [x] `@turf/length`, `@turf/bbox`, `@turf/simplify`, `@turf/distance` 설치

### 1.5 GPX 🟢
- [x] `gpx/export.ts`
  - `buildGpx(line, name, withTimestamp): string`
  - `triggerGpxDownload(line, name, withTimestamp): Promise<void>`
  - 가상 타임스탬프 (7 min/km 기반 시간 계산)
- [ ] Strava GPX import 실기기 테스트
- [ ] 카카오맵 GPX import 실기기 테스트

### 1.6 PMTiles 🟡
- OpenFreeMap Liberty 스타일 폴백으로 대체 (Protomaps 미사용)

---

## 2. 아키텍처

### 2.1 모듈 구성 🟢
`src/` 스캐폴딩 완료 (Plan §2.1 구조 전체):
- `map/`: mapView.ts, layers.ts, interactions.ts, overlay.ts
- `routing/`: provider.ts, orsClient.ts, segmentCache.ts
- `draw/`: drawStore.ts, pointMode.ts, dragMode.ts, routeComposer.ts, undoStack.ts, debounce.ts
- `gpx/`: export.ts
- `gallery/`: courses.ts, courses.json, galleryView.ts, loadCourse.ts
- `ui/`: toolbar.ts, sheet.ts, modeToggle.ts, tabs.ts, toast.ts, modal.ts, styles.css
- `util/`: coord.ts, dom.ts, format.ts
- `scripts/`: build-gallery.ts

### 2.2 상태 모델 🟢
- [x] `draw/drawStore.ts` — mode + points + isDragging + dragCapture, pub/sub
- [x] `routing/segmentCache.ts` — LRU 캐시
- [x] `draw/routeComposer.ts` — routeStore (segments Map, pending Set, totalMeters)
- [x] `map/overlay.ts` — FeatureCollection 관리, selectedId, editingId
- [x] uiStore 대신 갤러리/오버레이 자체 상태로 분산 관리

### 2.3 데이터 흐름 🟢
- [x] 점 모드 E2E — `pointMode.ts` → `drawStore` → `routeComposer` → ORS → 지도 레이어
- [x] 드래그 모드 E2E — `dragMode.ts` → `pointerup` 배치 라우팅
- [x] 오버레이 E2E — `courses.json` → `overlay.ts` → MapLibre GeoJSON source

### 2.4 undo/redo 🟢
- [x] `draw/undoStack.ts` — op log 기반 (add/move/delete/dragBatch/clear/loadCourse)
- [x] `dragBatch` 단일 op로 묶기 완료
- [x] 키보드 단축키 바인딩 (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`, `Esc`)

---

## 3. 기능 상세

### 3.1 그리기 모드 (점 / 드래그) 🟢

**공통**
- [x] `ui/modeToggle.ts` — 세그먼트 컨트롤 (점/드래그/선택)
- [x] `Esc` 키로 그리기 모드 종료

**점 모드**
- [x] 지도 클릭 → 점 추가
- [x] 마커 드래그 → 좌표 갱신 (mousedown + mousemove, touchstart + touchmove)
- [x] 삭제: long-press(모바일) / 더블클릭(데스크톱)
- [x] Undo/Redo 지원

**드래그 모드**
- [x] pointerdown → 캡처 시작
- [x] pointermove → 30m 이상 이동 시 waypoint 추가 (rAF throttle)
- [x] 임시 점선 표시 (라우팅 호출 없음)
- [x] 40개 상한 + 토스트 경고
- [x] pointerup → 배치 라우팅 (병렬 6개 제한)
- [x] 실패 세그먼트 빨간 점선 표시

**Clear / Reset**
- [x] 툴바 쓰레기통 → confirm 모달 → `drawStore.clear()`

### 3.2 경로 시각화 🟢
- [x] `map/layers.ts` — Plan §3.2 표에 따른 9개 레이어 정의
- [x] 레이어 순서: `overlay-lines < overlay-symbols < route-pending < route-error < route-halo < route-done < points-halo < points < points-label`
- [x] 흰 halo 2겹 스택 (`route-halo` + `route-done`)
- [x] 번호 라벨 (symbol layer)
- [x] 총거리 표시 (툴바)
- [x] Fit-to-bounds 버튼 (`@turf/bbox`)

### 3.3 GPX 내보내기 🟢
- [x] 툴바 "GPX" 버튼 → 이름 입력 모달
- [x] `gpx/export.ts` 직접 import (번들 분리는 추후)
- [x] 가상 타임스탬프 토글 UI

### 3.4 갤러리 (인기 코스 / 인기 아트런) 🟡

**데이터**
- [x] `gallery/courses.json` 스키마 완성 (Plan §3.4)
- [x] 시드 waypoints 수집 (관리자 수동 — 플레이스홀더 14개)
  - 인기 아트런 8개: 고구마런, 하트런, 고래런, 댕댕이런, 나비런, 붕어빵런, 거북이런, 옷걸이런
  - 인기 코스 6개: 한강야경, 남산순환, 올림픽공원, 서울숲, 청계천, 양재천
- [ ] ORS 프리컴퓨트 실행 (`pnpm precompute`) — ORS 키 발급 후 필요
- [ ] 썸네일 14장 WebP (300×200)

**프리컴퓨트**
- [x] `scripts/build-gallery.ts` — ORS 호출 + Douglas-Peucker 단순화

**UI (탭 2개)**
- [x] `ui/tabs.ts` — 인기 코스 / 인기 아트런 탭
- [x] `gallery/galleryView.ts` — 카드 목록 (썸네일·이름·거리·지역·설명)
- [x] 카드 클릭 → `flyTo` (1200ms)
- [x] "편집하기" 버튼 → waypoints 로드 + 오버레이 filter
- [x] "GPX 저장" 버튼 → 기존 route로 바로 내보냄

### 3.5 맵 오버레이 (상시 표시) 🟢
- [x] `map/overlay.ts` — 단일 source `courses-overlay` 등록
- [x] courses.json → FeatureCollection 변환 (routeSimplified 사용)
- [x] `overlay-lines` 레이어 (minzoom 10, artrun=dash, scenic=solid)
- [x] `overlay-symbols` 레이어 (maxzoom 10)
- [x] 선택 상태 `feature-state { selected }` + paint 분기
- [x] 편집 중 코스 filter 제외

### 3.6 반응형 레이아웃 🟢
- [x] 데스크톱 그리드 (사이드바 320px + 지도)
- [x] 모바일 타이틀 바 (48px) + 세로 toolbar
- [x] `ui/sheet.ts` — 바텀시트 3단계 (peek 80px / half 45vh / full 90vh), 드래그 제스처
- [x] iOS safe area (`viewport-fit=cover`, padding-bottom 환경변수 준비)
- [x] 1024px 브레이크포인트 미디어 쿼리

---

## 4. 성능 전략 🟡
- [ ] `gpx-export` 동적 import (현재 정적 import, 번들 크기 작아서 우선 보류)
- [ ] `gallery` 동적 import
- [ ] 이미지 WebP 파이프라인
- [x] Pretendard 서브셋 CDN (`cdn.jsdelivr.net`)
- [x] LocalStorage 라우팅 캐시 (`segmentCache.ts`)
- [ ] 드래그 모드 호출 횟수 실측
- [ ] 오버레이 렌더 후 fps 측정
- [ ] Lighthouse 모바일 ≥ 90
- [x] 빌드 분석 — maplibre chunk 217KB gzip, app 14KB gzip

---

## 5. 보안 / 키 관리 🟡
- [x] `.env.example` 커밋
- [x] `.env.local` gitignore 확인
- [ ] GitHub Secrets: `ORS_KEY`, `MAP_KEY` (레포 생성 후)
- [ ] ORS allowlist 등록 (키 발급 후)
- [ ] MapTiler allowlist 등록 (키 발급 후)
- [x] 키 누락 시 런타임 안내 토스트

---

## 6. 배포

### 6.1 GitHub Pages 🟢
- [x] `vite.config.ts`: `base: '/art-run/'`
- [x] `.github/workflows/deploy.yml` (pnpm + Node 20 + GitHub Pages)

### 6.2 CI 🟢
- [x] `.github/workflows/ci.yml` — typecheck + build (키 없이도 빌드 가능)

---

## 7. 향후 확장 ⚪
MVP 범위 밖. M4 이후 재평가.

---

## 마일스톤 현황

| 코드 | 정의 | 상태 | 메모 |
|---|---|---|---|
| **M0** | 기획/문서 | 🟢 | CLAUDE·Plan·Process 완료 |
| **M1** | 지도 + 점 모드 2점 → 인도 따라 선 | 🟡 | 코드 완성. ORS 키 발급 후 라우팅 동작 확인 필요 |
| **M2** | 드래그 모드 + 편집 + GPX 내보내기 | 🟡 | 코드 완성. 실기기 테스트 필요 |
| **M3** | 오버레이 + 갤러리(두 탭) + 반응형 + 배포 | 🟡 | 코드 완성. GitHub 레포·GitHub Pages 활성화 필요 |
| **M4** | 성능 튜닝 + 공개 | ⚪ | |

---

## 현재 블로커 / 결정 대기

> 진척을 가로막는 의존성·결정만 기록.

- [ ] **ORS API 키 발급** + `.env.local` 설정 → 실제 라우팅 테스트 가능
- [ ] **MapTiler API 키 발급** + `.env.local` 설정 → 한국어 라벨 지도 (없으면 OpenFreeMap 폴백)
- [ ] **GitHub 레포·Pages 활성화** → 배포
- [ ] **ORS 프리컴퓨트 실행** (`pnpm precompute`) → courses.json에 실제 route 데이터
- [ ] **썸네일 14장 제작** (WebP 300×200)

### 결정 완료 (로그)
- ✅ 프로젝트명 `ArtRun`, 레포 `art-run`
- ✅ 액센트 컬러 `#BDEFFC`
- ✅ 화면 구조 단일(맵 1개, 페이지 라우팅 없음)
- ✅ 지도 라이브러리 MapLibre GL JS v4
- ✅ 타일 서비스: MapTiler(키 있을 때) + OpenFreeMap(폴백)
- ✅ 그리기 모드 2종(점 + 드래그)
- ✅ 갤러리 2탭, 관리자 수동 큐레이션
- ✅ 가상 타임스탬프 기본 페이스: 7 min/km
- ✅ 모드 전환 버튼: 하단 센터 (모바일), floating (데스크톱)
- ✅ 오버레이 구분: artrun=dash `[2,2]` / scenic=실선

---

## 작업 로그

> 최신 작업이 위.

- `2026-04-17 (3)` — 전체 구현 완료 (M1~M3 코드). 파일 구조: 35개 소스 파일. TypeScript 검사 통과, 빌드 성공 (maplibre 217KB gzip, app 14KB gzip). ORS 키·GitHub 레포·프리컴퓨트는 사용자 작업 필요.
- `2026-04-17 (2)` — 기획 업데이트: 이름·컬러·레이아웃·드래그 모드 확정.
- `2026-04-17 (1)` — 초기 기획 문서 3종 작성.
