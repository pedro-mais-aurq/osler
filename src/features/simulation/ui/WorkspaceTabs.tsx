import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'

export interface WorkspaceTab {
  id: string
  label: string
  content: ReactNode
}

export interface WorkspaceTabsProps {
  label: string
  tabs: WorkspaceTab[]
}

export function WorkspaceTabs({ label, tabs }: WorkspaceTabsProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const instanceId = useId().replace(/:/g, '')

  function focusTab(index: number) {
    const nextTab = tabs[index]

    if (!nextTab) {
      return
    }

    setActiveTab(nextTab.id)
    tabRefs.current[index]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let targetIndex: number | null = null

    if (event.key === 'ArrowRight') {
      targetIndex = (index + 1) % tabs.length
    } else if (event.key === 'ArrowLeft') {
      targetIndex = (index - 1 + tabs.length) % tabs.length
    } else if (event.key === 'Home') {
      targetIndex = 0
    } else if (event.key === 'End') {
      targetIndex = tabs.length - 1
    }

    if (targetIndex !== null) {
      event.preventDefault()
      focusTab(targetIndex)
    }
  }

  return (
    <div className="workspace-tabs">
      <div aria-label={label} className="workspace-tab-list" role="tablist">
        {tabs.map((tab, index) => {
          const selected = tab.id === activeTab
          const tabId = `${instanceId}-${tab.id}-tab`
          const panelId = `${instanceId}-${tab.id}-panel`

          return (
            <button
              aria-controls={panelId}
              aria-selected={selected}
              className="workspace-tab"
              id={tabId}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {tabs.map((tab) => {
        const selected = tab.id === activeTab

        return (
          <div
            aria-labelledby={`${instanceId}-${tab.id}-tab`}
            className="workspace-tab-panel"
            hidden={!selected}
            id={`${instanceId}-${tab.id}-panel`}
            key={tab.id}
            role="tabpanel"
            tabIndex={0}
          >
            {tab.content}
          </div>
        )
      })}
    </div>
  )
}
