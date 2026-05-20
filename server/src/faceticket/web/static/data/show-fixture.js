window.FT = window.FT || {};
FT.data = FT.data || {};

FT.data.SHOW = {
  artist:    'NOISE FLOOR',
  artistKo:  '노이즈 플로어',
  tour:      'ZERO POINT TOUR 2026',
  tourKo:    '영점 투어 2026',
  city:      'SEOUL',
  cityKo:    '서울',
  venue:     'OLYMPIC HALL',
  venueKo:   '올림픽홀',
  date:      '2026·05·19',
  weekday:   'TUE',
  doors:     '19:00',
  show:      '20:00',
  inter:     '20:55',
  encore:    '22:10',
  end:       '22:30',
  capacity:  3200,
  attended:  1247,
  opening:   'STATIC VEIL',
  openingKo: '정적의 베일',
  showCode:  'NF·SE·26·05·19',
};

FT.data.SETLIST = [
  { n: '01', titleKo: '영점',         titleEn: 'ZERO POINT',  dur: '03:42', kind: 'intro' },
  { n: '02', titleKo: '신호와 잡음',   titleEn: 'SIGNAL / NOISE', dur: '04:18' },
  { n: '03', titleKo: '거리 함수',     titleEn: 'DISTANCE',    dur: '03:55' },
  { n: '04', titleKo: 'CALIBRATION',  titleEn: 'CALIBRATION', dur: '05:01' },
  { n: '05', titleKo: '잔향',          titleEn: 'RESIDUAL',    dur: '04:24' },
  { n: '06', titleKo: 'ARC LIGHT',    titleEn: 'ARC LIGHT',   dur: '03:36' },
  { n: '07', titleKo: '0 dB',         titleEn: 'ZERO DB',     dur: '04:47' },
  { n: '08', titleKo: '코사인',        titleEn: 'COSINE',      dur: '05:20' },
  { n: 'EN', titleKo: '반감기',        titleEn: 'HALF-LIFE',   dur: '06:08', kind: 'encore' },
];

FT.data.ZONES = {
  PIT:    { code: 'ZN.PIT',  ko: 'PIT 입석',      en: 'STANDING PIT',   color: '#d83a1f', led: 'pulse.red' },
  FLOOR:  { code: 'ZN.FLR',  ko: '플로어 지정석',  en: 'FLOOR SEATED',   color: '#d83a1f', led: 'pulse.red' },
  MEZZ:   { code: 'ZN.MEZ',  ko: '메자닌',         en: 'MEZZANINE',      color: '#15110b', led: 'pulse.white' },
  BALC:   { code: 'ZN.BAL',  ko: '발코니',         en: 'BALCONY',        color: '#857c6c', led: 'pulse.dim' },
};

FT.data.RANDOM_NAMES = [
  ['김민준','Min-Jun Kim'], ['서지윤','Ji-Yoon Seo'], ['이도현','Do-Hyun Lee'],
  ['박서연','Seo-Yeon Park'], ['최예준','Ye-Jun Choi'], ['정하늘','Ha-Neul Jeong'],
  ['윤지호','Ji-Ho Yoon'], ['임수아','Su-A Lim'], ['강민서','Min-Seo Kang'],
  ['오태경','Tae-Kyung Oh'],
];

FT.data.RANDOM_ZONES = [
  ['PIT', 'ZN.PIT · STANDING PIT'],
  ['FL',  'ZN.FLR · FLOOR SEATED'],
  ['MZ',  'ZN.MEZ · MEZZANINE'],
  ['BAL', 'ZN.BAL · BALCONY'],
];

FT.data.CAPACITY_BREAKDOWN = [
  ['ZN.PIT · 입석',   '140',  '180'],
  ['ZN.FLR · 플로어', '612',  '980'],
  ['ZN.MEZ · 메자닌', '240',  '800'],
  ['ZN.BAL · 발코니', '255',  '1240'],
];
