import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Trip, TripMember, Expense, ParticipantBalance, RecommendedTransfer } from '../types';
import { formatMoney } from './decimal';

function cleanPdfText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    // Replace Unicode minus, en-dash, em-dash with standard ASCII hyphen
    .replace(/[\u2212\u2013\u2014]/g, '-')
    // Strip emojis and supplementary Unicode symbols that corrupt standard PDF fonts
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{FE0F}]/gu, '')
    .trim();
}

function formatMoneyPdf(amount: number, currency: string = 'EUR', showSign: boolean = false): string {
  const formatted = formatMoney(amount, currency, showSign);
  return cleanPdfText(formatted);
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

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${trip.name.replace(/\s+/g, '_')}_expenses.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
  const doc = new jsPDF();
  const memberMap = new Map(members.map(m => [m.userId, m.name]));

  const cleanTripName = cleanPdfText(trip.name) || 'Trip Report';

  // Header Banner
  doc.setFillColor(13, 148, 136); // Teal #0d9488
  doc.rect(0, 0, 210, 28, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(`WhoPaid  |  ${cleanTripName}`, 14, 18);

  doc.setFontSize(10);
  doc.text(`Dates: ${trip.startDate || 'N/A'} - ${trip.endDate || 'N/A'}   |   Main Currency: ${trip.mainCurrency}`, 14, 25);

  let currentY = 36;

  // Overview Summary Cards
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.text('Trip Overview', 14, currentY);
  currentY += 6;

  doc.setFontSize(10);
  doc.text(`Total Group Spend: ${formatMoneyPdf(totalSpend, trip.mainCurrency)}`, 14, currentY);
  currentY += 5;
  doc.text(`Participants: ${members.length} members`, 14, currentY);
  currentY += 5;
  doc.text(`Total Transactions: ${expenses.filter(e => !e.isDeleted).length} active expenses`, 14, currentY);
  currentY += 8;

  // Category Breakdown Table
  doc.setFontSize(12);
  doc.text('Category Breakdown', 14, currentY);
  currentY += 4;

  const categoryRows = categorySpend.map(c => [
    cleanPdfText(c.category),
    formatMoneyPdf(c.amount, trip.mainCurrency),
    `${c.percentage.toFixed(1)}%`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Category', 'Amount', 'Share']],
    body: categoryRows,
    theme: 'striped',
    headStyles: { fillColor: [15, 118, 110] },
    margin: { left: 14, right: 14 }
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Balances Table
  doc.setFontSize(12);
  doc.text('Participant Balances', 14, currentY);
  currentY += 4;

  const balanceRows = balances.map(b => [
    cleanPdfText(b.householdName ? `${b.name} (${b.householdName})` : b.name),
    formatMoneyPdf(b.paid, trip.mainCurrency),
    formatMoneyPdf(b.share, trip.mainCurrency),
    formatMoneyPdf(b.net, trip.mainCurrency, true)
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Participant', 'Paid', 'Share', 'Net Balance']],
    body: balanceRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 118, 110] },
    margin: { left: 14, right: 14 }
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Recommended Settlements
  if (transfers.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(12);
    doc.text('Recommended Settlements (Minimum Transfers)', 14, currentY);
    currentY += 4;

    const transferRows = transfers.map(t => [
      cleanPdfText(t.debtorHouseholdName ? `${t.debtorName} (${t.debtorHouseholdName})` : t.debtorName),
      'pays',
      cleanPdfText(t.creditorHouseholdName ? `${t.creditorName} (${t.creditorHouseholdName})` : t.creditorName),
      formatMoneyPdf(t.amount, t.currency)
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Debtor', '', 'Creditor', 'Amount']],
      body: transferRows,
      theme: 'plain',
      headStyles: { fillColor: [51, 65, 85] },
      margin: { left: 14, right: 14 }
    });

    // @ts-ignore
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }

  // Expense List (New Page)
  doc.addPage();
  currentY = 20;

  doc.setFontSize(14);
  doc.text('Complete Expense History', 14, currentY);
  currentY += 6;

  const activeExpenses = expenses.filter(e => !e.isDeleted);
  const expenseRows = activeExpenses.map(exp => [
    exp.date ? exp.date.split('T')[0] : '',
    cleanPdfText(exp.description),
    cleanPdfText(exp.category),
    cleanPdfText(memberMap.get(exp.paidByUserId) || exp.paidByUserId),
    `${exp.originalAmount.toFixed(2)} ${exp.originalCurrency}`,
    formatMoneyPdf(exp.convertedAmount, trip.mainCurrency)
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Description', 'Category', 'Paid By', 'Original', `Converted (${trip.mainCurrency})`]],
    body: expenseRows,
    theme: 'striped',
    headStyles: { fillColor: [15, 118, 110] },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 }
  });

  doc.save(`${cleanTripName.replace(/\s+/g, '_')}_Report.pdf`);
}
