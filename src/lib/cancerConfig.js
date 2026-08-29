// Turning a per-pet cancer config into a parameter list.
//
// Every other condition hands the app a fixed `parameters` array. Cancer
// hands it a CONFIG — which diagnoses the owner selected, which sign modules
// they want, which treatment they are on, and which lumps or lymph nodes they
// are measuring — and this file expands that into the same flat parameter
// array everything downstream already understands.
//
// That is the whole trick. evaluateParameter, summariseEntry,
// chartsForCondition, ConditionParameter and the export picker all take a
// parameter object and none of them need to know a parameter was composed
// rather than declared.

import {
  CORE_PARAMETERS,
  MEASURES_BY_INSTANCE_TYPE,
  SIGN_MODULES,
  TREATMENT_MODULES,
  modulesForDiagnoses,
  modulesForDiagnosisDetail,
} from './cancerModules'
import { parametersForGi } from './giConfig'

export const CANCER_KEY = 'cancer'

export const EMPTY_CANCER_CONFIG = {
  diagnoses: [],
  otherDiagnosis: '',
  // Per-diagnosis extra detail, keyed by diagnosis. Today only feline
  // lymphoma has one: { lymphoma: { type: 'intestinal', other: '' } }.
  diagnosisDetails: {},
  // Modules the owner has deliberately turned OFF.
  //
  // Needed because active = suggested ∪ manual: without a record of what was
  // switched off, unticking a suggested module did nothing at all — the
  // suggestion put it straight back and the chip stayed selected. "Suggested"
  // has to mean suggested, not compulsory.
  excludedModules: [],
  modules: [],
  treatment: 'none',
  instances: [],
}

// Tolerant of older shapes. An early build stored a single `preset` string
// and called instances `masses`; reading those forward costs three lines and
// means a pet set up before this change does not lose their configuration.
export function normaliseCancerConfig(config) {
  const diagnoses = Array.isArray(config?.diagnoses)
    ? config.diagnoses
    : config?.preset
      ? [config.preset]
      : []

  return {
    diagnoses,
    otherDiagnosis: config?.otherDiagnosis ?? '',
    diagnosisDetails: config?.diagnosisDetails ?? {},
    excludedModules: Array.isArray(config?.excludedModules) ? config.excludedModules : [],
    modules: Array.isArray(config?.modules) ? config.modules : [],
    treatment: config?.treatment ?? 'none',
    instances: Array.isArray(config?.instances)
      ? config.instances
      : Array.isArray(config?.masses)
        ? config.masses.map((m) => ({ ...m, type: m.type ?? 'lump' }))
        : [],
  }
}

// Whether the owner has been through setup yet.
//
// Keyed on a diagnosis having been ANSWERED rather than on modules being
// selected, because "Not sure yet, or waiting on results" is a legitimate
// answer that suggests no modules at all. Someone who has chosen that has
// set this up; someone who has never opened the screen has not, and should
// not be looking at questions yet.
export function isCancerConfigured(config) {
  return normaliseCancerConfig(config).diagnoses.length > 0
}

// Modules actually in play: the ones suggested by the selected diagnoses,
// plus anything the owner added by hand, plus anything the treatment
// implies. Choosing chemotherapy enables `gi` rather than duplicating
// vomiting and diarrhoea inside the chemo module.
export function activeModuleKeys(config) {
  const c = normaliseCancerConfig(config)
  const treatment = TREATMENT_MODULES[c.treatment]
  // A subtype can suggest modules the diagnosis alone would not — renal
  // lymphoma bringing in Urination is the case this exists for.
  const fromDetails = c.diagnoses.flatMap((key) =>
    modulesForDiagnosisDetail(key, c.diagnosisDetails[key]),
  )
  const suggested = [
    ...new Set([
      ...modulesForDiagnoses(c.diagnoses),
      ...fromDetails,
      ...c.modules,
      ...(treatment?.impliesModules ?? []),
    ]),
  ]
  return suggested.filter((key) => !c.excludedModules.includes(key))
}

// Which modules a diagnosis suggested, as opposed to which the owner ticked.
// The setup screen shows suggestions as already-selected without recording
// them as manual choices, so changing the diagnosis updates them.
export function suggestedModuleKeys(config) {
  const c = normaliseCancerConfig(config)
  return [
    ...new Set([
      ...modulesForDiagnoses(c.diagnoses),
      ...c.diagnoses.flatMap((key) => modulesForDiagnosisDetail(key, c.diagnosisDetails[key])),
    ]),
  ]
}

// One instance's parameters, keyed `<type>:<id>:<measure>`.
//
// The site the owner gave it becomes a HEADING above its questions rather
// than a suffix on each one — suffixing produced labels like "Licking,
// Chewing Or Rubbing At It — Left flank", which is unreadable on a phone and
// gets worse with every extra lump. Charts still append it, because a chart
// has no heading to sit under.
function parametersForInstance(instance) {
  const measures = MEASURES_BY_INSTANCE_TYPE[instance.type] ?? MEASURES_BY_INSTANCE_TYPE.lump
  return measures.map((measure) => ({
    ...measure,
    key: `${instance.type}:${instance.id}:${measure.key}`,
    // Follow-up answers need templating too, or two lumps would write their
    // colour to the same key.
    followUp: measure.followUp
      ? { ...measure.followUp, key: `${instance.type}:${instance.id}:${measure.followUp.key}` }
      : undefined,
    groupLabel: instance.label || (instance.type === 'node' ? 'Lymph node' : 'Lump'),
    instanceId: instance.id,
    instanceType: instance.type,
    instanceLabel: instance.label ?? '',
  }))
}

export function parametersForCancer(config) {
  const c = normaliseCancerConfig(config)
  const out = [...CORE_PARAMETERS]

  for (const key of activeModuleKeys(c)) {
    const module = SIGN_MODULES[key]
    if (!module) continue

    if (module.perInstance) {
      const instances = c.instances.filter((entry) => entry.type === module.perInstance)
      for (const instance of instances) out.push(...parametersForInstance(instance))
      continue
    }

    out.push(...module.parameters)
  }

  const treatment = TREATMENT_MODULES[c.treatment]
  if (treatment) out.push(...treatment.parameters)

  // Deduplicated by key, first occurrence winning. Without this, an owner
  // whose diagnosis suggests `gi` AND who is on chemotherapy (which implies
  // `gi`) would be asked about vomiting twice on the same form.
  const seen = new Set()
  return out.filter((parameter) => {
    if (seen.has(parameter.key)) return false
    seen.add(parameter.key)
    return true
  })
}

// Parameters that only apply to one species are dropped for the other.
//
// Arthritis is why this exists. Cats and dogs do not just need different
// WORDING for the same question — the questions themselves differ. Litter
// tray access is not a dog question and walk tolerance is not a cat one, and
// asking either of the wrong animal produces an answer that means nothing.
//
// A parameter with no `species` applies to both, so nothing else in the app
// changes.
function forSpecies(parameters, species) {
  if (!species) return parameters
  return parameters.filter((parameter) => !parameter.species || parameter.species === species)
}

// Which composer builds a composed condition's parameter list.
//
// `composed: true` used to mean "this is cancer", because cancer was the only
// one. Gastrointestinal Disease is composed too and composes differently — no
// diagnosis layer, no per-instance measures — so a definition now names its
// own composer rather than every composed condition being assumed to be
// cancer.
const COMPOSERS = {
  cancer: (config) => parametersForCancer(config),
  gastrointestinal: (config, species) => parametersForGi(config, species),
}

export function parametersFor(definition, config, species) {
  if (!definition) return []
  const composer = definition.composed ? COMPOSERS[definition.key] : null
  const base = composer ? composer(config, species) : (definition.parameters ?? [])
  return forSpecies(base, species)
}

export function resolveDefinition(definition, config, species) {
  if (!definition) return null
  return { ...definition, parameters: parametersFor(definition, config, species) }
}

// --- editing helpers ------------------------------------------------------

export function toggleDiagnosis(config, key) {
  const c = normaliseCancerConfig(config)
  const has = c.diagnoses.includes(key)
  return {
    ...c,
    diagnoses: has ? c.diagnoses.filter((entry) => entry !== key) : [...c.diagnoses, key],
    // Clearing the free text when "Something else" is deselected stops a
    // stale diagnosis lingering in the report for a pet who no longer has it.
    otherDiagnosis: has && key === 'other' ? '' : c.otherDiagnosis,
    // Dropping the detail with the diagnosis stops a stale "intestinal"
    // lingering in the record for a cat who turned out not to have lymphoma.
    diagnosisDetails: has
      ? Object.fromEntries(Object.entries(c.diagnosisDetails).filter(([k]) => k !== key))
      : c.diagnosisDetails,
  }
}

export function setOtherDiagnosis(config, text) {
  return { ...normaliseCancerConfig(config), otherDiagnosis: text }
}

export function setDiagnosisDetail(config, diagnosisKey, patch) {
  const c = normaliseCancerConfig(config)
  return {
    ...c,
    diagnosisDetails: {
      ...c.diagnosisDetails,
      [diagnosisKey]: { ...(c.diagnosisDetails[diagnosisKey] ?? {}), ...patch },
    },
  }
}

export function diagnosisDetail(config, diagnosisKey) {
  return normaliseCancerConfig(config).diagnosisDetails[diagnosisKey] ?? {}
}

// Turning a module on or off, whether it got there by suggestion or by hand.
//
// The two lists do different jobs: `modules` is what the owner added, and
// `excludedModules` is what they removed. A module can be suggested AND
// excluded, which is how "the diagnosis suggests Urination but I do not want
// to answer that every day" is represented — and why changing the diagnosis
// later does not silently resurrect it.
export function toggleModule(config, moduleKey) {
  const c = normaliseCancerConfig(config)
  const isOn = activeModuleKeys(c).includes(moduleKey)

  if (isOn) {
    return {
      ...c,
      modules: c.modules.filter((key) => key !== moduleKey),
      excludedModules: c.excludedModules.includes(moduleKey)
        ? c.excludedModules
        : [...c.excludedModules, moduleKey],
    }
  }

  return {
    ...c,
    modules: c.modules.includes(moduleKey) ? c.modules : [...c.modules, moduleKey],
    excludedModules: c.excludedModules.filter((key) => key !== moduleKey),
  }
}

export function setTreatment(config, treatmentKey) {
  return { ...normaliseCancerConfig(config), treatment: treatmentKey }
}

// Ids are sequential per pet rather than random, so they stay readable in the
// database and in a chart key. Math.random() would also make the id unstable
// across a retried save.
function nextInstanceId(instances, type) {
  const prefix = type === 'node' ? 'n' : 'm'
  let n = 1
  const taken = new Set(instances.map((entry) => entry.id))
  while (taken.has(`${prefix}${n}`)) n += 1
  return `${prefix}${n}`
}

export function addInstance(config, { label, type = 'lump', firstSeen = null }) {
  const c = normaliseCancerConfig(config)
  return {
    ...c,
    instances: [
      ...c.instances,
      { id: nextInstanceId(c.instances, type), label: label ?? '', type, firstSeen },
    ],
  }
}

// The instance is removed from the config, so it stops being asked about. Its
// past readings stay in condition_entries under their old keys — deleting
// history because a lump was removed would throw away the record of what
// happened, which is the opposite of what this app is for.
export function removeInstance(config, instanceId) {
  const c = normaliseCancerConfig(config)
  return { ...c, instances: c.instances.filter((entry) => entry.id !== instanceId) }
}

export function instancesOfType(config, type) {
  return normaliseCancerConfig(config).instances.filter((entry) => entry.type === type)
}

// Days since the most recent treatment event, or null if there has not been
// one. Derived rather than asked: the owner already logs the treatment as an
// event, and "lethargic on day 8" is a different question to "lethargic".
export function daysSinceTreatment(events, todayIso) {
  const treatments = (events ?? [])
    .filter((event) => event.type === 'medication_started' || event.type === 'treatment')
    .map((event) => event.date)
    .filter(Boolean)
    .sort()

  const last = treatments[treatments.length - 1]
  if (!last || !todayIso) return null

  const ms = Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)
  if (!Number.isFinite(ms)) return null
  return Math.floor(ms / 86400000)
}
