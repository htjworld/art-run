/**
 * 한글 GPX 파일 → artrun/scenic 분류 + 영문 ID 변환 마이그레이션
 * 실행: pnpm tsx scripts/migrate-gpx.ts
 */
import { copyFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const GPX_ROOT = join(process.cwd(), 'scripts', 'gpx');
const ARTRUN_DIR = join(GPX_ROOT, 'artrun');
const SCENIC_DIR = join(GPX_ROOT, 'scenic');

// 한글명 → [id, type, region, description]
const MAPPING: Record<string, [string, 'artrun' | 'scenic', string, string]> = {
  // ── 아트런 ───────────────────────────────────────────────────────────
  '경복궁 AR런':             ['gyeongbokgung-ar',          'artrun', '서울 종로',   '경복궁 일대를 AR 모양으로 달리는 아트런이에요.'],
  '경복궁 닥스훈트런':       ['gyeongbokgung-dachshund',   'artrun', '서울 종로',   '경복궁 일대를 닥스훈트 모양으로 달리는 아트런이에요.'],
  '광교 호수공원 꽃댕댕런':  ['gwanggyo-flower-dog',       'artrun', '경기 수원',   '광교호수공원을 꽃 모양 강아지로 달리는 아트런이에요.'],
  '광교호수공원 고래런':     ['gwanggyo-whale',             'artrun', '경기 수원',   '광교호수공원을 고래 모양으로 달리는 아트런이에요.'],
  '광화문 아기 도베르만런':  ['gwanghwamun-doberman',       'artrun', '서울 종로',   '광화문 일대를 아기 도베르만 모양으로 달리는 아트런이에요.'],
  '광화문 허스키런':         ['gwanghwamun-husky',          'artrun', '서울 종로',   '광화문 일대를 허스키 모양으로 달리는 아트런이에요.'],
  '구로디지털단지 백구런':   ['guro-white-dog',             'artrun', '서울 구로',   '구로디지털단지 주변을 하얀 강아지 모양으로 달리는 아트런이에요.'],
  '굽은다리 냥냥런':         ['gubeundari-cat',             'artrun', '서울 강동',   '굽은다리 일대를 고양이 모양으로 달리는 아트런이에요.'],
  '남부터미널 달리기런':     ['nambu-runner',               'artrun', '서울 서초',   '남부터미널 일대를 달리기 모양으로 달리는 아트런이에요.'],
  '동탄 따봉런':             ['dongtan-thumbsup',           'artrun', '경기 동탄',   '동탄 일대를 따봉 모양으로 달리는 아트런이에요.'],
  '마곡 카피바라런':         ['magok-capybara',             'artrun', '서울 강서',   '마곡 일대를 카피바라 모양으로 달리는 아트런이에요.'],
  '마곡 코끼리런':           ['magok-elephant',             'artrun', '서울 강서',   '마곡 일대를 코끼리 모양으로 달리는 아트런이에요.'],
  '반포한강공원 러너런':     ['banpo-runner',               'artrun', '서울 서초',   '반포한강공원을 러너 모양으로 달리는 아트런이에요.'],
  '방배 따봉런':             ['bangbae-thumbsup',           'artrun', '서울 서초',   '방배 일대를 따봉 모양으로 달리는 아트런이에요.'],
  '방배 따봉런2':            ['bangbae-thumbsup2',          'artrun', '서울 서초',   '방배 일대를 따봉 모양으로 달리는 아트런 2코스예요.'],
  '부천 푸들런':             ['bucheon-poodle',             'artrun', '경기 부천',   '부천 일대를 푸들 모양으로 달리는 아트런이에요.'],
  '북한산 나비런':           ['bukhansan-butterfly',        'artrun', '서울 북부',   '북한산 일대를 나비 모양으로 달리는 아트런이에요.'],
  '서울과기대 골댕런':       ['seoultech-golden',           'artrun', '서울 노원',   '서울과학기술대 일대를 골든리트리버 모양으로 달리는 아트런이에요.'],
  '서촌 고양이런':           ['seochon-cat',                'artrun', '서울 종로',   '서촌 일대를 고양이 모양으로 달리는 아트런이에요.'],
  '석촌호수 락앤롤런':       ['seokchon-rocknroll',         'artrun', '서울 송파',   '석촌호수 일대를 락앤롤 모양으로 달리는 아트런이에요.'],
  '석촌호수 썬그리런':       ['seokchon-sungri',            'artrun', '서울 송파',   '석촌호수 일대를 썬그리 모양으로 달리는 아트런이에요.'],
  '선릉 거북이런':           ['seolleung-turtle',           'artrun', '서울 강남',   '선릉 일대를 거북이 모양으로 달리는 아트런이에요.'],
  '송도 댕댕런':             ['songdo-dog',                 'artrun', '인천 연수',   '송도 일대를 강아지 모양으로 달리는 아트런이에요.'],
  '송도 안경강지런':         ['songdo-glasses-dog',         'artrun', '인천 연수',   '송도 일대를 안경 쓴 강아지 모양으로 달리는 아트런이에요.'],
  '신논현 G런':              ['sinnonhyeon-g',              'artrun', '서울 강남',   '신논현 일대를 G 모양으로 달리는 아트런이에요.'],
  '신논현 집런':             ['sinnonhyeon-house',          'artrun', '서울 강남',   '신논현 일대를 집 모양으로 달리는 아트런이에요.'],
  '신대방 어흥이런':         ['sindaebang-tiger',           'artrun', '서울 동작',   '신대방 일대를 호랑이 모양으로 달리는 아트런이에요.'],
  '신사 못생긴놈런':         ['sinsa-ugly',                 'artrun', '서울 강남',   '신사 일대를 못생긴 모양으로 달리는 아트런이에요.'],
  '신사 하트런':             ['sinsa-heart',                'artrun', '서울 강남',   '신사 일대를 하트 모양으로 달리는 아트런이에요.'],
  '신사 흰둥이런':           ['sinsa-white-dog',            'artrun', '서울 강남',   '신사 일대를 하얀 강아지 모양으로 달리는 아트런이에요.'],
  '신설동 메롱런':           ['sinseol-tongue',             'artrun', '서울 동대문', '신설동 일대를 메롱 모양으로 달리는 아트런이에요.'],
  '신월동 루돌프런':         ['sinwol-rudolph',             'artrun', '서울 양천',   '신월동 일대를 루돌프 모양으로 달리는 아트런이에요.'],
  '안양 물개런':             ['anyang-seal',                'artrun', '경기 안양',   '안양 일대를 물개 모양으로 달리는 아트런이에요.'],
  '압구정 장미런':           ['apgujeong-rose',             'artrun', '서울 강남',   '압구정 일대를 장미 모양으로 달리는 아트런이에요.'],
  '양재시민의숲 피자런':     ['yangjae-pizza',              'artrun', '서울 서초',   '양재시민의숲 일대를 피자 모양으로 달리는 아트런이에요.'],
  '양천둘레길 나는냥이런':   ['yangcheon-cat',              'artrun', '서울 양천',   '양천 둘레길을 고양이 모양으로 달리는 아트런이에요.'],
  '양평군 날아오르라주작이어런': ['yangpyeong-phoenix',     'artrun', '경기 양평',   '양평군 일대를 주작 모양으로 달리는 아트런이에요.'],
  '어린이대공원 붕어빵런':   ['olympic-fishbread',          'artrun', '서울 광진',   '어린이대공원 주변을 붕어빵 모양으로 달리는 아트런이에요.'],
  '여의나루 고구마런':       ['yeouinaru-sweetpotato',      'artrun', '서울 영등포', '여의나루 일대를 고구마 모양으로 달리는 아트런이에요.'],
  '원주 냥냥런':             ['wonju-cat',                  'artrun', '강원 원주',   '원주 일대를 고양이 모양으로 달리는 아트런이에요.'],
  '을지로 멍멍이런':         ['euljiro-dog',                'artrun', '서울 중구',   '을지로 일대를 강아지 모양으로 달리는 아트런이에요.'],
  '의정부시 멍뭉이런':       ['uijeongbu-dog',              'artrun', '경기 의정부', '의정부 일대를 강아지 모양으로 달리는 아트런이에요.'],
  '인천 댕댕달려런':         ['incheon-dog',                'artrun', '인천',        '인천 일대를 달리는 강아지 모양으로 달리는 아트런이에요.'],
  '잠실 댕댕이런':           ['jamsil-dog',                 'artrun', '서울 송파',   '잠실 일대를 강아지 모양으로 달리는 아트런이에요.'],
  '종로1가 공룡런':          ['jongno-dinosaur',            'artrun', '서울 종로',   '종로1가 일대를 공룡 모양으로 달리는 아트런이에요.'],
  '죽전 코끼리런':           ['jukjeon-elephant',           'artrun', '경기 용인',   '죽전 일대를 코끼리 모양으로 달리는 아트런이에요.'],
  '합정 F45런':              ['hapjeong-f45',               'artrun', '서울 마포',   '합정 일대를 F45 모양으로 달리는 아트런이에요.'],
  '합정 하트런':             ['hapjeong-heart',             'artrun', '서울 마포',   '합정 일대를 하트 모양으로 달리는 아트런이에요.'],
  '홍대 야옹런':             ['hongdae-cat',                'artrun', '서울 마포',   '홍대 일대를 고양이 모양으로 달리는 아트런이에요.'],
  '홍대입구 가오리런':       ['hongdae-stingray',           'artrun', '서울 마포',   '홍대입구 일대를 가오리 모양으로 달리는 아트런이에요.'],
  '효창공원 불토끼런':       ['hyochang-rabbit',            'artrun', '서울 용산',   '효창공원 일대를 불토끼 모양으로 달리는 아트런이에요.'],
  '효창공원앞역 트리런':     ['hyochang-tree',              'artrun', '서울 용산',   '효창공원앞역 일대를 트리 모양으로 달리는 아트런이에요.'],
  // ── 인기 코스 (scenic) ────────────────────────────────────────────────
  '2026 인천국제하프마라톤대회': ['incheon-half-marathon-2026', 'scenic', '인천',        '2026 인천국제하프마라톤 공식 코스예요.'],
  '다산 크게 한바퀴 러닝':   ['dasan-loop',                 'scenic', '경기 남양주', '다산 일대를 크게 한 바퀴 도는 러닝 코스예요.'],
  '성내천 하프코스':         ['seongnae-half',              'scenic', '서울 강동',   '성내천을 따라 달리는 하프 코스예요.'],
  '양재천 러닝':             ['yangjae-stream',             'scenic', '서울 서초·강남', '양재천을 따라 달리는 시원한 러닝 코스예요.'],
};

// 유지할 기존 파일 (삭제 안 함)
const KEEP = new Set(['jongno-dog', 'gwanghwamun-dachshund']);

function main(): void {
  // 1. 기존 artrun/scenic 파일 중 KEEP 제외하고 모두 삭제
  for (const dir of [ARTRUN_DIR, SCENIC_DIR]) {
    for (const f of readdirSync(dir)) {
      const id = f.replace(/\.(gpx|json)$/, '');
      if (!KEEP.has(id)) {
        rmSync(join(dir, f));
      }
    }
  }
  console.log('기존 파일 정리 완료 (jongno-dog, gwanghwamun-dachshund 유지)');

  // 2. 루트 GPX 파일 처리
  const rootFiles = readdirSync(GPX_ROOT).filter(f => f.endsWith('.gpx'));
  let ok = 0, skip = 0;

  for (const file of rootFiles) {
    const korName = file.replace(/\.gpx$/, '');
    const entry = MAPPING[korName];

    if (!entry) {
      console.warn(`⚠️  매핑 없음 — 건너뜀: ${file}`);
      skip++;
      continue;
    }

    const [id, type, region, description] = entry;
    const destDir = type === 'artrun' ? ARTRUN_DIR : SCENIC_DIR;

    copyFileSync(join(GPX_ROOT, file), join(destDir, `${id}.gpx`));

    const jsonPath = join(destDir, `${id}.json`);
    if (!existsSync(jsonPath)) {
      writeFileSync(jsonPath, JSON.stringify({
        name: korName,
        region,
        description,
        thumbnail: '',
        zoom: 14,
      }, null, 2), 'utf-8');
    }

    console.log(`✅ [${type}] ${korName} → ${id}`);
    ok++;
  }

  console.log(`\n완료: ${ok}개 처리, ${skip}개 건너뜀`);
  console.log('다음: pnpm precompute');
}

main();
