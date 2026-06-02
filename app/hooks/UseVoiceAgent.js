// hooks/useVoiceAgent.js
import { useEffect, useRef, useState, useCallback } from "react";

export function useVoiceAgent({ news, currentIndex, onNext, onPrev, onPause, onResume, onAnswer }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);

  const speak = useCallback((text) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }, []);

  const handleCommand = useCallback(async (spokenText) => {
    // Detect intent via our own API route (which uses correct model + API key)
    const res = await fetch("/api/voice-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "intent", text: spokenText }),
    });

    const { intent, query } = await res.json();

    if (intent === "next") {
      speak("Next news.");
      onNext();
    }
    else if (intent === "previous") {
      speak("Going back.");
      onPrev();
    }
    else if (intent === "pause") {
      speak("Paused.");
      onPause();
    }
    else if (intent === "resume") {
      speak("Resuming.");
      onResume();
    }
    else if (intent === "question" && query) {
      // ✅ Pause reading before answering the question
      window.speechSynthesis.cancel();
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
    }
    else {
      speak("Sorry, I didn't catch that.");
    }
  }, [news, currentIndex, onNext, onPrev, onPause, onResume, speak, onAnswer]);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser doesn't support speech recognition.");

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

  return { isListening, transcript, startListening, stopListening, speak };
}