import { Expense } from '../types';

export function checkForDuplicateExpense(
  newExpense: {
    description: string;
    originalAmount: number;
    originalCurrency: string;
    paidByUserId: string;
    date: string;
  },
  existingExpenses: Expense[],
  excludeExpenseId?: string
): { isDuplicate: boolean; matchedExpense?: Expense; reason?: string } {
  const newDate = new Date(newExpense.date).getTime();
  const descNorm = newExpense.description.toLowerCase().trim();

  for (const exp of existingExpenses) {
    if (exp.isDeleted) continue;
    if (excludeExpenseId && exp.id === excludeExpenseId) continue;

    // Check payer and currency match
    if (exp.paidByUserId !== newExpense.paidByUserId) continue;
    if (exp.originalCurrency !== newExpense.originalCurrency) continue;

    // Check amount match (exact or within tiny delta)
    const amountDiff = Math.abs(exp.originalAmount - newExpense.originalAmount);
    const isSameAmount = amountDiff < 0.01;

    // Check date proximity (within 24 hours)
    const expDate = new Date(exp.date).getTime();
    const hoursDiff = Math.abs(newDate - expDate) / (1000 * 60 * 60);
    const isNearbyTime = hoursDiff <= 24;

    // Check description similarity
    const existingDescNorm = exp.description.toLowerCase().trim();
    const isSameDesc = descNorm === existingDescNorm || 
      (descNorm.length > 3 && existingDescNorm.includes(descNorm)) || 
      (existingDescNorm.length > 3 && descNorm.includes(existingDescNorm));

    if (isSameAmount && isNearbyTime && isSameDesc) {
      return {
        isDuplicate: true,
        matchedExpense: exp,
        reason: `Similar amount (${exp.originalCurrency} ${exp.originalAmount}), same payer, and matching description within 24h.`
      };
    }
  }

  return { isDuplicate: false };
}
