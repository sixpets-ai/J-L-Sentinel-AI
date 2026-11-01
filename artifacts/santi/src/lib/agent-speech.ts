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

const feminineVoiceNames = /female|woman|femenina|mujer|google.*español|español.*google|paulina|m[oó]nica|sabina|helena|luc[ií]a/i;
const masculineVoiceNames = /male|man|masculino|hombre|jorge|diego|carlos|antonio|juan/i;

function chooseLanguageVoice(
  voices: SpeechSynthesisVoice[],
  locale: string,
  gender: AgentVoiceProfile["gender"],
): SpeechSynthesisVoice | undefined {
  const normalizedLocale = locale.toLowerCase();
  const language = normalizedLocale.split("-")[0];
  const candidates = voices.filter((voice) => {
    const voiceLocale = voice.lang.toLowerCase();
    return voiceLocale === normalizedLocale || voiceLocale.split("-")[0] === language;
  });
  if (candidates.length === 0) return undefined;
  const namePattern = gender === "feminine" ? feminineVoiceNames : masculineVoiceNames;

  const genderMatch = candidates.find((voice) => namePattern.test(voice.name));
  if (genderMatch) return genderMatch;
  return candidates.find((voice) => voice.lang.toLowerCase() === normalizedLocale) ?? candidates[0];
}

export function speakAsAgent(
  text: string,
  agentId: string,
  onEnd: () => void,
  locale = "es-MX",
): boolean {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window) ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) return false;

  const profile = voiceProfiles[agentId] ?? voiceProfiles.santi;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  utterance.rate = profile.rate;
  utterance.pitch = agentId === "katering" ? 1.2 : profile.pitch;
  utterance.voice = chooseLanguageVoice(window.speechSynthesis.getVoices(), locale, profile.gender) ?? null;
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
