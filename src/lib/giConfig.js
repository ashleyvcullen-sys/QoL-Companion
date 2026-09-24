import { GI_CORE_PARAMETERS, GI_MODULES, giModulesForSpecies } from './giModules'

export const GI_KEY = 'gastrointestinal'

// EMPTY_GI_CONFIG was removed on 24 Sep 2026: nothing referenced it.

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

// hasGiCancerSelected was removed on 24 Sep 2026: nothing referenced it.

// Same idea for a food sensitivity or allergy, which the Allergies and Skin
// Disease section monitors properly — diet trial, start date, adherence and
// the re-challenge protocol, with the milestones on its calendar. This
// section asks nothing about it, so the owner needs to be told where it went.
export function hasGiFoodAllergySelected(config) {
  return activeGiModuleKeys(config).includes('food_sensitivity')
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

// giModuleIntros was removed on 24 Sep 2026: nothing referenced it.
