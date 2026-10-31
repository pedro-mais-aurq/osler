import { useEffect, useState } from 'react'
import { getPortalIdentity } from '../../services/teaching'
import { supabase } from '../../lib/supabase'
import { isLocalMode } from '../../lib/dataMode'
import { portalChangeEvent } from './localStore'
import type { PortalIdentity } from './types'

export function usePortal() {
  const [state, setState] = useState<{
    loading: boolean
    identity: PortalIdentity | null
    error: string | null
  }>({ loading: true, identity: null, error: null })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    const refresh = () => {
      void getPortalIdentity().then((result) => {
        if (active)
          setState(
            result.ok
              ? { loading: false, identity: result.value, error: null }
              : { loading: false, identity: null, error: result.message },
          )
      })
    }
    refresh()
    window.addEventListener(portalChangeEvent, refresh)
    return () => {
      active = false
      window.removeEventListener(portalChangeEvent, refresh)
    }
  }, [revision])
  useEffect(() => {
    const subscription =
      !isLocalMode &&
      supabase?.auth?.onAuthStateChange?.(() => {
        setRevision((v) => v + 1)
      })
    return () => {
      if (subscription) subscription.data.subscription.unsubscribe()
    }
  }, [])
  return { ...state, refresh: () => setRevision((v) => v + 1) }
}
