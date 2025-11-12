// === RTJ Singing for Sanity v1.1 (Stable Diagnostic Build) ===
console.log("✅ singing-for-sanity.js linked");

// Globals
let micStream, audioCtx, analyser, dataArray;
let isMicOn = false;
let oscillator;

const micBtn = document.getElementById("micToggle");
const playToneBtn = document.getElementById("playTone");
const saveBtn = document.getElementById("saveProgress");
const logBox = document.getElementById("logBox");
const noteDisplay = document.querySelector(".note-display");
const freqDisplay = document.querySelector(".freq-display");
const canvas = document.getElementById("pitchCanvas");
const ctx = canvas.getContext("2d");

// Canvas init
function setCanvasSize() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  ctx.fillStyle = "#eaf6ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#005fa3";
  ctx.font = "16px Inter, system-ui, sans-serif";
  ctx.fillText("Canvas OK", 10, 20);
  console.log("🖼️ Canvas initialised:", canvas.width, "x", canvas.height);
}
window.addEventListener("load", setCanvasSize);
window.addEventListener("resize", setCanvasSize);

// Mic toggle
micBtn.addEventListener("click", async () => {
  if (!isMicOn) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(micStream);
      source.connect(analyser);
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.fftSize);
      isMicOn = true;
      micBtn.textContent = "🎙️ Mic On";
      micBtn.classList.remove("off");
      console.log("🎙️ Mic stream active");
      detectPitch();
    } catch (err) {
      console.error("❌ Mic error:", err);
      micBtn.textContent = "Mic Error";
    }
  } else {
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    isMicOn = false;
    micBtn.textContent = "🎙️ Mic Off";
    micBtn.classList.add("off");
    console.log("🛑 Mic stopped");
  }
});

// Simple autocorrelation pitch detect
function autoCorrelate(buf, sampleRate) {
  let SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    let val = buf[i] / 128 - 1;
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1, thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++)
    if (Math.abs(buf[i] - 128) > thres * 128) { r1 = i; break; }
  for (let i = 1; i < SIZE / 2; i++)
    if (Math.abs(buf[SIZE - i] - 128) > thres * 128) { r2 = SIZE - i; break; }
  buf = buf.slice(r1, r2);
  SIZE = buf.length;
  let c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++)
    for (let j = 0; j < SIZE - i; j++)
      c[i] = c[i] + buf[j] * buf[j + i];

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  let T0 = maxpos;
  return sampleRate / T0;
}

function noteFromPitch(freq) {
  if (freq <= 0) return "-";
  const noteNames = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
  const noteNum = 12 * (Math.log(freq / 440) / Math.log(2));
  const noteIndex = Math.round(noteNum) + 69;
  return noteNames[noteIndex % 12];
}

function detectPitch() {
  if (!isMicOn) return;
  analyser.getByteTimeDomainData(dataArray);
  const freq = autoCorrelate(dataArray, audioCtx.sampleRate);
  if (freq > 0) {
    const note = noteFromPitch(freq);
    noteDisplay.textContent = note;
    freqDisplay.textContent = freq.toFixed(1) + " Hz";
    drawPulse(freq);
  }
  requestAnimationFrame(detectPitch);
}

// Calm-EQ pulse
function drawPulse(freq) {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const rangeMin = 80, rangeMax = 1000;
  const norm = (Math.log(freq) - Math.log(rangeMin)) /
               (Math.log(rangeMax) - Math.log(rangeMin));
  const y = h - (norm * h);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#eaf6ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(w / 2, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(102,179,255,0.8)";
  ctx.shadowBlur = 20;
  ctx.shadowColor = "rgba(102,179,255,0.4)";
  ctx.fill();
  ctx.shadowBlur = 0;
}

// Tuning fork
playToneBtn.addEventListener("click", () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  if (oscillator) oscillator.stop();

  const targetSelect = document.getElementById("targetNote");
  const note = targetSelect.value;
  const freqMap = {C3:130.81,D3:146.83,E3:164.81,F3:174.61,G3:196.00,A3:220.00,B3:246.94,
                   C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392.00,A4:440.00,B4:493.88,
                   C5:523.25};
  const freq = freqMap[note] || 440;

  oscillator = audioCtx.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.value = freq;
  oscillator.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 1.5);
  console.log(`🔔 Played tone ${note} (${freq} Hz)`);
});

// Save mock
saveBtn.addEventListener("click", () => {
  const now = new Date();
  const entry = `✅ ${now.toLocaleTimeString()} — Note: ${noteDisplay.textContent}, ${freqDisplay.textContent}`;
  const p = document.createElement("p");
  p.textContent = entry;
  logBox.appendChild(p);
  logBox.scrollTop = logBox.scrollHeight;
  console.log("💾 Saved log entry");
});

console.log("RTJ Singing for Sanity JS fully loaded");
