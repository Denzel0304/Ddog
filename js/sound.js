// =============================================
// sound.js — 효과음 재생
// =============================================

let _completeSoundAudio = null;

function playCompleteSound() {
  try {
    if (!_completeSoundAudio) {
      _completeSoundAudio = new Audio('effect 1.mp3');
      _completeSoundAudio.volume = 0.7;
    }
    _completeSoundAudio.currentTime = 0;
    _completeSoundAudio.play().catch(() => {});
  } catch(e) {}
}
