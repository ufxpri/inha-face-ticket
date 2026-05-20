window.FT = window.FT || {};
FT.lib = FT.lib || {};

FT.lib.srand = function srand(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
};
