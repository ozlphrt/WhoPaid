import type { Expense, ExpenseParticipant } from '../types';
import { add, div, mul, roundMoney, sub } from './decimal';

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

export function allocateExpenseAmount(
  total: number,
  userIds: string[],
  weights?: number[]
): ExpenseParticipant[] {
  const ids = uniqueIds(userIds);
  if (ids.length === 0) return [];

  const safeWeights = weights && weights.length === ids.length && weights.some(weight => weight > 0)
    ? weights.map(weight => Math.max(0, weight))
    : ids.map(() => 1);
  const totalWeight = safeWeights.reduce((sum, weight) => add(sum, weight), 0);
  let allocated = 0;

  return ids.map((userId, index) => {
    const amount = index === ids.length - 1
      ? roundMoney(sub(total, allocated), 2)
      : roundMoney(mul(total, div(safeWeights[index], totalWeight)), 2);
    allocated = add(allocated, amount);
    return { userId, amount };
  });
}

/**
 * Adds a genuinely new trip member to an existing equal-split expense.
 * Custom splits and expenses that already contain any identity alias are
 * intentionally left unchanged.
 */
export function addMemberToEqualExpense(
  expense: Expense,
  memberUserId: string,
  identityAliases: string[] = []
): Expense | null {
  if (
    expense.isDeleted ||
    expense.splitMode !== 'equal' ||
    expense.participants.length === 0 ||
    !memberUserId
  ) return null;

  const memberIdentities = new Set([memberUserId, ...identityAliases].filter(Boolean));
  if (expense.participants.some(participant => memberIdentities.has(participant.userId))) {
    return null;
  }

  const participants = allocateExpenseAmount(
    expense.originalAmount,
    [...expense.participants.map(participant => participant.userId), memberUserId]
  );

  return {
    ...expense,
    participants,
    clientSyncStatus: 'pending',
    updatedAt: new Date().toISOString()
  };
}
