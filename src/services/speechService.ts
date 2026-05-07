export async function speakEnglish(text: string, options: { rate?: number; onError?: (message: string) => void } = {}) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    options.onError?.('Este navegador nao suporta leitura de texto em voz alta.')
    return
  }

  const cleanText = text.trim()
  if (!cleanText) return

  try {
    const voices = await waitForVoices()
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = 'en-US'
    utterance.rate = options.rate ?? 0.9
    utterance.pitch = 1
    utterance.volume = 1

    const englishVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith('en-us'))
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('en'))

    if (englishVoice) {
      utterance.voice = englishVoice
    }

    utterance.onerror = () => options.onError?.('Nao consegui tocar o audio agora. Tente clicar novamente.')

    window.speechSynthesis.cancel()
    window.speechSynthesis.resume()

    window.setTimeout(() => {
      window.speechSynthesis.speak(utterance)
    }, 80)
  } catch {
    options.onError?.('Nao consegui carregar uma voz de leitura neste navegador.')
  }
}

function waitForVoices() {
  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const loadedVoices = window.speechSynthesis.getVoices()
    if (loadedVoices.length > 0) {
      resolve(loadedVoices)
      return
    }

    const timeoutId = window.setTimeout(() => {
      resolve(window.speechSynthesis.getVoices())
    }, 800)

    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeoutId)
      resolve(window.speechSynthesis.getVoices())
    }
  })
}
