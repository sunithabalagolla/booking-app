import { useEffect, useId, useRef, useState } from 'react'

// Small menu that opens from a button (theme switch, city picker).
// Closes when tapping outside or pressing Escape (focus goes back to the button).
export function useDropdown() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const buttonRef = useRef(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(event) {
      if (!wrapperRef.current.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // After a pick: close and give focus back to the button
  function close() {
    setOpen(false)
    buttonRef.current.focus()
  }

  return { open, toggle: () => setOpen((isOpen) => !isOpen), close, wrapperRef, buttonRef, menuId }
}
