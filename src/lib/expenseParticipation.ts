import type { Expense, ExpenseParticipant, TripMember } from '../types';
import { add, div, mul, roundMoney, sub } from './decimal';
import { consolidateTripMembers } from './memberIdentity';
import { resolveMemberUserId } from './balances';

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

export interface MemberExclusionSummary {
  member: TripMember;
  excludedExpenses: Expense[];
  totalExcludedSpend: number;
}

export interface ExpenseExclusionSummary {
  expense: Expense;
  excludedMembers: TripMember[];
  participatingMembers: TripMember[];
}

export interface TripExclusionsResult {
  byMember: MemberExclusionSummary[];
  byExpense: ExpenseExclusionSummary[];
  totalExclusionsCount: number;
  expensesWithExclusionsCount: number;
  membersWithExclusionsCount: number;
}

/**
 * Computes which trip members are excluded (not participating) in active expenses.
 * An active member is excluded if they are not part of expense.participants or have 0 share in a custom split.
 */
export function getExpenseExclusions(
  members: TripMember[],
  expenses: Expense[],
  allUsers: Array<{ id: string; name: string; email?: string }> = []
): TripExclusionsResult {
  const consolidated = consolidateTripMembers(members).filter(m => m.isActive !== false);
  const activeExpenses = expenses.filter(e => !e.isDeleted);

  if (consolidated.length === 0 || activeExpenses.length === 0) {
    return {
      byMember: [],
      byExpense: [],
      totalExclusionsCount: 0,
      expensesWithExclusionsCount: 0,
      membersWithExclusionsCount: 0
    };
  }

  const memberMap = new Map<string, TripMember>();
  consolidated.forEach(m => memberMap.set(m.userId, m));

  const memberExclusionsMap = new Map<string, { member: TripMember; excludedExpenses: Expense[]; totalExcludedSpend: number }>();
  consolidated.forEach(m => {
    memberExclusionsMap.set(m.userId, {
      member: m,
      excludedExpenses: [],
      totalExcludedSpend: 0
    });
  });

  const byExpense: ExpenseExclusionSummary[] = [];

  for (const exp of activeExpenses) {
    const participatingCanonicalIds = new Set<string>();

    if (exp.participants && exp.participants.length > 0) {
      for (const p of exp.participants) {
        // In custom split, participant must have a non-zero share to be considered participating
        const isParticipating = exp.splitMode === 'custom' ? (p.amount > 0) : true;
        if (isParticipating) {
          const canonicalId = resolveMemberUserId(p.userId, consolidated, allUsers);
          if (canonicalId && memberMap.has(canonicalId)) {
            participatingCanonicalIds.add(canonicalId);
          }
        }
      }
    } else {
      // If participants array is empty, equal split across all active members is implied (no exclusions)
      consolidated.forEach(m => participatingCanonicalIds.add(m.userId));
    }

    const participatingMembers: TripMember[] = [];
    const excludedMembers: TripMember[] = [];

    for (const m of consolidated) {
      if (participatingCanonicalIds.has(m.userId)) {
        participatingMembers.push(m);
      } else {
        excludedMembers.push(m);
      }
    }

    if (excludedMembers.length > 0) {
      byExpense.push({
        expense: exp,
        excludedMembers,
        participatingMembers
      });

      for (const exMember of excludedMembers) {
        const entry = memberExclusionsMap.get(exMember.userId);
        if (entry) {
          entry.excludedExpenses.push(exp);
          entry.totalExcludedSpend = add(entry.totalExcludedSpend, exp.convertedAmount || 0);
        }
      }
    }
  }

  const byMember: MemberExclusionSummary[] = [...memberExclusionsMap.values()]
    .filter(entry => entry.excludedExpenses.length > 0)
    .sort((a, b) => b.excludedExpenses.length - a.excludedExpenses.length || a.member.name.localeCompare(b.member.name));

  let totalExclusionsCount = 0;
  for (const item of byExpense) {
    totalExclusionsCount += item.excludedMembers.length;
  }

  return {
    byMember,
    byExpense,
    totalExclusionsCount,
    expensesWithExclusionsCount: byExpense.length,
    membersWithExclusionsCount: byMember.length
  };
}

