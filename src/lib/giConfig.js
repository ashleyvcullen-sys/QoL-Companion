import { GI_CORE_PARAMETERS, GI_MODULES, giModulesForSpecies } from './giModules'

export const GI_KEY = 'gastrointestinal'

// Much simpler than the cancer config, and deliberately so.
//
// Cancer needs a diagnosis layer because the diagnosis SUGGESTS what to watch:
// an owner who knows "lymphoma" does not necessarily know that means lymph
// nodes and gut signs. In GI the owner already knows what their pet has — the
// list they pick from IS the list of things to monitor — so there is nothing
// to infer and no suggestion machinery to get wrong.
export const EMPTY_GI_CONFIG = {
  modules: [],
  otherCondition: '',
}

export function normaliseGiConfig(config) {
  return {
    modules: Array.isArray(config?.modules) ? config.modules : [],
    otherCondition: config?.otherCondition ?? '',
    // Carried through untouched. The medication question writes onMedication
    // onto the same config object, and a normalise that dropped unknown keys
    // would quietly wipe it on the next setup save.
    ...(config?.onMedication ? { onMedication: config.onMedication } : {}),
  }
}

// Whether the owner has been through setup.
//
// "Something else" counts: someone who has typed a condition the list does
// not cover has configured this as deliberately as someone who ticked a box,
// and sending them back to setup every visit would be wrong.
export function isGiConfigured(config) {
  const c = normaliseGiConfig(config)
  return c.modules.length > 0 || c.otherCondition.trim().length > 0
}

export function activeGiModuleKeys(config) {
  return normaliseGiConfig(config).modules
}

export function toggleGiModule(config, moduleKey) {
  const c = normaliseGiConfig(config)
  const has = c.modules.includes(moduleKey)
  return {
    ...c,
    modules: has
      ? c.modules.filter((key) => key !== moduleKey)
      : [...c.modules, moduleKey],
  }
}

export function setOtherGiCondition(config, text) {
  return { ...normaliseGiConfig(config), otherCondition: text }
}

// Whether the owner has selected gut cancer, which is monitored elsewhere.
// Surfaced so the setup screen and the monitoring page can both offer the way
// across rather than each working it out.
export function hasGiCancerSelected(config) {
  return activeGiModuleKeys(config).includes('gi_cancer')
}

export function parametersForGi(config, species) {
  const keys = activeGiModuleKeys(config)
  const out = [...GI_CORE_PARAMETERS]

  // Offered-for-species rather than selected: a module the owner cannot be
  // offered should not contribute questions even if an old config names it.
  const allowed = new Set(giModulesForSpecies(species).map((module) => module.key))

  for (const key of keys) {
    if (!allowed.has(key)) continue
    const module = GI_MODULES[key]
    if (!module) continue
    out.push(...module.parameters)
  }

  // Same guard the cancer composer has. Two modules can reasonably want the
  // same question — chronic enteropathy and EPI both care about stool — and
  // asking it twice on one form is the bug that guard exists to stop.
  const seen = new Set()
  return out.filter((parameter) => {
    if (seen.has(parameter.key)) return false
    seen.add(parameter.key)
    return true
  })
}

// The intro lines contributed by whichever modules are selected. Megaoesophagus
// is the only one with one today, and it is the sentence most worth reading on
// the whole screen — aspiration is what kills these patients, and owners are
// rarely told to watch for it.
export function giModuleIntros(config, species) {
  const allowed = new Set(giModulesForSpecies(species).map((module) => module.key))
  return activeGiModuleKeys(config)
    .filter((key) => allowed.has(key))
    .map((key) => GI_MODULES[key]?.intro)
    .filter(Boolean)
}
