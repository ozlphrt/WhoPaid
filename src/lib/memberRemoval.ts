import { Expense } from '../types';
import { allocateExpenseAmount } from './expenseParticipation';

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
  const participants = allocateExpenseAmount(
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
