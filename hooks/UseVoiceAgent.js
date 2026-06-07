// hooks/useVoiceAgent.js
import { useEffect, useRef, useState, useCallback } from "react";

export function useVoiceAgent({ news, currentIndex, onNext, onPrev, onPause, onResume, onAnswer }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);

  // ── Google TTS speak function ──────────────────────────────────────────────
  const speak = useCallback(async (text) => {
    try {
      // Stop any current audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_TTS_KEY;
      if (!apiKey) {
        console.error("NEXT_PUBLIC_GOOGLE_TTS_KEY missing");
        return;
      }

      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: "en-US",
              name: "en-US-Neural2-D",
              ssmlGender: "MALE",
            },
            audioConfig: {
              audioEncoding: "MP3",
              speakingRate: 1.05,
              pitch: 0.0,
              effectsProfileId: ["headphone-class-device"],
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        console.error("Google TTS error:", err);
        return;
      }

      const data = await response.json();
      const binary = atob(data.audioContent);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
    } catch (e) {
      console.error("speak error:", e);
    }
  }, []);

  // ── Stop speaking ──────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  // ── Handle voice commands ──────────────────────────────────────────────────
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
      const article = news[currentIndex];
      const answerRes = await fetch("/api/voice-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "question",
          text: query,
          articleContext: article?.simplified_text ?? article?.description ?? "",
        }),
      });
      const { result } = await answerRes.json();
      const answer = result ?? "I couldn't find an answer.";
      speak(answer);
      onAnswer?.(answer);
    } else {
      speak("Sorry, I didn't catch that.");
    }
  }, [news, currentIndex, onNext, onPrev, onPause, onResume, speak, stopSpeaking, onAnswer]);

  // ── Speech recognition ─────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser doesn't support speech recognition. Use Chrome.");
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      setTranscript(text);
      handleCommand(text);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [handleCommand]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, transcript, startListening, stopListening, speak, stopSpeaking };
}