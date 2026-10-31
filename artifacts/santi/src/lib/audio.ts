let _ctx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  return _ctx;
}

function beep(freq: number, duration: number, gain = 0.25, type: OscillatorType = "sine") {
  try {
    const c = ctx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + duration);
  } catch {}
}

export function playNewReport() {
  beep(880, 0.08, 0.2);
  setTimeout(() => beep(1100, 0.12, 0.18), 90);
  setTimeout(() => beep(1320, 0.2, 0.15), 200);
}

export function playAgentActivated(agentId: string) {
  const freqs: Record<string, number[]> = {
    santi: [660, 880], emiliano: [550, 770], maxi: [440, 660],
    santiago: [770, 990], katering: [880, 1100],
  };
  const pair = freqs[agentId] || [660, 880];
  beep(pair[0], 0.1, 0.18);
  setTimeout(() => beep(pair[1], 0.2, 0.14), 120);
}
