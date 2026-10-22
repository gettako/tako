"use client"

import * as React from "react"

// Decoupled triggers so any view can open the palette without prop drilling.
const TOGGLE_EVENT = "tako:toggle-command-palette"
const OPEN_EVENT = "tako:open-command-palette"
const CLOSE_EVENT = "tako:close-command-palette"

export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT))
  }
}

export function closeCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CLOSE_EVENT))
  }
}

export function toggleCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TOGGLE_EVENT))
  }
}

export function useCommandPalette() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key === "k" || event.key === "K") &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    const handleOpen = () => setOpen(true)
    const handleClose = () => setOpen(false)
    const handleToggle = () => setOpen((prev) => !prev)

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener(OPEN_EVENT, handleOpen)
    window.addEventListener(CLOSE_EVENT, handleClose)
    window.addEventListener(TOGGLE_EVENT, handleToggle)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener(OPEN_EVENT, handleOpen)
      window.removeEventListener(CLOSE_EVENT, handleClose)
      window.removeEventListener(TOGGLE_EVENT, handleToggle)
    }
  }, [])

  return {
    open,
    setOpen,
    openPalette: openCommandPalette,
    closePalette: closeCommandPalette,
  }
}
