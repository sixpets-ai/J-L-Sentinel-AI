export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type AgentVoiceProfile = {
  gender: "feminine" | "masculine";
  rate: number;
  pitch: number;
};

const voiceProfiles: Record<string, AgentVoiceProfile> = {
  santi: { gender: "masculine", rate: 0.94, pitch: 0.9 },
  emiliano: { gender: "masculine", rate: 0.88, pitch: 0.82 },
  maxi: { gender: "masculine", rate: 0.92, pitch: 0.94 },
  santiago: { gender: "masculine", rate: 0.98, pitch: 1.02 },
  katering: { gender: "feminine", rate: 0.92, pitch: 1.12 },
};

const feminineVoiceNames = /female|woman|femenina|mujer|paulina|monica|sabina|helena|lucia|lucía/i;
const masculineVoiceNames = /male|man|masculino|hombre|jorge|diego|carlos|antonio|juan/i;

function chooseSpanishVoice(
  voices: SpeechSynthesisVoice[],
  gender: AgentVoiceProfile["gender"],
): SpeechSynthesisVoice | undefined {
  const spanishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("es"));
  const candidates = spanishVoices.length > 0 ? spanishVoices : voices;
  const namePattern = gender === "feminine" ? feminineVoiceNames : masculineVoiceNames;

  return candidates.find((voice) => namePattern.test(voice.name)) ?? candidates[0];
}

export function speakAsAgent(
  text: string,
  agentId: string,
  onEnd: () => void,
): boolean {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) return false;

  const profile = voiceProfiles[agentId] ?? voiceProfiles.santi;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "es-MX";
  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  utterance.voice = chooseSpanishVoice(window.speechSynthesis.getVoices(), profile.gender) ?? null;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopAgentSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function createSpeechRecognizer(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;

  const speechWindow = window as SpeechWindow;
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  return Recognition ? new Recognition() : null;
}

export function getSpeechTranscript(event: Event): string {
  const speechEvent = event as Event & {
    results: ArrayLike<{ 0?: { transcript?: string } }>;
  };

  return Array.from({ length: speechEvent.results.length }, (_, index) =>
    speechEvent.results[index]?.[0]?.transcript?.trim() ?? "",
  )
    .filter(Boolean)
    .join(" ");
}

export function getSpeechRecognitionError(event: Event): string {
  return (event as Event & { error?: string }).error ?? "unknown";
}
