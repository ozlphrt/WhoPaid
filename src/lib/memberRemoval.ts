import { Expense, ExpenseParticipant } from '../types';
import { add, div, mul, roundMoney, sub } from './decimal';

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function allocateAmount(total: number, userIds: string[], weights?: number[]): ExpenseParticipant[] {
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

export function memberPaidExpense(expense: Expense, memberUserIds: Set<string>): boolean {
  if (expense.isDeleted) return false;
  if (expense.payers?.length) {
    return expense.payers.some(payer => memberUserIds.has(payer.userId) && payer.amount > 0);
  }
  return memberUserIds.has(expense.paidByUserId);
}

export function redistributeExpenseAfterMemberRemoval(
  expense: Expense,
  memberUserIds: Set<string>,
  fallbackParticipantIds: string[]
): Expense | null {
  if (expense.isDeleted || !expense.participants.some(participant => memberUserIds.has(participant.userId))) {
    return null;
  }

  const remaining = expense.participants.filter(participant => !memberUserIds.has(participant.userId));
  const useExistingCustomWeights = expense.splitMode === 'custom' && remaining.length > 0;
  const participantIds = remaining.length > 0
    ? remaining.map(participant => participant.userId)
    : fallbackParticipantIds;
  const participants = allocateAmount(
    expense.originalAmount,
    participantIds,
    useExistingCustomWeights ? remaining.map(participant => participant.amount) : undefined
  );

  if (participants.length === 0) {
    throw new Error('This expense has no remaining participant to receive the redistributed share.');
  }

  return {
    ...expense,
    participants,
    splitMode: useExistingCustomWeights ? 'custom' : 'equal',
    clientSyncStatus: 'pending',
    updatedAt: new Date().toISOString()
  };
}
