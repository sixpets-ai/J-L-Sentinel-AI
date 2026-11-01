import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSpeechRecognizer,
  getSpeechRecognitionError,
  getSpeechTranscript,
  type SpeechRecognitionLike,
} from "@/lib/agent-speech";

export function useSpeechDictation(
  onTranscript: (text: string) => void,
  onStart?: () => void,
  recognitionLocale = "es-MX",
) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  const onStartRef = useRef(onStart);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { onStartRef.current = onStart; }, [onStart]);

  const start = useCallback(() => {
    const recognition = createSpeechRecognizer();
    if (!recognition) {
      setError("El dictado por voz no está disponible en este navegador. Puedes escribir tu mensaje.");
      return;
    }

    onStartRef.current?.();
    setError("");
    recognition.lang = recognitionLocale;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = getSpeechTranscript(event);
      if (transcript) onTranscriptRef.current(transcript);
    };
    recognition.onerror = (event) => {
      const code = getSpeechRecognitionError(event);
      setError(code === "not-allowed"
        ? "El navegador no dio permiso para usar el micrófono."
        : "No se pudo transcribir la voz. Inténtalo de nuevo o escribe tu mensaje.");
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError("No se pudo iniciar el micrófono. Puedes escribir tu mensaje.");
    }
  }, [recognitionLocale]);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);
  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => () => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
      recognitionRef.current = null;
    }
  }, []);

  return { listening, error, toggle };
}
