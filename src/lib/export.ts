import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Trip, TripMember, Expense, ParticipantBalance, RecommendedTransfer } from '../types';

function cleanPdfText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    // Replace Unicode minus, en-dash, em-dash with standard ASCII hyphen
    .replace(/[\u2212\u2013\u2014]/g, '-')
    // Strip emojis and non-standard symbols across all Unicode blocks
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|[\u{1F000}-\u{1FFFF}])/gu, '')
    .trim();
}

function formatMoneyPdf(amount: number, currency: string = 'EUR', showSign: boolean = false): string {
  const absolute = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const sign = showSign
    ? amount > 0.005 ? '+' : amount < -0.005 ? '-' : ''
    : amount < -0.005 ? '-' : '';
  return `${sign}${currency} ${absolute}`;
}

const PDF_COLORS = {
  ink: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  soft: [248, 250, 252] as [number, number, number],
  navy: [15, 23, 42] as [number, number, number],
  teal: [13, 148, 136] as [number, number, number],
  tealDark: [15, 118, 110] as [number, number, number],
  positive: [4, 120, 87] as [number, number, number],
  negative: [190, 24, 93] as [number, number, number],
  white: [255, 255, 255] as [number, number, number]
};

function formatPdfDate(value?: string): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return cleanPdfText(value);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getLastTableY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 0;
}

function ensureSectionSpace(doc: jsPDF, currentY: number, minimumHeight = 28): number {
  if (currentY + minimumHeight <= 275) return currentY;
  doc.addPage();
  return 22;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...PDF_COLORS.teal);
  doc.roundedRect(14, y - 3.5, 2.2, 7, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text(title.toUpperCase(), 20, y + 1);
  return y + 6;
}

function addPageChrome(doc: jsPDF, tripName: string): void {
  const pageCount = doc.getNumberOfPages();
  const generatedOn = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);

    if (page > 1) {
      doc.setFillColor(...PDF_COLORS.soft);
      doc.rect(0, 0, 210, 15, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...PDF_COLORS.navy);
      doc.text('WhoPaid', 14, 9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(cleanPdfText(tripName), 196, 9, { align: 'right' });
      doc.setDrawColor(...PDF_COLORS.line);
      doc.line(14, 13, 196, 13);
    }

    doc.setDrawColor(...PDF_COLORS.line);
    doc.line(14, 283, 196, 283);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(`Generated ${generatedOn}`, 14, 289);
    doc.text(`Page ${page} of ${pageCount}`, 196, 289, { align: 'right' });
  }
}

export function exportTripCSV(
  trip: Trip,
  members: TripMember[],
  expenses: Expense[]
) {
  const memberMap = new Map(members.map(m => [m.userId, m.name]));

  const headers = [
    'Date',
    'Category',
    'Description',
    'Original Amount',
    'Original Currency',
    'Exchange Rate',
    `Converted (${trip.mainCurrency})`,
    'Paid By',
    'Split Mode',
    'Status',
    'Notes'
  ];

  const rows = expenses.map(exp => [
    exp.date ? exp.date.split('T')[0] : '',
    exp.category,
    `"${(exp.description || '').replace(/"/g, '""')}"`,
    exp.originalAmount.toFixed(2),
    exp.originalCurrency,
    exp.exchangeRate.toFixed(4),
    exp.convertedAmount.toFixed(2),
    `"${(memberMap.get(exp.paidByUserId) || exp.paidByUserId).replace(/"/g, '""')}"`,
    exp.splitMode,
    exp.isDeleted ? 'Deleted' : exp.isFlaggedWrong ? 'Flagged' : 'Active',
    `"${(exp.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\r\n');

  // Prepend UTF-8 BOM (\uFEFF) so Excel / Windows properly decodes Turkish & international characters (ç, ğ, ı, ö, ş, ü)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${trip.name.replace(/\s+/g, '_')}_expenses.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function createTripPDFDocument(
  trip: Trip,
  members: TripMember[],
  expenses: Expense[],
  balances: ParticipantBalance[],
  transfers: RecommendedTransfer[],
  categorySpend: { category: string; amount: number; percentage: number }[],
  totalSpend: number
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const memberMap = new Map(members.map(m => [m.userId, m.name]));
  const cleanTripName = cleanPdfText(trip.name) || 'Trip Report';
  const activeExpenses = expenses.filter(e => !e.isDeleted);
  const tripDates = `${formatPdfDate(trip.startDate)} - ${formatPdfDate(trip.endDate)}`;

  doc.setProperties({
    title: `${cleanTripName} - WhoPaid Trip Report`,
    subject: 'Group expense summary and settlement report',
    author: 'WhoPaid',
    creator: 'WhoPaid'
  });

  // Cover header
  doc.setFillColor(...PDF_COLORS.navy);
  doc.rect(0, 0, 210, 43, 'F');
  doc.setFillColor(...PDF_COLORS.teal);
  doc.rect(0, 40, 210, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PDF_COLORS.teal);
  doc.text('WHOPAID / TRIP REPORT', 14, 13);
  doc.setFontSize(22);
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(cleanTripName, 14, 25, { maxWidth: 135 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text(tripDates, 14, 34);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PDF_COLORS.white);
  doc.text(trip.mainCurrency, 196, 25, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('REPORTING CURRENCY', 196, 32, { align: 'right' });

  let currentY = drawSectionTitle(doc, 'Trip overview', 53);
  const cardWidth = 58;
  const cardGap = 4;
  const cards = [
    { label: 'TOTAL SPEND', value: formatMoneyPdf(totalSpend, trip.mainCurrency) },
    { label: 'PARTICIPANTS', value: `${members.length}` },
    { label: 'EXPENSES', value: `${activeExpenses.length}` }
  ];
  cards.forEach((card, index) => {
    const x = 14 + index * (cardWidth + cardGap);
    doc.setFillColor(...PDF_COLORS.soft);
    doc.setDrawColor(...PDF_COLORS.line);
    doc.roundedRect(x, currentY, cardWidth, 22, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text(card.label, x + 4, currentY + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(index === 0 ? 12 : 15);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.text(card.value, x + 4, currentY + 16, { maxWidth: cardWidth - 8 });
  });
  currentY += 32;

  currentY = drawSectionTitle(doc, 'Spending by category', currentY);

  const categoryRows = categorySpend.map(c => [
    cleanPdfText(c.category),
    formatMoneyPdf(c.amount, trip.mainCurrency),
    `${c.percentage.toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Category', 'Amount', 'Share']],
    body: categoryRows.length > 0 ? categoryRows : [['No categorized expenses', '-', '-']],
    theme: 'plain',
    headStyles: {
      fillColor: PDF_COLORS.navy,
      textColor: PDF_COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3
    },
    bodyStyles: { textColor: PDF_COLORS.ink, fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: PDF_COLORS.soft },
    columnStyles: {
      0: { cellWidth: 92 },
      1: { halign: 'right', cellWidth: 55, fontStyle: 'bold' },
      2: { halign: 'right', cellWidth: 35 }
    },
    margin: { top: 18, right: 14, bottom: 20, left: 14 }
  });

  currentY = ensureSectionSpace(doc, getLastTableY(doc) + 12, 35);
  currentY = drawSectionTitle(doc, 'Participant balances', currentY);

  const balanceRows = balances.map(b => [
    cleanPdfText(b.householdName ? `${b.name} (${b.householdName})` : b.name),
    formatMoneyPdf(b.paid, trip.mainCurrency),
    formatMoneyPdf(b.share, trip.mainCurrency),
    formatMoneyPdf(b.net, trip.mainCurrency, true)
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Participant', 'Paid', 'Share', 'Net Balance']],
    body: balanceRows.length > 0 ? balanceRows : [['No participants', '-', '-', '-']],
    theme: 'plain',
    headStyles: {
      fillColor: PDF_COLORS.navy,
      textColor: PDF_COLORS.white,
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3
    },
    bodyStyles: { textColor: PDF_COLORS.ink, fontSize: 8.7, cellPadding: 3 },
    alternateRowStyles: { fillColor: PDF_COLORS.soft },
    columnStyles: {
      0: { cellWidth: 72 },
      1: { halign: 'right', cellWidth: 37 },
      2: { halign: 'right', cellWidth: 37 },
      3: { halign: 'right', cellWidth: 36, fontStyle: 'bold' }
    },
    didParseCell: data => {
      if (data.section !== 'body' || data.column.index !== 3) return;
      const raw = balances[data.row.index]?.net ?? 0;
      data.cell.styles.textColor = raw > 0.005
        ? PDF_COLORS.positive
        : raw < -0.005
          ? PDF_COLORS.negative
          : PDF_COLORS.muted;
    },
    margin: { top: 18, right: 14, bottom: 20, left: 14 }
  });

  if (transfers.length > 0) {
    currentY = ensureSectionSpace(doc, getLastTableY(doc) + 12, 35);
    currentY = drawSectionTitle(doc, 'Recommended settlements', currentY);

    const transferRows = transfers.map(t => [
      cleanPdfText(t.debtorHouseholdName ? `${t.debtorName} (${t.debtorHouseholdName})` : t.debtorName),
      cleanPdfText(t.creditorHouseholdName ? `${t.creditorName} (${t.creditorHouseholdName})` : t.creditorName),
      formatMoneyPdf(t.amount, t.currency)
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['From', 'To', 'Amount']],
      body: transferRows,
      theme: 'plain',
      headStyles: {
        fillColor: PDF_COLORS.tealDark,
        textColor: PDF_COLORS.white,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 3
      },
      bodyStyles: { textColor: PDF_COLORS.ink, fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      columnStyles: {
        0: { cellWidth: 72 },
        1: { cellWidth: 72 },
        2: { halign: 'right', cellWidth: 38, fontStyle: 'bold' }
      },
      margin: { top: 18, right: 14, bottom: 20, left: 14 }
    });
  }

  doc.addPage();
  currentY = drawSectionTitle(doc, 'Complete expense history', 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.muted);
  doc.text(`${activeExpenses.length} active expenses / converted to ${trip.mainCurrency}`, 14, currentY + 1);
  currentY += 6;
  const expenseRows = activeExpenses.map(exp => [
    formatPdfDate(exp.date),
    cleanPdfText(exp.description),
    cleanPdfText(exp.category),
    cleanPdfText(memberMap.get(exp.paidByUserId) || exp.paidByUserId),
    `${exp.originalAmount.toFixed(2)} ${exp.originalCurrency}`,
    formatMoneyPdf(exp.convertedAmount, trip.mainCurrency)
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Description', 'Category', 'Paid By', 'Original', `Converted (${trip.mainCurrency})`]],
    body: expenseRows.length > 0 ? expenseRows : [['-', 'No active expenses', '-', '-', '-', '-']],
    theme: 'plain',
    headStyles: {
      fillColor: PDF_COLORS.navy,
      textColor: PDF_COLORS.white,
      fontStyle: 'bold',
      fontSize: 7.2,
      cellPadding: 2.5,
      valign: 'middle'
    },
    bodyStyles: { textColor: PDF_COLORS.ink, fontSize: 7.5, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: PDF_COLORS.soft },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 48 },
      2: { cellWidth: 27 },
      3: { cellWidth: 31 },
      4: { halign: 'right', cellWidth: 27 },
      5: { halign: 'right', cellWidth: 25, fontStyle: 'bold' }
    },
    styles: { overflow: 'linebreak', lineColor: PDF_COLORS.line, lineWidth: 0.1 },
    showHead: 'everyPage',
    margin: { top: 18, right: 14, bottom: 20, left: 14 }
  });

  addPageChrome(doc, cleanTripName);
  return doc;
}

export function exportTripPDF(
  trip: Trip,
  members: TripMember[],
  expenses: Expense[],
  balances: ParticipantBalance[],
  transfers: RecommendedTransfer[],
  categorySpend: { category: string; amount: number; percentage: number }[],
  totalSpend: number
) {
  const doc = createTripPDFDocument(
    trip,
    members,
    expenses,
    balances,
    transfers,
    categorySpend,
    totalSpend
  );
  const cleanTripName = cleanPdfText(trip.name) || 'Trip Report';
  doc.save(`${cleanTripName.replace(/\s+/g, '_')}_Report.pdf`);
}
