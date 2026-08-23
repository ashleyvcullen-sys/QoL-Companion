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
import { buildDailySeries } from '../lib/qolData'
import { computeGeneralQolResult, computeOverviewCategories } from '../lib/scoring'

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

const PDF_MARGIN = 40

async function buildReportPdf({ pet, generalResult, recent, notesText, chartRefs }) {
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

  addSectionHeader('Latest scores')
  addLine(`General QoL: ${generalResult ? `${generalResult.percent}% — ${generalResult.band}` : 'Not yet assessed'}`)
  addSpacer()

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

  await addChartSection('Overview', chartRefs.overview.current)
  await addChartSection('General QoL over time', chartRefs.general.current)

  for (const { key, label } of WELLBEING_CONCEPTS) {
    await addChartSection(`${label} over time`, chartRefs.concepts.current[key])
  }

  return doc
}

export default function ExportReport() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const { generalEntries, painEntries, loading } = useQolHistory(pet?.id)

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const overviewChartRef = useRef(null)
  const generalChartRef = useRef(null)
  const conceptChartRefs = useRef({})

  const latestGeneralEntry = generalEntries[generalEntries.length - 1] ?? null
  const latestPainEntry = painEntries[painEntries.length - 1] ?? null
  const generalResult = latestGeneralEntry ? computeGeneralQolResult(latestGeneralEntry) : null
  const overview = computeOverviewCategories(latestGeneralEntry, latestPainEntry)
  const dailySeries = buildDailySeries(generalEntries, painEntries)
  const recent = dailySeries.slice(-10).reverse()
  const notesText = latestGeneralEntry?.notes?.trim() ? latestGeneralEntry.notes : 'No notes added.'

  const hasBaseline = generalEntries.length > 0 || painEntries.length > 0
  const baselineOverview = computeOverviewCategories(generalEntries[0] ?? null, painEntries[0] ?? null)
  const hasChartHistory = dailySeries.length > 0

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
        chartRefs: { overview: overviewChartRef, general: generalChartRef, concepts: conceptChartRefs },
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
        <Btn type="button" className="no-print" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Generating…' : Capacitor.isNativePlatform() ? 'Share Report' : 'Print'}
        </Btn>
        {exportError && <p className="form-error" role="alert">{exportError}</p>}
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

          <Card>
            <SectionTitle>Latest scores</SectionTitle>
            <div className="report-field-row">
              <span>General QoL</span>
              <strong>{generalResult ? `${generalResult.percent}% — ${generalResult.band}` : 'Not yet assessed'}</strong>
            </div>
          </Card>

          <Card>
            <SectionTitle>Notes</SectionTitle>
            <p>{notesText}</p>
          </Card>

          <Card>
            <SectionTitle>Overview</SectionTitle>
            {WELLBEING_CONCEPTS.map(({ key, label }) => (
              <div key={key} className="report-field-row">
                <span>{label}</span>
                <strong>{overview[key] != null ? `${Math.round(overview[key])}%` : '—'}</strong>
              </div>
            ))}
          </Card>

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
            baselineOverview={baselineOverview}
            hasBaseline={hasBaseline}
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
      </div>

      <Footer className="no-print" />
    </div>
  )
}
