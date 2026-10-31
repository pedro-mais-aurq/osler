import { useEffect, useRef } from 'react'

/** Scroll behavior ported from the approved Neres restaurant fusion model. */
export function useNeresMotion() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const page = root.current
    const header = document.querySelector<HTMLElement>('.app-header')
    if (!page || !header || typeof window.matchMedia !== 'function') return

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const scenes = [...page.querySelectorAll<HTMLElement>('[data-scroll-scene]')]
      .map(frame => ({
        frame,
        layer: frame.querySelector<HTMLElement>('[data-motion-layer]'),
        mode: frame.dataset.scrollScene,
        direction: Number(frame.dataset.scrollDirection) || 1,
      }))
      .filter(scene => scene.layer)
    const sections = [...page.querySelectorAll<HTMLElement>(':scope > section[id]')]
    const links = [...header.querySelectorAll<HTMLAnchorElement>('.desktop-nav a[data-section]')]
    let pending = 0

    function render() {
      pending = 0
      if (!header || !page) return
      const height = window.innerHeight
      const mobile = window.innerWidth <= 900
      const headerHeight = header.offsetHeight
      const scroll = window.scrollY
      const distance = Math.max(1, document.documentElement.scrollHeight - height)
      const current = sections.filter(section => section.getBoundingClientRect().top <= headerHeight + height * 0.28).at(-1)?.id

      // Read geometry before writing styles, following the original model.
      const updates = scenes.map(scene => {
        const rect = scene.frame.getBoundingClientRect()
        const progress = Math.max(0, Math.min(1, (height - rect.top) / (height + rect.height)))
        let x = 0
        let y = 0
        let layerHeight: number | null = scene.mode === 'curtain' ? rect.height : null
        if (!preference.matches) {
          if (scene.mode === 'reveal') {
            y = Math.max(0, Math.min(rect.height, headerHeight - rect.top)) * (mobile ? 0.2 : 0.8)
          } else if (scene.mode === 'curtain') {
            y = mobile ? (progress * 2 - 1) * 24 : Math.max(-height * 0.8, Math.min(rect.height * 0.8, -rect.top * 0.8))
            layerHeight = mobile ? rect.height + 48 : Math.max(rect.height, height)
          } else {
            x = (progress * 2 - 1) * Math.min(scene.frame.clientWidth * 0.08, mobile ? 14 : 64) * scene.direction
            y = (progress * 2 - 1) * (mobile ? 5 : 14)
          }
        }
        return { ...scene, x, y, layerHeight, active: !preference.matches && rect.bottom > -100 && rect.top < height + 100 }
      })

      header.classList.toggle('is-scrolled', scroll > 15)
      header.style.setProperty('--reading-progress', String(Math.max(0, Math.min(1, scroll / distance))))
      links.forEach(link => {
        const active = link.dataset.section === current
        link.classList.toggle('is-current', active)
        if (active) link.setAttribute('aria-current', 'location')
        else link.removeAttribute('aria-current')
      })
      updates.forEach(({ frame, x, y, layerHeight, active }) => {
        frame.style.setProperty('--scene-x', `${x.toFixed(3)}px`)
        frame.style.setProperty('--scene-y', `${y.toFixed(3)}px`)
        if (layerHeight !== null) frame.style.setProperty('--scene-height', `${layerHeight.toFixed(3)}px`)
        frame.classList.toggle('scene-in-view', active)
      })
    }

    function schedule() {
      if (!pending) pending = requestAnimationFrame(render)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    preference.addEventListener('change', schedule)
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    resize?.observe(page)
    scenes.forEach(({ frame }) => resize?.observe(frame))
    render()
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      preference.removeEventListener('change', schedule)
      resize?.disconnect()
      if (pending) cancelAnimationFrame(pending)
      header.classList.remove('is-scrolled')
      header.style.removeProperty('--reading-progress')
      links.forEach(link => {
        link.classList.remove('is-current')
        link.removeAttribute('aria-current')
      })
    }
  }, [])

  return root
}
