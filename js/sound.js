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
  // iOS Safari: AudioContext 무음 재생으로 언락 (실제 오디오 재생 없이 정책 해제)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    src.onended = () => { ctx.close(); _audioUnlocked = true; };
  } catch(e) {
    _audioUnlocked = true;
  }
}

document.addEventListener('touchstart', _unlockAudio, { passive: true, once: true });
document.addEventListener('mousedown',  _unlockAudio, { once: true });

function playCompleteSound() {
  try {
    _sfxComplete.currentTime = 0;
    _sfxComplete.play().catch(() => {});
  } catch(e) {}
}
