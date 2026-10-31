// Explicit, build-time selection. Missing production credentials never enable a demo.
export const isLocalMode =
  import.meta.env.VITE_DATA_MODE === 'local' || import.meta.env.MODE === 'demo'
