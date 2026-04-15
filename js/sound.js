// =============================================
// sound.js — 효과음 재생
// =============================================

const _sfxComplete = new Audio('effect 1.mp3');
_sfxComplete.volume = 0.7;
let _audioUnlocked = false;

// 첫 사용자 인터랙션 시 autoplay 잠금 해제
function _unlockAudio() {
  if (_audioUnlocked) return;
  _sfxComplete.play().then(() => {
    _sfxComplete.pause();
    _sfxComplete.currentTime = 0;
  }).catch(() => {});
  _audioUnlocked = true;
}

document.addEventListener('touchstart', _unlockAudio, { once: true, passive: true });
document.addEventListener('mousedown',  _unlockAudio, { once: true });

function playCompleteSound() {
  try {
    _sfxComplete.currentTime = 0;
    _sfxComplete.play().catch(() => {});
  } catch(e) {}
}
