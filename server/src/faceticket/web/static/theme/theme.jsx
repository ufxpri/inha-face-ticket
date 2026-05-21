window.FT = window.FT || {};
FT.theme = FT.theme || {};

const THEME_A = {
  id: 'A',
  name: 'Lab Notebook',
  nameKo: '실험 노트',
  bg:       '#efeae0',
  paper:    '#f7f3ea',
  surface:  '#ffffff',
  ink:      '#15110b',
  ink2:     '#3a342a',
  mute:     '#857c6c',
  line:     '#cabea6',
  line2:    '#e2d8c2',
  accent:   '#d83a1f',     // warn / 부드러운 강조 (오렌지-레드)
  danger:   '#a01010',     // error / 위험 (어두운 진홍)
  accentInk:'#ffffff',
  ok:       '#15110b',
  sansFamily: '"IBM Plex Sans KR", "IBM Plex Sans", sans-serif',
  monoFamily: '"IBM Plex Mono", ui-monospace, monospace',
  headerWeight: 600,
  radial: { rings: 4, dense: true, dashed: true, strokeMain: 1.25 },
};

FT.theme.A = THEME_A;
