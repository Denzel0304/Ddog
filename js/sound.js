// =============================================
// sound.js — 효과음 재생
// =============================================

let _audioCtx = null;
let _audioBuffer = null;
let _audioLoaded = false;
let _audioLoading = false;

// 오디오 컨텍스트 & 버퍼 미리 로드
async function _loadCompleteSound() {
  if (_audioLoaded || _audioLoading) return;
  _audioLoading = true;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const response = await fetch('effect 1.mp3');
    if (!response.ok) throw new Error('fetch failed');
    const arrayBuffer = await response.arrayBuffer();
    _audioBuffer = await _audioCtx.decodeAudioData(arrayBuffer);
    _audioLoaded = true;
  } catch(e) {
    // 로드 실패 시 다음 시도를 위해 플래그 초기화
    _audioLoading = false;
    _audioCtx = null;
    _audioBuffer = null;
  }
}

// 첫 사용자 인터랙션 시 미리 로드 (autoplay unlock)
document.addEventListener('touchstart', _loadCompleteSound, { once: true, passive: true });
document.addEventListener('mousedown',  _loadCompleteSound, { once: true });

function playCompleteSound() {
  try {
    if (!_audioLoaded || !_audioCtx || !_audioBuffer) {
      // 아직 로드 안 됐으면 로드 후 재생
      _loadCompleteSound().then(() => {
        if (_audioLoaded && _audioCtx && _audioBuffer) _playBuffer();
      });
      return;
    }
    _playBuffer();
  } catch(e) {}
}

function _playBuffer() {
  try {
    const doPlay = () => {
      const source = _audioCtx.createBufferSource();
      source.buffer = _audioBuffer;
      const gainNode = _audioCtx.createGain();
      gainNode.gain.value = 0.7;
      source.connect(gainNode);
      gainNode.connect(_audioCtx.destination);
      source.start(0);
    };
    if (_audioCtx.state === 'suspended') {
      _audioCtx.resume().then(doPlay).catch(() => {});
    } else {
      doPlay();
    }
  } catch(e) {}
}
