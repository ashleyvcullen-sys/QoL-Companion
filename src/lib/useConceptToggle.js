import { useState } from 'react'

export function useConceptToggle() {
  const [activeKey, setActiveKey] = useState(null)

  function toggle(key) {
    setActiveKey((current) => (current === key ? null : key))
  }

  return { activeKey, toggle }
}
