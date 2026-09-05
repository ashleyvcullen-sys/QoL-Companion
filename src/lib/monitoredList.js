import { GI_KEY, normaliseGiConfig } from './giConfig'
import { giModuleByKey } from './giModules'
import { normaliseCancerConfig } from './cancerConfig'
import { diagnosisByKey, signModuleByKey } from './cancerModules'

// What a composed condition is currently set to watch, in words.
//
// Ash's instruction 5 Sep 2026: "at the top of diseases where multiple options
// can be selected for what is being monitored — please list what is being
// monitored."
//
// A composed condition asks a different set of questions for every pet. Until
// now the only way to see which set was to open the setup screen and read the
// ticks, so the screen told an owner how their pet was without telling them
// what it was measuring — and for a condition like GI, where the list IS the
// diagnosis, that is most of what they came to check.
//
// Returns an array of labels, empty for a condition with nothing composed
// about it. The caller decides how to render them.
export function monitoredLabels(definition, config) {
  if (!definition?.composed) return []

  if (definition.key === GI_KEY) {
    const gi = normaliseGiConfig(config)
    const labels = gi.modules
      .map((key) => giModuleByKey(key)?.label)
      .filter(Boolean)
    // Free text counts. Someone who has typed a condition the list does not
    // cover has said what they are watching as clearly as someone who ticked
    // a box, and leaving it out would make their screen the one that says
    // nothing.
    const other = gi.otherCondition?.trim()
    if (other) labels.push(other)
    return labels
  }

  // Cancer: the sign modules are what is actually being watched. The
  // diagnosis is why, and leads the list where one has been given — an owner
  // reading "lymph nodes, breathing" wants to know that is the lymphoma set.
  const cancer = normaliseCancerConfig(config)
  const labels = []
  for (const key of cancer.diagnoses ?? []) {
    const label = diagnosisByKey(key)?.label
    if (label) labels.push(label)
  }
  for (const key of cancer.modules ?? []) {
    const label = signModuleByKey(key)?.label
    if (label) labels.push(label)
  }
  return labels
}
