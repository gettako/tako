export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === "undefined") {
    return false
  }

  // Modern Async Clipboard API (available in secure contexts: HTTPS or localhost)
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fallback below if writeText fails (e.g. document not focused or permission denied)
    }
  }

  // Fallback for non-secure contexts (e.g. HTTP on local network / edge IP) or older browsers
  try {
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    textArea.style.top = "0"
    textArea.style.left = "-9999px"
    textArea.style.opacity = "0"
    textArea.setAttribute("readonly", "")
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand("copy")
    document.body.removeChild(textArea)
    return successful
  } catch {
    return false
  }
}
