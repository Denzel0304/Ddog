// =============================================
// sound.js — 효과음 재생
// =============================================

const _sfxComplete = new Audio();
_sfxComplete.src = (function() {
  // index.html 기준 루트 경로로 고정
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    const src = scripts[i].src;
    if (src && src.includes('sound.js')) {
      return src.replace(/js\/sound\.js.*$/, 'effect 1.mp3');
    }
  }
  return 'effect 1.mp3';
})();
_sfxComplete.volume = 0.7;
_sfxComplete.preload = 'auto';

let _audioUnlocked = false;

function _unlockAudio() {
  if (_audioUnlocked) return;
  _sfxComplete.play().then(() => {
    _sfxComplete.pause();
    _sfxComplete.currentTime = 0;
    _audioUnlocked = true;
  }).catch(() => {
    // 실패해도 다음 인터랙션에서 재시도할 수 있도록 플래그 세우지 않음
  });
}

document.addEventListener('touchstart', _unlockAudio, { passive: true });
document.addEventListener('mousedown',  _unlockAudio);

function playCompleteSound() {
  try {
    _sfxComplete.currentTime = 0;
    _sfxComplete.play().catch(() => {});
  } catch(e) {}
}
