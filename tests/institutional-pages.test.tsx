// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryRouter, MemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { transferableAbortController } from 'node:util'
import { AppShell } from '../src/components/AppShell'
import { LandingPage } from '../src/pages/LandingPage'
import { FoundersPage } from '../src/pages/FoundersPage'
import { ProjectPage } from '../src/pages/ProjectPage'
import { founders } from '../src/features/landing/founders'

Object.defineProperty(globalThis, 'AbortController', {
  configurable: true,
  value: transferableAbortController().constructor,
})
afterEach(cleanup)

function renderPublicRoute(path: string) {
  const router = createMemoryRouter([{
    path: '/', element: <AppShell><Outlet /></AppShell>, children: [
      { index: true, element: <LandingPage /> },
      { path: 'projeto', element: <ProjectPage /> },
      { path: 'fundadores', element: <FoundersPage /> },
    ],
  }], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('páginas institucionais do Osler', () => {
  it('apresenta a sala de aula em uma seção própria e oferece páginas completas', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const hero = screen.getByRole('region', { name: /O cuidado começa/ })
    const classroom = screen.getByRole('region', { name: /A educação encontra/ })
    expect(within(hero).queryByRole('img', { name: /aula de raciocínio/ })).toBeNull()
    expect(within(classroom).getByRole('heading', { name: /A educação encontra/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Conheça o projeto Osler' }).getAttribute('href')).toBe('/projeto')
    cleanup()
    renderPublicRoute('/')
    expect(screen.getAllByRole('link', { name: 'Fundadores' })[0].getAttribute('href')).toBe('/fundadores')
  })

  it('abre a página de fundadores diretamente, com cinco perfis detalhados', () => {
    renderPublicRoute('/fundadores')
    expect(screen.getByRole('heading', { level: 1, name: /Quem dá vida/ })).toBeTruthy()
    for (const founder of founders) {
      const profile = screen.getByRole('region', { name: founder.title })
      expect(within(profile).getByRole('img')).toBeTruthy()
      expect(within(profile).getByRole('heading', { name: 'No centro desta frente' })).toBeTruthy()
      expect(within(profile).getAllByRole('listitem')).toHaveLength(3)
    }
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(within(nav).getByRole('link', { name: 'Fundadores' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByText('Ambiente educacional')).toBeNull()
    expect(document.title).toBe('Os fundadores · Osler')
  })

  it('navega entre o projeto e os fundadores sem passar pela entrada do aluno', async () => {
    const user = userEvent.setup()
    const router = renderPublicRoute('/projeto')
    expect(screen.getByRole('heading', { level: 1, name: /Conhecimento que encontra/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Revisitar a trajetória' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Enfermagem' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Análises Clínicas' })).toBeTruthy()
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(within(nav).getByRole('link', { name: 'O projeto' }).getAttribute('aria-current')).toBe('page')
    await user.click(within(nav).getByRole('link', { name: 'Fundadores' }))
    expect(router.state.location.pathname).toBe('/fundadores')
    expect(await screen.findByRole('heading', { level: 1, name: /Quem dá vida/ })).toBeTruthy()
  })

  it('permite abrir um perfil pelo índice e mantém os links do footer funcionais', async () => {
    const user = userEvent.setup()
    const router = renderPublicRoute('/fundadores')
    const index = screen.getByRole('navigation', { name: 'Ir para uma frente fundadora' })
    await user.click(within(index).getByRole('link', { name: /Coordenador pedagógico/ }))
    expect(router.state.location.hash).toBe('#coordenacao-pedagogica')
    const footer = screen.getByRole('navigation', { name: 'Explorar o Osler' })
    await user.click(within(footer).getByRole('link', { name: 'O projeto' }))
    expect(router.state.location.pathname).toBe('/projeto')
    expect(await screen.findByRole('heading', { level: 1, name: /Conhecimento que encontra/ })).toBeTruthy()
  })
})
