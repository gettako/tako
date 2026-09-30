import * as React from "react"

export interface UseCopyToClipboardResult {
  copy: (text: string) => Promise<boolean>
  isCopied: boolean
  error: string | null
}

export function useCopyToClipboard(timeout = 2000): UseCopyToClipboardResult {
  const [isCopied, setIsCopied] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const copy = React.useCallback(
    async (text: string): Promise<boolean> => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        setError("Copy failed: Clipboard API unavailable")
        setIsCopied(false)
        timerRef.current = setTimeout(() => {
          setError(null)
        }, timeout)
        return false
      }

      try {
        await navigator.clipboard.writeText(text)
        setIsCopied(true)
        setError(null)
        timerRef.current = setTimeout(() => {
          setIsCopied(false)
        }, timeout)
        return true
      } catch (err) {
        const errorMsg =
          err instanceof Error && err.message
            ? `Copy failed: ${err.message}`
            : "Copy failed"
        setError(errorMsg)
        setIsCopied(false)
        timerRef.current = setTimeout(() => {
          setError(null)
        }, timeout)
        return false
      }
    },
    [timeout]
  )

  return { copy, isCopied, error }
}
