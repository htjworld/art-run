# ArtRun — TODO

> 원칙: 서버리스, 모바일 우선, 쿼터 안전. 기능 추가보다 핵심 경험 완성 우선.

---

## 🔴 버그 / 안정성

### ORS rate limit 핸들링 없음
현재 `MAX_PARALLEL=2`로 요청 수를 줄이지만 429 응답 시 별도 처리 없이 에러 세그먼트로 표시됨.  
→ 429 수신 시 `Retry-After` 헤더 읽어서 자동 재시도 (orsClient.ts)

### localStorage 캐시 read/write 비용
`segmentCache.ts`가 매 get/set마다 전체 JSON.parse + JSON.stringify 호출.  
→ 앱 시작 시 한 번 메모리에 load, 변경분만 flush (dirty flag 패턴)

---

## 🟠 핵심 기능 (STP 직결, 서버리스 가능)

### 경로 공유 링크
"내가 만든 아트런 경로를 친구에게 공유" — 현재 GPX 파일 다운로드만 있음.  
→ waypoints를 base64/URL-safe 인코딩해서 `#r=...` 해시로 URL에 담기.  
→ 링크 열면 경로 자동 복원 + 지도 fitBounds.  
→ 구현: `util/shareRoute.ts` — encode/decode 함수, toolbar에 공유 버튼 추가.  
→ 서버 불필요. 좌표 수 많으면 gzip(pako) 적용 고려.

### GPX 불러오기
기존 Strava·카카오 경로를 앱에 불러와서 참고하거나 수정하고 싶은 유저.  
→ 지도 위 drag & drop 또는 toolbar 파일 버튼으로 `.gpx` 파싱.  
→ `<trkpt>` 좌표를 점으로 변환 → drawStore에 적재.  
→ 구현: `gpx/import.ts` (export.ts와 대칭)

### 갤러리 썸네일 이미지
현재 55개 코스 전체 `thumbnail: ""`. 갤러리 카드가 텍스트뿐이라 임팩트 없음.  
→ 코스별 대표 구간 스크린샷 WebP (300×200) 촬영 후 `assets/thumbnails/` 저장.  
→ `courses.json`에 경로 입력 (`/art-run/thumbnails/yeouido-sweetpotato.webp`).

### OG / meta 태그
링크 공유 시 카카오톡·트위터·슬랙 미리보기 없음.  
→ `index.html`에 `og:title`, `og:description`, `og:image` 추가.  
→ og:image는 앱 스크린샷 1장 (정적 파일).

---

## 🟡 UX 개선

### 완료된 경로 통계 패널
GPX 저장 전 "총 거리 4.2km · 예상 소요 30분" 같은 요약 표시.  
→ 현재 toolbar에 거리만 있음. 페이스 기반 예상 시간(`PACE_SEC_PER_M`)은 export.ts에 이미 있음.  
→ toolbar `distanceEl` 옆에 예상 시간 추가 (단순 계산, 서버 불필요).

### 점 선택 / 삭제 UX 명확화
현재 점 클릭 → `Delete` 키로만 삭제. 모바일에서 Delete 키 없음.  
→ 점 탭(모바일) 시 툴팁 or 작은 삭제 버튼 표시.

### 그리기 모드 진입 힌트 개선
현재 최초 3초 후 힌트 사라짐. 모드별 힌트가 없음.  
→ 모드 전환 시 하단에 1줄 맥락 힌트 (예: "점을 찍어 경로를 이어보세요").  
→ localStorage로 N회 이상 사용 시 자동 숨김.

### 지도 스타일 토글 (위성 / 일반)
도심 아트런 설계 시 위성 사진이 훨씬 유용.  
→ MapTiler satellite 스타일 URL 추가 (키 있을 때만 노출).  
→ toolbar 또는 지도 우상단 소형 버튼.

### 쿼터 경고 토스트
ORS 일 2000회 한도. 현재 초과 시 에러 세그먼트만 표시됨.  
→ 429 응답 수가 3회 이상 누적되면 "오늘 경로 계산 한도에 가까워요. 잠시 후 시도해주세요" 토스트.

---

## 🟢 콘텐츠 (코드 아닌 데이터 작업)

### 코스 큐레이션 확대
현재 55개. 서울 주요 구별 대표 아트런 1개씩만 있어도 25개 추가 가능.  
→ 특히 `artrun` 타입 부족. 하트런·별런·글자런 등 추가.  
→ 빌드 스크립트(`scripts/build-gallery.ts`)로 프리컴퓨트.

### 코스별 난이도·태그
`courses.ts` Course 타입에 `tags: string[]` 추가 (`초보`, `야경`, `공원`, `업힐` 등).  
→ 갤러리 필터 UI와 연계 가능.

---

## ⚪ v2 이후 (백엔드 or 큰 작업)

- **유저 경로 저장·공유** — Supabase or Cloudflare KV
- **커뮤니티 갤러리** — 유저 업로드 아트런 모음
- **Strava 자동 연동** — OAuth + Strava API
- **PWA / 오프라인** — 타일 캐시 + Service Worker
- **다크모드**
- **다국어 (en)** — 해외 러너 유입 시

---

## 구현 우선순위 추천

```
경로 공유 링크  →  GPX 불러오기  →  썸네일  →  OG 태그  →  UX 개선들
```

공유 링크가 1순위인 이유: 앱의 핵심 가치("내가 설계한 아트런")를 증폭시키는 유일한 바이럴 루프.  
비용 0원, 서버 불필요, 구현 1-2일.
