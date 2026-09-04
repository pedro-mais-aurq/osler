// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StepRenderer } from '../src/features/simulation/StepRenderer'
import type { CaseStep } from '../src/features/simulation/types'

const informationStep: CaseStep = {
  id: 'information-step',
  caseId: 'fixture-case',
  position: 1,
  stepKey: 'information',
  type: 'information',
  title: 'Information title',
  content: {
    body: 'Information body.',
    observations: ['Observation one.', 'Observation two.'],
  },
  presentationState: 'stable',
}

const decisionStep: CaseStep = {
  id: 'decision-step',
  caseId: 'fixture-case',
  position: 2,
  stepKey: 'decision',
  type: 'decision',
  title: 'Decision title',
  content: { body: 'Decision body.', observations: [] },
  options: [
    { id: 'option-one', label: 'Option one' },
    { id: 'option-two', label: 'Option two' },
  ],
  presentationState: 'warning',
}

afterEach(cleanup)

describe('StepRenderer', () => {
  it('renderiza corpo e observações de information sem opções', () => {
    render(
      <StepRenderer
        evaluation={null}
        onSelectOption={vi.fn()}
        selectedOptionId={null}
        step={informationStep}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Information title' })).toBeTruthy()
    expect(screen.getByText('Information body.')).toBeTruthy()
    expect(screen.getByText('Observation one.')).toBeTruthy()
    expect(screen.queryByLabelText('Opções de decisão')).toBeNull()
  })

  it('renderiza opções de decision e chama o callback selecionado', async () => {
    const onSelectOption = vi.fn()
    const user = userEvent.setup()
    render(
      <StepRenderer
        evaluation={null}
        onSelectOption={onSelectOption}
        selectedOptionId={null}
        step={decisionStep}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Option two' }))

    expect(onSelectOption).toHaveBeenCalledWith('option-two')
  })

  it('marca a seleção explicitamente e desabilita todas as opções', () => {
    render(
      <StepRenderer
        disabled
        evaluation={null}
        onSelectOption={vi.fn()}
        selectedOptionId="option-one"
        step={decisionStep}
      />,
    )

    expect(screen.getByText('Opção escolhida')).toBeTruthy()
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('não mostra feedback antes da avaliação', () => {
    render(
      <StepRenderer
        evaluation={null}
        onSelectOption={vi.fn()}
        selectedOptionId="option-one"
        step={decisionStep}
      />,
    )

    expect(screen.queryByText('Selected feedback.')).toBeNull()
    expect(screen.queryByText('Escolha ideal')).toBeNull()
  })

  it('mostra somente o feedback fornecido depois da avaliação', () => {
    render(
      <StepRenderer
        evaluation={{
          classification: 'ideal',
          scoreDelta: 2,
          feedback: 'Selected feedback.',
          consequence: 'Selected consequence.',
        }}
        onSelectOption={vi.fn()}
        selectedOptionId="option-one"
        step={decisionStep}
      />,
    )

    expect(screen.getByText('Escolha ideal')).toBeTruthy()
    expect(screen.getByText('Selected feedback.')).toBeTruthy()
    expect(screen.getByText('Selected consequence.')).toBeTruthy()
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true)
    }
  })

  it('falha de modo amigável para um tipo desconhecido em runtime', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const unsupported = { ...informationStep, type: 'future-step' } as unknown as CaseStep

    render(
      <StepRenderer
        evaluation={null}
        onSelectOption={vi.fn()}
        selectedOptionId={null}
        step={unsupported}
      />,
    )

    expect(
      screen.getByText('Este tipo de etapa ainda não é suportado.'),
    ).toBeTruthy()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
