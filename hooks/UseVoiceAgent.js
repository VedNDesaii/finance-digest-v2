// hooks/useVoiceAgent.js
import { useEffect, useRef, useState, useCallback } from "react";

export function useVoiceAgent({ news, currentIndex, onNext, onPrev, onPause, onResume, onAnswer }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);

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
      speak("Sorry, I didn't catch that. Could you say that again?");
    }
  }, [news, currentIndex, onNext, onPrev, onPause, onResume, speak, onAnswer]);

  const createRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    // ✅ Enable interim results for faster, more responsive recognition
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    let finalTranscriptBuffer = "";
    let silenceTimer = null;

    recognition.onresult = (e) => {
      let interim = "";
      let final = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (final.trim()) {
        finalTranscriptBuffer = final.trim();
        setTranscript(finalTranscriptBuffer);

        // Clear any pending silence timer, process immediately on final result
        if (silenceTimer) clearTimeout(silenceTimer);
        handleCommand(finalTranscriptBuffer);
        finalTranscriptBuffer = "";
      } else if (interim.trim()) {
        setTranscript(interim.trim());
      }
    };

    recognition.onerror = (e) => {
      // "no-speech" and "aborted" are common/benign — don't fully stop on these
      if (e.error === "no-speech" || e.error === "aborted") {
        return;
      }
      setIsListening(false);
      shouldListenRef.current = false;
    };

    recognition.onend = () => {
      // ✅ Auto-restart if we're still supposed to be listening
      if (shouldListenRef.current) {
        try {
          recognition.start();
        } catch (err) {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [handleCommand]);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser doesn't support speech recognition.");

    // ✅ Greet the user every time the mic is activated
    speak("Hi! How can I help you? You can ask me to read the news, skip ahead, go back, pause, or ask a question about the article.");

    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    shouldListenRef.current = true;
    recognition.start();
    setIsListening(true);
  }, [createRecognition, speak]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, transcript, startListening, stopListening, speak };
}