// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from '../src/pages/LandingPage'
import { FoundersPage } from '../src/pages/FoundersPage'
import { DemoPage } from '../src/pages/DemoPage'
import { AppShell } from '../src/components/AppShell'

const auth = vi.hoisted(() => ({ ensureAnonymousStudentSession: vi.fn() }))
vi.mock('../src/services/auth', () => auth)
afterEach(cleanup)

describe('experiência pública sem sessão', () => {
  it('apresenta o projeto educacional e os cinco fundadores com os retratos enviados', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const project = screen.getByRole('region', { name: /Educação em saúde/ })
    expect(within(project).getByText(/iniciativa de educação voltada à simulação clínica interprofissional/)).toBeTruthy()
    cleanup()
    render(<MemoryRouter><FoundersPage /></MemoryRouter>)
    expect(screen.getAllByRole('img', { name: /Retrato do fundador/ })).toHaveLength(5)
    expect(screen.getByRole('heading', { name: /Diretor geral$/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Coordenador pedagógico$/ })).toBeTruthy()
  })

  it('permite explorar as etapas da aprendizagem antes de autenticar', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: '02 Decidir' }))
    expect(screen.getByRole('heading', { name: 'Qual será o seu próximo passo?' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '03 Refletir' }))
    expect(screen.getByRole('heading', { name: 'O que essa experiência ensinou?' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '03 Refletir' }).getAttribute('aria-pressed')).toBe('true')
    expect(auth.ensureAnonymousStudentSession).not.toHaveBeenCalled()
  })

  it('alterna a formação apresentada sem autenticar o visitante', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /O olhar atento/ })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Análises Clínicas' }))
    expect(screen.getByRole('heading', { name: /Por trás de um resultado/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Análises Clínicas' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('link', { name: 'Experimentar a interface' }).getAttribute('href')).toBe('/demonstracao')
    expect(auth.ensureAnonymousStudentSession).not.toHaveBeenCalled()
  })

  it.each([
    ['Apresentar-se, perguntar como ela prefere ser chamada e ouvir suas dúvidas.', 'Escolha aceitável'],
    ['Pedir que aguarde e seguir para a próxima etapa sem conversar.', 'Pode melhorar'],
  ])('apresenta feedback e conclusão da demonstração para a opção %s', async (option, feedback) => {
    const user = userEvent.setup()
    render(<MemoryRouter><DemoPage /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Iniciar caso' }))
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull()
    await user.click(screen.getByRole('button', { name: option }))
    expect(screen.getByText(feedback)).toBeTruthy()
    expect(screen.getByRole('button', { name: new RegExp(option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).hasAttribute('disabled')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByRole('heading', { name: /Cada escolha é um começo/ })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Rever demonstração' }))
    expect(screen.getByRole('button', { name: 'Iniciar caso' })).toBeTruthy()
    expect(auth.ensureAnonymousStudentSession).not.toHaveBeenCalled()
  })

  it('fecha o menu por Escape e devolve o foco ao controle', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AppShell><p>Conteúdo</p></AppShell></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }))
    expect(screen.getByRole('navigation', { name: 'Navegação móvel' })).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('navigation', { name: 'Navegação móvel' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir menu' }))
  })
})
