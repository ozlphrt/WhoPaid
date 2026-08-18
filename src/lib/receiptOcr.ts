import { CurrencyCode, ExpenseCategory } from '../types';
import { suggestCategory } from './category';

export interface ParsedReceiptData {
  amount?: number;
  currency?: CurrencyCode;
  date?: string; // YYYY-MM-DDTHH:mm
  vendor?: string;
  category?: ExpenseCategory;
  rawText?: string;
}

/**
 * Parses raw text extracted from a receipt to find amount, currency, date, and vendor.
 */
export function parseReceiptText(text: string): ParsedReceiptData {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result: ParsedReceiptData = {
    rawText: text
  };

  if (lines.length === 0) return result;

  // 1. Guess Vendor from top 3 lines (excluding dates/receipt headers)
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const line = lines[i];
    if (line.length > 2 && !/^\d+[\/.-]\d+/.test(line) && !/receipt|tax invoice|welcome|order|table/i.test(line)) {
      result.vendor = line;
      result.category = suggestCategory(line);
      break;
    }
  }

  // 2. Currency detection
  if (/€|\bEUR\b|\bEURO\b/i.test(text)) {
    result.currency = 'EUR';
  } else if (/₺|\bTRY\b|\bTL\b/i.test(text)) {
    result.currency = 'TRY';
  } else if (/£|\bGBP\b/i.test(text)) {
    result.currency = 'GBP';
  } else if (/\$|\bUSD\b/i.test(text)) {
    result.currency = 'USD';
  } else if (/\bCHF\b/i.test(text)) {
    result.currency = 'CHF';
  }

  // 3. Amount extraction (Search for Total / Grand Total / Summe / Montant / Toplam)
  const totalKeywords = /(?:total|grand\s*total|summe|montant|toplam|amount|net|balance\s*due)\s*[:=]?\s*[$€₺£]?\s*([0-9]+[.,][0-9]{2})/i;
  const match = text.match(totalKeywords);

  if (match && match[1]) {
    const normalized = match[1].replace(',', '.');
    const val = parseFloat(normalized);
    if (!isNaN(val) && val > 0) {
      result.amount = val;
    }
  }

  // Fallback: look for the highest decimal amount in the last half of the receipt
  if (!result.amount) {
    const allAmounts: number[] = [];
    const amountRegex = /(?:[$€₺£]\s*)?([0-9]+[.,][0-9]{2})\b/g;
    let m;
    while ((m = amountRegex.exec(text)) !== null) {
      const val = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(val) && val > 0 && val < 100000) {
        allAmounts.push(val);
      }
    }
    if (allAmounts.length > 0) {
      // Pick the max plausible total
      result.amount = Math.max(...allAmounts);
    }
  }

  // 4. Date extraction
  // Pattern 1: YYYY-MM-DD
  const dateMatch1 = text.match(/\b(202\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/);
  if (dateMatch1) {
    result.date = `${dateMatch1[1]}-${dateMatch1[2]}-${dateMatch1[3]}T12:00`;
  } else {
    // Pattern 2: DD/MM/YYYY or DD.MM.YYYY
    const dateMatch2 = text.match(/\b(0[1-9]|[12]\d|3[01])[./-](0[1-9]|1[0-2])[./-](202\d)\b/);
    if (dateMatch2) {
      result.date = `${dateMatch2[3]}-${dateMatch2[2]}-${dateMatch2[1]}T12:00`;
    }
  }

  return result;
}

/**
 * Preprocesses receipt image canvas (contrast enhancement & grayscale for clearer OCR)
 */
export function preprocessReceiptImage(imageFile: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(reader.result as string);

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Grayscale + contrast enhancement
        for (let i = 0; i < data.length; i += 4) {
          const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // Boost contrast
          const contrast = (avg - 128) * 1.35 + 128;
          const clamped = Math.max(0, Math.min(255, contrast));
          data[i] = clamped;
          data[i + 1] = clamped;
          data[i + 2] = clamped;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(imageFile);
  });
}
