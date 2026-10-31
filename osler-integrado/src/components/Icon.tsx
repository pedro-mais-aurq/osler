import type { ReactNode, SVGProps } from 'react'

const paths = {
  arrow: <path d="M4 12h15M13 5l7 7-7 7" />,
  diagonal: <path d="M5 19 19 5M5 5h14v14" />,
  back: <path d="M20 12H5m6-7-7 7 7 7" />,
  play: <path d="m9 5 11 7-11 7V5Z" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  heart: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /><path d="M3 12h4l2-4 3 8 2-4h7" /></>,
  flask: <><path d="M9 3h6m-5 0v6L4 19a1.4 1.4 0 0 0 1.2 2h13.6a1.4 1.4 0 0 0 1.2-2L14 9V3M7 15h10" /><path d="M10 18h.01M14 17h.01" /></>,
  book: <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15" />,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  activity: <path d="M2 12h5l3-8 4 16 3-8h5" />,
  clipboard: <path d="M9 4H5v17h14V4h-4M9 2h6v5H9zM8 12h8M8 16h6" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  people: <><path d="M16 21v-2a6 6 0 0 0-12 0v2M20 21v-2a6 6 0 0 0-3-5M16 3a4 4 0 0 1 0 8" /><circle cx="10" cy="7" r="4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  spark: <path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof paths

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
