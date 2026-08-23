import { useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import OverviewBars from '../components/OverviewBars'
import TrendLineChart from '../components/TrendLineChart'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import { usePets } from '../lib/PetsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { buildDailySeries, buildMeasureSeries } from '../lib/qolData'
import {
  INDIVIDUAL_MEASURE_GROUPS,
  computeGeneralQolResult,
  computeOverviewCategories,
  individualMeasureByKey,
} from '../lib/scoring'
import { chartConfigFor, conditionByKey } from '../lib/conditions'
import { useAllConditionEntries, usePetConditions } from '../lib/conditionsData'

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

const PDF_MARGIN = 40

async function buildReportPdf({ pet, generalResult, recent, notesText, chartRefs, selection }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - PDF_MARGIN * 2
  let cursorY = PDF_MARGIN

  function ensureSpace(height) {
    if (cursorY + height > pageHeight - PDF_MARGIN) {
      doc.addPage()
      cursorY = PDF_MARGIN
    }
  }

  function addTitle(text) {
    ensureSpace(30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(text, PDF_MARGIN, cursorY)
    cursorY += 30
  }

  function addSectionHeader(text) {
    ensureSpace(24)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(text, PDF_MARGIN, cursorY)
    cursorY += 18
  }

  function addLine(text) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    const wrapped = doc.splitTextToSize(text, contentWidth)
    wrapped.forEach((line) => {
      ensureSpace(14)
      doc.text(line, PDF_MARGIN, cursorY)
      cursorY += 14
    })
  }

  function addSpacer(height = 12) {
    cursorY += height
  }

  const CHART_HEADER_HEIGHT = 18

  // Captures the chart first so its height is known upfront, then reserves
  // space for the header + image as a single block — so a header never gets
  // stranded at the bottom of a page with its chart pushed to the next one.
  async function addChartSection(title, el) {
    if (!el) return
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 })
    const imgData = canvas.toDataURL('image/png')
    const imgWidth = contentWidth
    const imgHeight = (canvas.height / canvas.width) * imgWidth

    ensureSpace(CHART_HEADER_HEIGHT + imgHeight)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(title, PDF_MARGIN, cursorY)
    cursorY += CHART_HEADER_HEIGHT

    doc.addImage(imgData, 'PNG', PDF_MARGIN, cursorY, imgWidth, imgHeight)
    cursorY += imgHeight + 16
  }

  addTitle(`${pet.name}'s Quality Of Life Report`)

  addSectionHeader('Pet')
  addLine(`Name: ${pet.name}`)
  addLine(`Species: ${capitalize(pet.species)}`)
  addLine(`Age: ${pet.age_label || 'Not recorded'}`)
  addLine(`Sex: ${capitalize(pet.sex)}`)
  addSpacer()

  if (selection.overall) {
    addSectionHeader('Latest scores')
    addLine(`Overall QoL: ${generalResult ? `${generalResult.percent}% — ${generalResult.band}` : 'Not yet assessed'}`)
    addSpacer()
  }

  addSectionHeader('Notes')
  addLine(notesText)
  addSpacer()

  addSectionHeader('Recent assessments')
  if (recent.length === 0) {
    addLine('No assessments logged yet.')
  } else {
    recent.forEach((day) => {
      addLine(`${day.date}: ${day.generalPercent != null ? `${day.generalPercent}%` : '—'}`)
    })
  }
  addSpacer(20)

  if (selection.overall) {
    await addChartSection('Overview', chartRefs.overview.current)
    await addChartSection('Overall QoL over time', chartRefs.general.current)
  }

  for (const { key, label } of WELLBEING_CONCEPTS) {
    if (!selection.pillars.includes(key)) continue
    await addChartSection(`${label} over time`, chartRefs.concepts.current[key])
  }

  for (const key of selection.measures) {
    const measure = individualMeasureByKey(key)
    await addChartSection(`${measure?.label ?? key} over time`, chartRefs.measures.current[key])
  }

  for (const conditionKey of selection.conditions) {
    const definition = conditionByKey(conditionKey)
    if (!definition) continue
    addSectionHeader(definition.label)
    for (const parameter of definition.parameters) {
      const el = chartRefs.conditions.current[`${conditionKey}:${parameter.key}`]
      if (el) await addChartSection(`${parameter.label} over time`, el)
    }
  }

  return doc
}

export default function ExportReport() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const { generalEntries, painEntries, loading } = useQolHistory(pet?.id)

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const { conditions } = usePetConditions(pet?.id)
  const { byCondition } = useAllConditionEntries(pet?.id)

  // Defaults reproduce what the report contained before this screen had any
  // choices — overall score plus all five pillars — so anyone who ignores
  // the picker gets exactly the report they used to get.
  const [selection, setSelection] = useState({
    overall: true,
    pillars: WELLBEING_CONCEPTS.map((concept) => concept.key),
    measures: [],
    conditions: [],
  })

  function toggle(group, key) {
    setSelection((current) => ({
      ...current,
      [group]: current[group].includes(key)
        ? current[group].filter((entry) => entry !== key)
        : [...current[group], key],
    }))
  }

  const overviewChartRef = useRef(null)
  const generalChartRef = useRef(null)
  const conceptChartRefs = useRef({})
  const measureChartRefs = useRef({})
  const conditionChartRefs = useRef({})

  const latestGeneralEntry = generalEntries[generalEntries.length - 1] ?? null
  const latestPainEntry = painEntries[painEntries.length - 1] ?? null
  // Paired by date rather than just taking the latest of each — the two
  // tables can be a day out of step (e.g. an abandoned assessment that
  // saved one but not the other), and mixing two different days' data into
  // a single score would be wrong.
  const painForLatestGeneral = latestGeneralEntry
    ? painEntries.find((p) => p.date === latestGeneralEntry.date) ?? null
    : null
  const generalResult = latestGeneralEntry
    ? computeGeneralQolResult(latestGeneralEntry, painForLatestGeneral?.beap)
    : null
  const overview = computeOverviewCategories(latestGeneralEntry, latestPainEntry)
  const dailySeries = buildDailySeries(generalEntries, painEntries)
  const recent = dailySeries.slice(-10).reverse()
  const notesText = latestGeneralEntry?.notes?.trim() ? latestGeneralEntry.notes : 'No notes added.'

  const hasChartHistory = dailySeries.length > 0
  const measureSeries = buildMeasureSeries(generalEntries, painEntries)

  // Only conditions actually being tracked, and only those whose definition
  // still exists — a key left in the database for a condition since removed
  // from the app would otherwise render an empty section.
  const trackedConditions = conditions
    .filter((entry) => entry.active && conditionByKey(entry.conditionKey))
    .map((entry) => conditionByKey(entry.conditionKey))

  const nothingSelected =
    !selection.overall &&
    selection.pillars.length === 0 &&
    selection.measures.length === 0 &&
    selection.conditions.length === 0

  async function handleExport() {
    if (!Capacitor.isNativePlatform()) {
      window.print()
      return
    }

    setExporting(true)
    setExportError('')

    try {
      const doc = await buildReportPdf({
        pet,
        generalResult,
        recent,
        notesText,
        chartRefs: {
          overview: overviewChartRef,
          general: generalChartRef,
          concepts: conceptChartRefs,
          measures: measureChartRefs,
          conditions: conditionChartRefs,
        },
        selection,
      })

      const base64 = doc.output('datauristring').split(',')[1]
      const fileName = `${pet.name.replace(/[^a-z0-9]/gi, '_')}_QoL_Report.pdf`

      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      })

      await Share.share({
        title: `${pet.name}'s Quality Of Life Report`,
        files: [uri],
        dialogTitle: 'Share report',
      })
    } catch (error) {
      console.error('Failed to generate/share report PDF:', error)
      setExportError('Something went wrong generating the report. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="screen">
      <HomeLink className="no-print" />
      <Card>
        <SectionTitle>Report</SectionTitle>
        <p>
          {Capacitor.isNativePlatform()
            ? 'A summary and charts you can share, save, or print (via AirPrint) to bring to a vet visit.'
            : 'A summary you can print or save as a PDF to bring to a vet visit.'}
        </p>
        <Btn
          type="button"
          className="no-print"
          onClick={handleExport}
          disabled={exporting || nothingSelected}
        >
          {exporting ? 'Generating…' : Capacitor.isNativePlatform() ? 'Share Report' : 'Print'}
        </Btn>
        {nothingSelected && (
          <p className="assessment-hint no-print">Choose at least one thing to include.</p>
        )}
        {exportError && <p className="form-error" role="alert">{exportError}</p>}
      </Card>

      <Card className="no-print">
        <SectionTitle>What to Include</SectionTitle>
        <p className="assessment-hint">
          Pick as many as you like. A vet visit about one problem is often better served by a
          short report about that problem than by everything at once.
        </p>

        <div className="include-group">
          <span className="include-group-label">Overall</span>
          <div className="symptom-chips">
            <button
              type="button"
              className={`chip ${selection.overall ? 'selected' : ''}`.trim()}
              onClick={() => setSelection((c) => ({ ...c, overall: !c.overall }))}
            >
              Overall QoL
            </button>
          </div>
        </div>

        <div className="include-group">
          <span className="include-group-label">Wellbeing pillars</span>
          <div className="symptom-chips">
            {WELLBEING_CONCEPTS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`chip ${selection.pillars.includes(key) ? 'selected' : ''}`.trim()}
                onClick={() => toggle('pillars', key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {INDIVIDUAL_MEASURE_GROUPS.map((group) => (
          <div className="include-group" key={group.group}>
            <span className="include-group-label">{group.group}</span>
            <div className="symptom-chips">
              {group.measures.map((measure) => (
                <button
                  key={measure.key}
                  type="button"
                  className={`chip ${selection.measures.includes(measure.key) ? 'selected' : ''}`.trim()}
                  onClick={() => toggle('measures', measure.key)}
                >
                  {measure.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {trackedConditions.length > 0 && (
          <div className="include-group">
            <span className="include-group-label">Conditions</span>
            <div className="symptom-chips">
              {trackedConditions.map((condition) => (
                <button
                  key={condition.key}
                  type="button"
                  className={`chip ${selection.conditions.includes(condition.key) ? 'selected' : ''}`.trim()}
                  onClick={() => toggle('conditions', condition.key)}
                >
                  {condition.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {loading && (
        <Card><p>Loading…</p></Card>
      )}

      {!loading && (
        <>
          <Card>
            <SectionTitle>Pet</SectionTitle>
            <div className="report-field-row"><span>Name</span><strong>{pet.name}</strong></div>
            <div className="report-field-row"><span>Species</span><strong>{capitalize(pet.species)}</strong></div>
            <div className="report-field-row"><span>Age</span><strong>{pet.age_label || 'Not recorded'}</strong></div>
            <div className="report-field-row"><span>Sex</span><strong>{capitalize(pet.sex)}</strong></div>
          </Card>

          {selection.overall && (
            <Card>
              <SectionTitle>Latest Scores</SectionTitle>
              <div className="report-field-row">
                <span>Overall QoL</span>
                <strong>{generalResult ? `${generalResult.percent}% — ${generalResult.band}` : 'Not yet assessed'}</strong>
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle>Notes</SectionTitle>
            <p>{notesText}</p>
          </Card>

          {selection.pillars.length > 0 && (
            <Card>
              <SectionTitle>Overview</SectionTitle>
              {WELLBEING_CONCEPTS.filter(({ key }) => selection.pillars.includes(key)).map(({ key, label }) => (
                <div key={key} className="report-field-row">
                  <span>{label}</span>
                  <strong>{overview[key] != null ? `${Math.round(overview[key])}%` : '—'}</strong>
                </div>
              ))}
            </Card>
          )}

          <Card>
            <SectionTitle>Recent assessments</SectionTitle>
            {recent.length === 0 ? (
              <p>No assessments logged yet.</p>
            ) : (
              recent.map((day) => (
                <div key={day.date} className="report-field-row">
                  <span>{day.date}</span>
                  <strong>{day.generalPercent != null ? `${day.generalPercent}%` : '—'}</strong>
                </div>
              ))
            )}
          </Card>
        </>
      )}

      {/* Off-screen chart renderer used to capture images for the PDF export.
          Kept mounted (not display:none) so recharts' ResponsiveContainer can
          measure real layout dimensions — just positioned off-screen. */}
      <div className="pdf-chart-capture" aria-hidden="true">
        <div ref={overviewChartRef} className="pdf-chart-block">
          <OverviewBars
            concepts={WELLBEING_CONCEPTS}
            overview={overview}
            compact
          />
        </div>
        <div ref={generalChartRef} className="pdf-chart-block">
          {hasChartHistory && (
            <TrendLineChart
              data={dailySeries}
              dataKey="generalTotal"
              color="#C97B8C"
              height={220}
              isAnimationActive={false}
            />
          )}
        </div>
        {WELLBEING_CONCEPTS.map(({ key, color }) => (
          <div key={key} ref={(el) => { conceptChartRefs.current[key] = el }} className="pdf-chart-block">
            {hasChartHistory && (
              <TrendLineChart
                data={dailySeries}
                dataKey={key}
                color={color}
                height={200}
                domain={[0, 100]}
                isAnimationActive={false}
              />
            )}
          </div>
        ))}

        {/* Only the SELECTED extras are rendered. The five pillars are cheap
            and always mounted, but rendering all sixteen measures plus every
            parameter of every condition on a screen nobody sees would be a
            lot of charts to lay out for a report that may include none. */}
        {selection.measures.map((key) => (
          <div key={key} ref={(el) => { measureChartRefs.current[key] = el }} className="pdf-chart-block">
            <TrendLineChart
              data={measureSeries}
              dataKey={key}
              color={individualMeasureByKey(key)?.color ?? '#5C6F8A'}
              height={200}
              domain={[0, 10]}
              isAnimationActive={false}
            />
          </div>
        ))}

        {selection.conditions.flatMap((conditionKey) => {
          const definition = conditionByKey(conditionKey)
          if (!definition) return []
          const entries = byCondition[conditionKey] ?? []
          return definition.parameters.map((parameter) => {
            const config = chartConfigFor(parameter, entries, pet?.species)
            if (!config) return null
            return (
              <div
                key={`${conditionKey}:${parameter.key}`}
                ref={(el) => { conditionChartRefs.current[`${conditionKey}:${parameter.key}`] = el }}
                className="pdf-chart-block"
              >
                <TrendLineChart
                  data={config.points}
                  dataKey="value"
                  unit={config.unit}
                  color="#8A5C6F"
                  height={200}
                  domain={config.domain}
                  referenceValue={config.threshold}
                  isAnimationActive={false}
                />
              </div>
            )
          }).filter(Boolean)
        })}
      </div>

      <Footer className="no-print" />
    </div>
  )
}
