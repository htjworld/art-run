# ArtRun — CLAUDE.md

- 프로젝트: **ArtRun** / 레포: `art-run` / UI 표기: `아트런`
- 스택: Vanilla TS + Vite + MapLibre GL JS / 배포: GitHub Pages (`base: '/art-run/'`)
- 핵심 원칙: **점·선 그리기 → 보행 경로(ORS foot-walking)로 이어짐 → GPX 다운로드**

---

## 브랜드 컬러 (확정)

| 역할 | 값 |
|---|---|
| 메인 터코이즈 (accent) | `#BDEFFC` |
| 메인 블랙 (텍스트·선·포인트) | `#242424` |
| 베이스 배경 | `#FFFFFF` |
| 뮤트 | `#6B7280` |
| 위험 | `#EF4444` |

새 색 추가 전 반드시 위 두 메인 색으로 해결 가능한지 먼저 검토.
경로 라인: 흰 halo(9px) + `#242424`(5px) 2레이어 스택.

---

## 자주 실수하는 것들

- **좌표 순서** — GeoJSON `[lng, lat]`, GPX `lat="..." lon="..."`. 변환은 `util/coord.ts`에서만.
- **라우팅 프로필** — 반드시 `foot-walking`.
- **GPX 포맷** — `<trk>/<trkseg>/<trkpt>`, UTF-8, `xmlns="http://www.topografix.com/GPX/1/1"`.
- **MapLibre 회색 화면** — 숨겨진 컨테이너에서 mount 시 `map.resize()` 필수.
- **오버레이 소스** — 모든 코스를 단일 FeatureCollection, 단일 source로. 코스별 별도 source 금지.
- **레이어 순서** — `overlay < route-pending < route-done < points` 순서 유지.
- **드래그 중 라우팅 호출** — pointerup 이후 배치 라우팅. 매 프레임 호출 시 쿼터 즉시 소진.
- **디바운스 취소** — 진행 중 요청은 반드시 `AbortController.abort()`.
- **전체 경로 재계산** — 중간 점 수정 시 인접 2 세그먼트만 재계산 (`recomputeAdjacent`).
- **갤러리 런타임 라우팅** — 인기 코스는 프리컴퓨트된 `route`/`routeSimplified` 사용. 런타임 라우팅 0.
- **API 키** — 정적 배포라 번들에 포함됨. 반드시 제공자 대시보드에서 도메인 allowlist 설정.

---

## 금지사항

- 직선 폴리라인을 최종 경로로 저장
- 페이지 라우팅 추가 — 모든 UI는 같은 화면의 오버레이로만
- 갤러리 코스 런타임 라우팅 재구성
- `@turf/turf` 전체 import (필요한 모듈만)
- PWA·오프라인·계정·유저 업로드 기능 (v2 이후)
