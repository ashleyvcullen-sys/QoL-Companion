import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
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
import ChartView from '../components/ChartView'
import { WELLBEING_CONCEPTS } from '../components/WellbeingConcepts'
import { usePets } from '../lib/PetsContext'
import { useEntitlements } from '../lib/EntitlementsContext'
import { useQolHistory } from '../lib/useQolHistory'
import { buildDailySeries } from '../lib/qolData'
import { useBcsHistory } from '../lib/bcsData'
import { computeGeneralQolResult, computeOverviewCategories } from '../lib/scoring'
import { conditionByKey } from '../lib/conditions'
import {
  CHART_GROUPS,
  buildChartRegistry,
  configsByCondition,
  groupCharts,
  resolveTrackedConditions,
} from '../lib/charts'
import {
  useAllConditionEntries,
  useAllConditionEvents,
  usePetConditions,
} from '../lib/conditionsData'
import { usePetMedia } from '../lib/mediaData'
import { useMedications } from '../lib/medicationsData'
import { formatDateDDMMYY } from '../lib/formatDate'

// What the report contains when the owner never touches the picker: the
// overall score and all five wellbeing pillars, which is exactly what it
// contained before this screen had any choices at all.
const DEFAULT_CHART_KEYS = ['overall', ...WELLBEING_CONCEPTS.map((c) => `pillar:${c.key}`)]

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

const PDF_MARGIN = 40

// Dismissing the share sheet REJECTS rather than resolving, so a cancel
// arrives here looking exactly like a failure — which is why backing out of
// the share dialog used to leave "Something went wrong generating the
// report" on screen after a report that had generated perfectly well.
//
// There is no error code to test, so this matches on the message. Both
// spellings appear across platforms, and AbortError is what the web Share
// API throws for the same gesture.
function isShareCancellation(error) {
  if (!error) return false
  if (error.name === 'AbortError') return true
  const message = String(error.message ?? error).toLowerCase()
  return (
    message.includes('cancel') ||
    message.includes('canceled') ||
    message.includes('cancelled') ||
    message.includes('abort') ||
    message.includes('dismiss')
  )
}


async function buildReportPdf({
  pet,
  generalResult,
  recent,
  notes,
  media,
  chartRefs,
  charts,
  includeOverall,
  includeNotes,
  includeMedia,
}) {
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

  addTitle(`${pet.name}'s Quality of Life Report`)

  addSectionHeader('Pet')
  addLine(`Name: ${pet.name}`)
  addLine(`Species: ${capitalize(pet.species)}`)
  addLine(`Age: ${pet.age_label || 'Not recorded'}`)
  addLine(`Sex: ${capitalize(pet.sex)}`)
  addSpacer()

  if (includeOverall) {
    addSectionHeader('Latest scores')
    addLine(`Overall QoL: ${generalResult ? `${generalResult.percent}% — ${generalResult.band}` : 'Not yet assessed'}`)
    addSpacer()
  }

  // Optional, on Ash's instruction 4 Sep 2026. A note is the one free-text
  // thing in this app: it can name a person, describe a household, or say
  // something the owner would not put in front of a stranger. Deciding
  // whether it goes to the vet is the owner's call, not a default.
  //
  // Off unless chosen — the safe default for free text is not to send it.
  if (includeNotes) {
  addSectionHeader('Notes')
  if (notes.length === 0) {
    addLine('No notes recorded.')
  } else {
    // Every note with its date, newest first. The report used to carry only
    // the most recent one, which is the least useful version: the note
    // written the day something changed is what a vet wants to read, and it
    // stops being the latest as soon as anything else is logged.
    notes.forEach((note) => {
      addLine(`${formatDateDDMMYY(note.date)} — ${note.source}`)
      addLine(note.text)
      addSpacer(6)
    })
  }
  addSpacer()
  }

  addSectionHeader('Recent assessments')
  if (recent.length === 0) {
    addLine('No assessments logged yet.')
  } else {
    recent.forEach((day) => {
      addLine(`${formatDateDDMMYY(day.date)}: ${day.generalPercent != null ? `${day.generalPercent}%` : '—'}`)
    })
  }
  addSpacer(20)

  // The overview bars aren't a chart in the registry — they're a snapshot of
  // the latest assessment rather than a series — so they're captured
  // separately, under their own key.
  if (includeOverall) {
    await addChartSection('Overview', chartRefs.current.__overview)
  }

  // Everything else comes out of the registry, in registry order, drawn from
  // the same descriptors the screen uses. A heading is emitted when the
  // condition changes, so a report covering two conditions reads as two
  // labelled blocks rather than one undifferentiated run of charts. Overall
  // and the pillars need no heading — their chart titles already say it.
  let lastGroup = null
  for (const chart of charts) {
    if (chart.groupLabel !== lastGroup) {
      if (chart.group === CHART_GROUPS.CONDITION) addSectionHeader(chart.groupLabel)
      lastGroup = chart.groupLabel
    }
    await addChartSection(chart.title, chartRefs.current[chart.key])
  }

  if (includeMedia && media.length > 0) {
    addSectionHeader('Photos and videos')
    for (const item of media) {
      // A video can't be embedded in a PDF, so it is listed rather than
      // shown. Saying so explicitly beats silently omitting it and leaving
      // the owner wondering whether the export worked.
      if (item.mediaType === 'video') {
        addLine(`${item.takenOn} - video${item.caption ? `: ${item.caption}` : ''} (not included in PDF)`)
        continue
      }
      if (!item.dataUrl) continue

      const ratio = item.width && item.height ? item.height / item.width : 0.75
      const imgWidth = Math.min(contentWidth, 300)
      const imgHeight = imgWidth * ratio

      ensureSpace(imgHeight + 28)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`${item.takenOn}${item.caption ? ` - ${item.caption}` : ''}`, PDF_MARGIN, cursorY)
      cursorY += 12
      doc.addImage(item.dataUrl, 'JPEG', PDF_MARGIN, cursorY, imgWidth, imgHeight)
      cursorY += imgHeight + 14
    }
  }

  return doc
}

// Photos live behind short-lived signed URLs, which a PDF can't reference,
// so each is fetched and inlined as data. Done at export time rather than on
// load: most reports won't include photos, and pulling every image every time
// someone opens this screen would be a lot of data for nothing.
async function loadMediaForPdf(items, urls) {
  const loaded = []
  for (const item of items) {
    if (item.mediaType === 'video') { loaded.push(item); continue }
    const url = urls[item.storagePath]
    if (!url) continue
    try {
      const blob = await fetch(url).then((response) => response.blob())
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.readAsDataURL(blob)
      })
      const size = await new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = () => resolve({})
        img.src = dataUrl
      })
      loaded.push({ ...item, dataUrl, ...size })
    } catch {
      // One unreadable photo shouldn't abort the whole report.
      loaded.push(item)
    }
  }
  return loaded
}

export default function ExportReport() {
  const { selectedPet } = usePets()
  const { hasPremium } = useEntitlements()
  const navigate = useNavigate()
  const pet = selectedPet
  const { generalEntries, painEntries, loading } = useQolHistory(pet?.id)

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const { conditions } = usePetConditions(pet?.id)
  const { byCondition } = useAllConditionEntries(pet?.id)
  const { byCondition: eventsByCondition } = useAllConditionEvents(pet?.id)
  const { entries: bcsEntries } = useBcsHistory(pet?.id)
  const { items: mediaItems, urls: mediaUrls } = usePetMedia(pet?.id)
  // Only for the medication start/stop marks on the calendars. This import
  // was added without its hook, so `medications` was an undefined variable
  // and the screen threw the moment it rendered.
  const { medications } = useMedications(pet?.id)

  // null means "the owner hasn't touched the picker", which is not the same
  // as "the owner deselected everything" — the first gets the default report,
  // the second is told to pick something. Resolving lazily rather than
  // seeding state in an effect also avoids a first render where the report
  // claims to contain nothing because the charts haven't loaded yet.
  // A screen can arrive here having already decided what is worth exporting:
  // the condition page sends its own charts, so an owner who has just looked
  // at a summary and thought "my vet should see this" does not have to find
  // it again in a list of everything. It is a starting point, not a lock —
  // the picker below works exactly as it always did, and they can add the
  // overall trend or take a chart out.
  const location = useLocation()
  const preselected = Array.isArray(location.state?.preselect) && location.state.preselect.length > 0
    ? location.state.preselect
    : null

  const [selectedKeys, setSelectedKeys] = useState(preselected)
  // Off by default: photos make the file much larger and are not wanted for
  // most visits.
  const [includeMedia, setIncludeMedia] = useState(false)

  // Notes are free text about a private situation; they go only if asked for.
  // Ash's instruction 4 Sep 2026.
  const [includeNotes, setIncludeNotes] = useState(false)

  // Ash's instruction 4 Sep 2026 — a way to see the charts before generating
  // the report. Everything else on this screen is already a live preview of
  // what the PDF will contain; the charts were the one part that was not,
  // because they are rendered off-screen purely to be photographed.
  //
  // Off by default, and rendered only while open. These are the same recharts
  // components the Trends screen draws, and mounting a second copy of every
  // selected one on a screen nobody has asked to see is work for nothing.
  const [previewCharts, setPreviewCharts] = useState(false)

  const activeKeys = selectedKeys ?? DEFAULT_CHART_KEYS

  function toggleChart(key) {
    setSelectedKeys(
      activeKeys.includes(key)
        ? activeKeys.filter((entry) => entry !== key)
        : [...activeKeys, key],
    )
  }

  // One ref per chart, keyed the same way the registry is, so the PDF builder
  // can find a chart's captured DOM node by its key alone.
  const chartRefs = useRef({})

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
  // Every note the app holds, from wherever it was written, newest first.
  // Assessment notes and condition notes answer different questions and a
  // vet reading the report benefits from both, so they are merged and
  // labelled by source rather than kept apart.
  const notes = [
    ...generalEntries
      .filter((entry) => entry.notes?.trim())
      .map((entry) => ({ date: entry.date, source: 'Assessment', text: entry.notes.trim() })),
    ...Object.entries(byCondition).flatMap(([conditionKey, entries]) =>
      entries
        .filter((entry) => entry.notes?.trim())
        .map((entry) => ({
          date: entry.date,
          source: conditionByKey(conditionKey)?.label ?? conditionKey,
          text: entry.notes.trim(),
        })),
    ),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const trackedConditions = resolveTrackedConditions(conditions)

  // Everything this pet has that could go in a report. Built from the same
  // function the screens use, so the picker can never offer a chart the app
  // can't draw, and can never miss one it can.
  const charts = buildChartRegistry({
    generalEntries,
    painEntries,
    dailySeries,
    bcsEntries,
    // Only for the calendar's start/stop marks — the medication list itself
    // lives on its own screen.
    medications,
    trackedConditions,
    entriesByCondition: byCondition,
    eventsByCondition,
    configByCondition: configsByCondition(conditions),
    species: pet?.species,
    pet,
  })

  const chartGroups = groupCharts(charts)
  const selectedCharts = charts.filter((chart) => activeKeys.includes(chart.key))
  const includeOverall = activeKeys.includes('overall')
  const selectedPillarKeys = WELLBEING_CONCEPTS
    .map((concept) => concept.key)
    .filter((key) => activeKeys.includes(`pillar:${key}`))

  const nothingSelected = selectedCharts.length === 0 && !includeMedia

  async function handleExport() {
    // Gated here, at the action, rather than by hiding the button.
    //
    // Someone on this screen has already chosen what to include and is one
    // tap from a report for a vet visit — they know exactly what they want
    // and why. Hiding the control would leave them wondering where the
    // feature went; answering at the moment of intent is both more honest
    // and the strongest point at which to explain what Premium is for.
    //
    // The screen itself stays free, deliberately. Everything it previews is
    // free-tier data the owner is already entitled to read; it is the
    // generated report that is the paid artefact.
    if (!hasPremium) {
      navigate('/paywall', { state: { feature: 'export' } })
      return
    }

    if (!Capacitor.isNativePlatform()) {
      window.print()
      return
    }

    setExporting(true)
    setExportError('')

    try {
      const media = includeMedia ? await loadMediaForPdf(mediaItems, mediaUrls) : []

      const doc = await buildReportPdf({
        pet,
        generalResult,
        recent,
        notes,
        media,
        chartRefs,
        charts: selectedCharts,
        includeOverall,
        includeNotes,
        includeMedia,
      })

      const base64 = doc.output('datauristring').split(',')[1]
      const fileName = `${pet.name.replace(/[^a-z0-9]/gi, '_')}_QoL_Report.pdf`

      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      })

      await Share.share({
        title: `${pet.name}'s Quality of Life Report`,
        files: [uri],
        dialogTitle: 'Share report',
      })
    } catch (error) {
      // Changing your mind is not an error. The file is already written and
      // the owner chose not to send it, so there is nothing to report and
      // nothing to retry.
      if (isShareCancellation(error)) return

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
        {/* Not disabled when locked. A greyed-out control that leads nowhere
            explains nothing and is the pattern Apple rejects; this one is
            live, and tapping it answers the question. The nothing-selected
            disable still applies to subscribers, for whom it is a real
            precondition rather than a paywall. */}
        <Btn
          type="button"
          className="no-print"
          onClick={handleExport}
          disabled={exporting || (hasPremium && nothingSelected)}
          aria-label={hasPremium ? undefined : 'Share Report, premium feature, locked'}
        >
          {/* The same lock the home tiles wear, for the same reason: the
              control has to say what it is before it is tapped, not only
              after. aria-hidden because the button's own label already
              carries the state. */}
          {!hasPremium && !exporting && (
            <Lock size={13} strokeWidth={2.5} className="btn-lock" aria-hidden="true" />
          )}
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

        {/* One group per registry group, one chip per chart. The picker is
            generated rather than written out, so a chart that exists on a
            screen can't be missing from the report — which is how body
            condition, weight and the day-by-day calendars came to be
            unexportable in the first place. */}
        {chartGroups.map((group) => (
          <div key={group.label} className="include-group">
            <span className="include-group-label">{group.label}</span>
            <div className="symptom-chips">
              {group.charts.map((chart) => (
                <button
                  key={chart.key}
                  type="button"
                  className={`chip ${activeKeys.includes(chart.key) ? 'selected' : ''}`.trim()}
                  onClick={() => toggleChart(chart.key)}
                >
                  {chart.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {chartGroups.length === 0 && (
          <p className="assessment-hint">
            Nothing to report on yet. Log an assessment and the things you can include will
            appear here.
          </p>
        )}

        {/* PENDING ASH — the group label and the hint under it are mine.
            The chip's own wording follows the photos one above it. */}
        {notes.length > 0 && (
          <div className="include-group">
            <span className="include-group-label">Notes</span>
            <div className="symptom-chips">
              <button
                type="button"
                className={`chip ${includeNotes ? 'selected' : ''}`.trim()}
                onClick={() => setIncludeNotes((current) => !current)}
              >
                Include {notes.length} {notes.length === 1 ? 'note' : 'notes'}
              </button>
            </div>
            <p className="assessment-hint">
              Notes are your own words about {pet.name}, including anything you wrote on a day.
              They are left out unless you add them here.
            </p>
          </div>
        )}

        {mediaItems.length > 0 && (
          <div className="include-group">
            <span className="include-group-label">Photos and videos</span>
            <div className="symptom-chips">
              <button
                type="button"
                className={`chip ${includeMedia ? 'selected' : ''}`.trim()}
                onClick={() => setIncludeMedia((current) => !current)}
              >
                Include {mediaItems.length} {mediaItems.length === 1 ? 'item' : 'items'}
              </button>
            </div>
            <p className="assessment-hint">
              Photos are added to the end of the report. Videos can't be put inside a PDF, so
              they're listed by date and caption instead.
            </p>
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

          {includeOverall && (
            <Card>
              <SectionTitle>Latest Scores</SectionTitle>
              <div className="report-field-row">
                <span>Overall QoL</span>
                <strong>{generalResult ? `${generalResult.percent}% — ${generalResult.band}` : 'Not yet assessed'}</strong>
              </div>
            </Card>
          )}

          {/* The preview shows what the report will contain, so it follows
              the same choice — a Notes card sitting here while the PDF has
              none would be the preview lying about the artefact. */}
          {includeNotes && (
            <Card>
              <SectionTitle>Notes</SectionTitle>
              {notes.length === 0 ? (
                <p>No notes recorded.</p>
              ) : (
                notes.map((note, i) => (
                  <div key={`${note.date}-${note.source}-${i}`} className="report-note">
                    <span className="assessment-hint">{formatDateDDMMYY(note.date)} — {note.source}</span>
                    <p>{note.text}</p>
                  </div>
                ))
              )}
            </Card>
          )}

          {selectedPillarKeys.length > 0 && (
            <Card>
              <SectionTitle>Overview</SectionTitle>
              {WELLBEING_CONCEPTS.filter(({ key }) => selectedPillarKeys.includes(key)).map(({ key, label }) => (
                <div key={key} className="report-field-row">
                  <span>{label}</span>
                  <strong>{overview[key] != null ? `${Math.round(overview[key])}%` : '—'}</strong>
                </div>
              ))}
            </Card>
          )}

          {/* Last, because the PDF puts the charts last. PENDING ASH — the
              heading, the button and the two hints are mine. */}
          <Card>
            <SectionTitle>Charts</SectionTitle>
            {selectedCharts.length === 0 ? (
              <p className="assessment-hint">
                No charts selected. Pick them in What to Include above.
              </p>
            ) : (
              <>
                <p className="assessment-hint">
                  {selectedCharts.length} chart{selectedCharts.length === 1 ? '' : 's'} will be
                  included, one per page, after the summary.
                </p>
                <Btn
                  type="button"
                  variant="outline"
                  className="btn-block"
                  onClick={() => setPreviewCharts((open) => !open)}
                >
                  {previewCharts ? 'Hide charts' : 'Preview charts'}
                </Btn>
                {/* Titled, on Ash's instruction 5 Sep 2026. The charts were
                    stacked unlabelled, so a report with a calendar, a weight
                    line and two condition summaries in it previewed as four
                    pictures with nothing to say which was which. The PDF puts
                    a heading above each one; this is the same heading, in the
                    same order.

                    Overview leads, because that is the order the PDF builds
                    them in — see addChartSection above — and it was missing
                    from the preview entirely, so the report had a page the
                    preview never showed. */}
                {previewCharts && includeOverall && (
                  <div className="report-chart-preview">
                    <h3 className="report-chart-title">Overview</h3>
                    <OverviewBars concepts={WELLBEING_CONCEPTS} overview={overview} compact />
                  </div>
                )}
                {previewCharts && selectedCharts.map((chart) => (
                  <div key={chart.key} className="report-chart-preview">
                    <h3 className="report-chart-title">{chart.title}</h3>
                    {/* All time, like the report itself — see the capture
                        block at the foot of this file. A preview that showed
                        one month of a chart the PDF renders in full would be
                        a preview of a different document. */}
                    <ChartView chart={chart} brush={false} allTime showCaption={false} />
                  </div>
                ))}
              </>
            )}
          </Card>

          <Card>
            <SectionTitle>Recent assessments</SectionTitle>
            {recent.length === 0 ? (
              <p>No assessments logged yet.</p>
            ) : (
              recent.map((day) => (
                <div key={day.date} className="report-field-row">
                  <span>{formatDateDDMMYY(day.date)}</span>
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
        <div ref={(el) => { chartRefs.current.__overview = el }} className="pdf-chart-block">
          <OverviewBars
            concepts={WELLBEING_CONCEPTS}
            overview={overview}
            compact
          />
        </div>

        {/* Only the SELECTED charts are mounted — every chart of every
            condition would be a lot to lay out on a screen nobody sees, for a
            report that may include none of them.

            Each goes through ChartView exactly as the screen does, so the
            captured image is the same chart the owner was looking at. The
            brush is dropped (a drag handle means nothing in a static image)
            and the animation disabled (it would otherwise be captured
            mid-flight); the caption is dropped because the PDF puts its own
            heading above each chart. */}
        {selectedCharts.map((chart) => (
          <div
            key={chart.key}
            ref={(el) => { chartRefs.current[chart.key] = el }}
            className="pdf-chart-block"
          >
            {/* `allTime` on Ash's instruction 4 Sep 2026 — the reason she
                asked for an all-time view at all was "especially important
                for exporting reports to see the full picture". Without it a
                vet was handed whichever month the owner happened to have
                open, and a calendar page could show September for a pet whose
                flare was in March.

                The line charts were already all-time here: no brush means
                recharts plots the entire series. It was only the calendars
                that were stuck on one month.

                A comment cannot go between JSX attributes: a braced comment
                in attribute position parses as a spread and fails the build,
                which is why this one sits above the element. */}
            <ChartView
              chart={chart}
              brush={false}
              allTime
              isAnimationActive={false}
              showCaption={false}
            />
          </div>
        ))}
      </div>

      <Footer className="no-print" />
    </div>
  )
}
