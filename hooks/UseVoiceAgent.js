// hooks/useVoiceAgent.js
import { useRef, useState, useCallback } from "react";

export function useVoiceAgent({ news, currentIndex, onNext, onPrev, onPause, onResume, onAnswer }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);

  // ── ElevenLabs TTS speak function ─────────────────────────────────────────
  const speak = useCallback(async (text) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
      if (!apiKey) {
        console.error("NEXT_PUBLIC_ELEVENLABS_API_KEY missing");
        return;
      }

      // Using "Adam" voice - natural, professional male voice
      const voiceId = "pNInz6obpgDQGcFmaJgB";

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        console.error("ElevenLabs TTS error:", err);
        return;
      }

      const blob = await response.blob();
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