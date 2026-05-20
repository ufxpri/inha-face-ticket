// theme.jsx — 3 visual directions for the Face Access System
// Off-white + ink + single accent. AI lab / research instrument vibe.
// Title naming + tokens consumed by parts.jsx and scenes.jsx.

const THEMES = {
  // A — Lab Notebook
  //  Warm bone background, ink black, signal red accent.
  //  Dense data, thin lines, NASA-telemetry × Swiss notebook.
  A: {
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
    accent:   '#d83a1f', // signal red
    accentInk:'#ffffff',
    ok:       '#15110b',
    sansFamily: '"IBM Plex Sans KR", "IBM Plex Sans", sans-serif',
    monoFamily: '"IBM Plex Mono", ui-monospace, monospace',
    headerWeight: 600,
    // Radial chart character
    radial: { rings: 4, dense: true, dashed: true, strokeMain: 1.25 },
  },
  // B — Quiet Instrument
  //  Cool off-white, deep ink, chartreuse signal accent.
  //  Spacious, calm, single hero element — feels like a measurement device.
  B: {
    id: 'B',
    name: 'Quiet Instrument',
    nameKo: '계측기',
    bg:       '#eceee9',
    paper:    '#f4f6f1',
    surface:  '#ffffff',
    ink:      '#0c0e0b',
    ink2:     '#2c3029',
    mute:     '#6f756b',
    line:     '#c8ccc2',
    line2:    '#dee2d8',
    accent:   '#c8f02d', // lime — used sparingly, on dark chips only
    accentInk:'#15170d',
    ok:       '#0c0e0b',
    sansFamily: '"IBM Plex Sans KR", "IBM Plex Sans", sans-serif',
    monoFamily: '"IBM Plex Mono", ui-monospace, monospace',
    headerWeight: 500,
    radial: { rings: 3, dense: false, dashed: false, strokeMain: 1.0 },
  },
  // C — Bauhaus Bio
  //  Cream/bone, espresso ink, ultramarine accent.
  //  Big shapes, confident poster typography, fewer elements louder.
  C: {
    id: 'C',
    name: 'Bauhaus Bio',
    nameKo: '바우하우스 바이오',
    bg:       '#f1ebd9',
    paper:    '#f7f1de',
    surface:  '#fbf6e6',
    ink:      '#19140c',
    ink2:     '#3a2f1f',
    mute:     '#79694e',
    line:     '#cfbf99',
    line2:    '#e5d9b8',
    accent:   '#2a3cff', // ultramarine
    accentInk:'#f1ebd9',
    ok:       '#19140c',
    sansFamily: '"IBM Plex Sans KR", "IBM Plex Sans", sans-serif',
    monoFamily: '"IBM Plex Mono", ui-monospace, monospace',
    headerWeight: 700,
    radial: { rings: 2, dense: false, dashed: false, strokeMain: 2.0 },
  },
};

window.THEMES = THEMES;
