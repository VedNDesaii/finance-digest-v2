// hooks/useVoiceAgent.js
import { useRef, useState, useCallback, useEffect } from "react";

export function useVoiceAgent({ news, currentIndex, onNext, onPrev, onPause, onResume, onAnswer }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  const voiceRef = useRef(null);

  // ── Load best Apple/system voice on mount ─────────────────────────────────
  useEffect(() => {
    function loadVoice() {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;

      // Priority: Samantha (Apple) → Karen → Victoria → any en-US
      const preferred = [
        "Samantha",   // macOS/iOS — best Apple voice
        "Karen",      // Australian Apple voice
        "Victoria",   // Another Apple voice
        "Moira",      // Irish Apple voice
      ];

      let picked = null;
      for (const name of preferred) {
        picked = voices.find(v => v.name === name);
        if (picked) break;
      }

      // Fallback to any en-US voice
      if (!picked) {
        picked = voices.find(v => v.lang === "en-US" && v.localService) ||
                 voices.find(v => v.lang.startsWith("en"));
      }

      voiceRef.current = picked || null;
    }

    loadVoice();
    window.speechSynthesis.onvoiceschanged = loadVoice;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ── Speak function ────────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.rate  = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  // ── Handle voice commands ─────────────────────────────────────────────────
  const handleCommand = useCallback(async (spokenText) => {
    const res = await fetch("/api/voice-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "intent", text: spokenText }),
    });
    const { intent, query } = await res.json();

    if (intent === "next") {
      stopSpeaking();
      speak("Next news.");
      onNext();
    } else if (intent === "previous") {
      stopSpeaking();
      speak("Going back.");
      onPrev();
    } else if (intent === "pause") {
      stopSpeaking();
      speak("Paused.");
      onPause();
    } else if (intent === "resume") {
      speak("Resuming.");
      onResume();
    } else if (intent === "question" && query) {
      stopSpeaking();
      onPause();
      speak("Let me find that for you.");
      const article = news[currentIndex];
      const answerRes = await fetch("/api/voice-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "question",
          text: query,
          articleContext: article?.simplified_article ?? article?.simplified_text ?? article?.description ?? "",
        }),
      });
      const { result } = await answerRes.json();
      const answer = result ?? "I couldn't find an answer.";
      speak(answer);
      onAnswer?.(answer);
    } else {
      speak("Sorry, I didn't catch that. Try saying next, pause, or ask a question.");
    }
  }, [news, currentIndex, onNext, onPrev, onPause, onResume, speak, stopSpeaking, onAnswer]);

  // ── Start listening ───────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported. Please use Chrome.");
      return;
    }

    // Greet the user first
    speak("Hi! How may I help you? You can say next, pause, go back, or ask me anything about the news.");

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      setTranscript(text);
      handleCommand(text);
    };
    recognition.onerror = (e) => {
      console.error("Speech recognition error:", e.error);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [handleCommand, speak]);

  // ── Stop listening ────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    stopSpeaking();
    setIsListening(false);
  }, [stopSpeaking]);

  return { isListening, transcript, startListening, stopListening, speak, stopSpeaking };
}