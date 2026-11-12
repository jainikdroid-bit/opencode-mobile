import { useState, useCallback, useRef, useEffect } from "react"
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition"
import { deviceLocaleTags } from "./i18n/config"
import { resolveSpeechLang } from "./speech-lang"
import { useSettings } from "../stores/settings"

interface SpeechState {
  listening: boolean
  transcript: string
  error: string | null
}

interface SpeechActions {
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
}

export function useSpeech(onResult: (text: string) => void): SpeechState & SpeechActions {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const locale = useSettings((s) => s.locale)
  const pending = useRef("")
  // True only while this hook instance started a recognition session.
  const started = useRef(false)

  useSpeechRecognitionEvent("start", () => {
    started.current = true
    setListening(true)
    setError(null)
    setTranscript("")
    pending.current = ""
  })

  useSpeechRecognitionEvent("end", () => {
    started.current = false
    setListening(false)
    // Deliver final transcript
    if (pending.current.trim()) {
      onResult(pending.current.trim())
    }
    setTranscript("")
    pending.current = ""
  })

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript || ""
    pending.current = text
    setTranscript(text)
  })

  useSpeechRecognitionEvent("error", (event) => {
    // "no-speech" is not really an error — user just didn't say anything.
    // "aborted" is emitted by abort() on Android even when nothing was
    // listening (module-global event), so it must not surface as a failure.
    if (event.error === "no-speech" || event.error === "aborted") {
      setListening(false)
      return
    }
    setError(event.message || event.error)
    setListening(false)
  })

  const start = useCallback(async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    if (!result.granted) {
      setError("Microphone permission denied")
      return
    }
    started.current = true
    ExpoSpeechRecognitionModule.start({
      lang: resolveSpeechLang(locale, deviceLocaleTags()),
      interimResults: true,
      continuous: true,
    })
  }, [locale])

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop()
  }, [])

  const cancel = useCallback(() => {
    pending.current = ""
    started.current = false
    ExpoSpeechRecognitionModule.abort()
    setListening(false)
    setTranscript("")
  }, [])

  // Stop the native recognition session when the screen unmounts — otherwise
  // the mic stays hot in the background. Only abort if this instance started
  // listening: on Android abort() emits a global "aborted" error even when idle.
  useEffect(() => {
    return () => {
      if (started.current) ExpoSpeechRecognitionModule.abort()
    }
  }, [])

  return { listening, transcript, error, start, stop, cancel }
}
