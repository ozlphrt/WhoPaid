import { Expense, TripMember, Household, Settlement, ParticipantBalance, HouseholdBalance, User } from '../types';
import { add, sub, mul, div, roundMoney } from './decimal';
import { consolidateTripMembers } from './memberIdentity';

export function resolveCurrentMemberUserId(
  user: Pick<User, 'id' | 'email' | 'name'>,
  members: TripMember[]
): string {
  const exact = members.find(member =>
    member.userId === user.id || member.authUid === user.id
  );
  if (exact) return exact.userId;

  if (user.email) {
    const normalizedEmail = user.email.trim().toLowerCase();
    const emailMatches = members.filter(member =>
      member.email?.trim().toLowerCase() === normalizedEmail
    );
    if (emailMatches.length === 1) return emailMatches[0].userId;
  }

  if (user.name) {
    const normalizedName = user.name.trim().toLowerCase();
    const nameMatches = members.filter(member =>
      member.name?.trim().toLowerCase() === normalizedName
    );
    if (nameMatches.length === 1) return nameMatches[0].userId;
  }

  return user.id;
}

export function resolveMemberUserId(
  rawId: string | undefined | null,
  members: TripMember[],
  allUsers: Array<{ id: string; name: string; email?: string }> = []
): string {
  if (!rawId || members.length === 0) return rawId || '';

  // 1. Direct match by userId
  const byUserId = members.find(m => m.userId === rawId);
  if (byUserId) return byUserId.userId;

  // 2. Direct match by member id
  const byId = members.find(m => m.id === rawId);
  if (byId) return byId.userId;

  // 3. Exact legacy alias created when an invited placeholder is claimed.
  const byLegacyId = members.find(m => m.legacyUserIds?.includes(rawId));
  if (byLegacyId) return byLegacyId.userId;

  // 4. Email match
  const byEmail = members.find(m => m.email && m.email.toLowerCase() === rawId.toLowerCase());
  if (byEmail) return byEmail.userId;

  // 5. Name match (case-insensitive)
  const byName = members.filter(m => m.name && m.name.toLowerCase() === rawId.toLowerCase());
  if (byName.length === 1) return byName[0].userId;

  // 6. Look up in allUsers (e.g. rawId is an Auth user ID, then match the member by name)
  if (allUsers && allUsers.length > 0) {
    const matchedUser = allUsers.find(u => u.id === rawId || (u.email && u.email.toLowerCase() === rawId.toLowerCase()));
    if (matchedUser) {
      const memByEmail = matchedUser.email
        ? members.find(m => m.email?.toLowerCase() === matchedUser.email?.toLowerCase())
        : undefined;
      if (memByEmail) return memByEmail.userId;

      const memByName = matchedUser.name
        ? members.filter(m => m.name.toLowerCase() === matchedUser.name.toLowerCase())
        : [];
      if (memByName.length === 1) return memByName[0].userId;
    }
  }

  return rawId;
}

export function calculateParticipantBalances(
  members: TripMember[],
  expenses: Expense[],
  settlements: Settlement[],
  households: Household[] = [],
  allUsers: Array<{ id: string; name: string; email?: string }> = []
): {
  individualBalances: ParticipantBalance[];
  householdBalances: HouseholdBalance[];
  totalSpend: number;
} {
  members = consolidateTripMembers(members);

  // Map of canonical userId -> { paid: Decimal, share: Decimal }
  const paidMap = new Map<string, number>();
  const shareMap = new Map<string, number>();

  members.forEach(m => {
    paidMap.set(m.userId, 0);
    shareMap.set(m.userId, 0);
  });

  let totalTripSpend = 0;

  // Process all active expenses
  for (const exp of expenses) {
    if (exp.isDeleted) continue;

    totalTripSpend = add(totalTripSpend, exp.convertedAmount);

    // 1. Process Payers
    if (exp.payers && exp.payers.length > 0) {
      for (const p of exp.payers) {
        const payerFraction = exp.originalAmount > 0 ? div(p.amount, exp.originalAmount) : 0;
        const payerConverted = roundMoney(mul(payerFraction, exp.convertedAmount), 2);
        
        const canonicalPayerId = resolveMemberUserId(p.userId, members, allUsers);
        const curPaid = paidMap.get(canonicalPayerId) || 0;
        paidMap.set(canonicalPayerId, add(curPaid, payerConverted));
      }
    } else {
      // Fallback single payer
      const canonicalPayerId = resolveMemberUserId(exp.paidByUserId, members, allUsers);
      const curPaid = paidMap.get(canonicalPayerId) || 0;
      paidMap.set(canonicalPayerId, add(curPaid, exp.convertedAmount));
    }

    // 2. Process Participants / Consumption shares
    if (exp.participants && exp.participants.length > 0) {
      for (const part of exp.participants) {
        let partConverted = 0;
        if (exp.splitMode === 'custom' && exp.originalAmount > 0) {
          const shareFraction = div(part.amount, exp.originalAmount);
          partConverted = roundMoney(mul(shareFraction, exp.convertedAmount), 2);
        } else {
          // Equal split: convertedAmount / participants.length
          partConverted = roundMoney(div(exp.convertedAmount, exp.participants.length), 2);
        }

        const canonicalPartId = resolveMemberUserId(part.userId, members, allUsers);
        const curShare = shareMap.get(canonicalPartId) || 0;
        shareMap.set(canonicalPartId, add(curShare, partConverted));
      }
    } else if (members.length > 0) {
      // Fallback if participants array was empty: split equally among all members
      const equalShare = roundMoney(div(exp.convertedAmount, members.length), 2);
      for (const m of members) {
        const curShare = shareMap.get(m.userId) || 0;
        shareMap.set(m.userId, add(curShare, equalShare));
      }
    }
  }

  // 3. Process Confirmed Settlements
  for (const s of settlements) {
    if (s.status === 'completed') {
      const canonicalDebtorId = resolveMemberUserId(s.debtorId, members, allUsers);
      const debtorPaid = paidMap.get(canonicalDebtorId) || 0;
      paidMap.set(canonicalDebtorId, add(debtorPaid, s.convertedAmount));

      const canonicalCreditorId = resolveMemberUserId(s.creditorId, members, allUsers);
      const creditorShare = shareMap.get(canonicalCreditorId) || 0;
      shareMap.set(canonicalCreditorId, add(creditorShare, s.convertedAmount));
    }
  }

  // Build individual balances
  const individualBalances: ParticipantBalance[] = members.map(m => {
    const paid = roundMoney(paidMap.get(m.userId) || 0, 2);
    const share = roundMoney(shareMap.get(m.userId) || 0, 2);
    const net = roundMoney(sub(paid, share), 2);

    const hh = households.find(h => h.memberUserIds.includes(m.userId));

    return {
      userId: m.userId,
      name: m.name,
      householdId: hh?.id,
      householdName: hh?.name,
      paid,
      share,
      net
    };
  });

  // Build household balances
  const householdBalances: HouseholdBalance[] = households.map(hh => {
    let hhPaid = 0;
    let hhShare = 0;

    for (const uId of hh.memberUserIds) {
      const b = individualBalances.find(ib => ib.userId === uId);
      if (b) {
        hhPaid = add(hhPaid, b.paid);
        hhShare = add(hhShare, b.share);
      }
    }

    const hhNet = roundMoney(sub(hhPaid, hhShare), 2);

    return {
      householdId: hh.id,
      name: hh.name,
      memberUserIds: hh.memberUserIds,
      paid: roundMoney(hhPaid, 2),
      share: roundMoney(hhShare, 2),
      net: hhNet
    };
  });

  return {
    individualBalances,
    householdBalances,
    totalSpend: roundMoney(totalTripSpend, 2)
  };
}

/**
 * Calculates trip balances converted to a specific target currency.
 * If targetCurrency is the trip's main currency, the standard balances are returned.
 * Otherwise, expenses originally entered in targetCurrency retain their exact
 * original values, and other expenses/settlements are converted via the recorded exchange rate.
 */
export function getBalancesForCurrency(
  targetCurrency: string,
  mainCurrency: string,
  members: TripMember[],
  expenses: Expense[],
  settlements: Settlement[] = [],
  households: Household[] = [],
  allUsers: Array<{ id: string; name: string; email?: string }> = []
): {
  individualBalances: ParticipantBalance[];
  householdBalances: HouseholdBalance[];
  totalSpend: number;
} {
  if (targetCurrency === mainCurrency) {
    return calculateParticipantBalances(members, expenses, settlements, households, allUsers);
  }

  // Find the exchange rate between targetCurrency and mainCurrency:
  // 1 targetCurrency = targetRate mainCurrency.
  const targetExp = [...expenses]
    .reverse()
    .find(e => !e.isDeleted && e.originalCurrency === targetCurrency && Number.isFinite(e.exchangeRate) && e.exchangeRate > 0);
  const targetRate = targetExp?.exchangeRate && targetExp.exchangeRate > 0 ? targetExp.exchangeRate : 1;

  // Map expenses to targetCurrency
  const mappedExpenses: Expense[] = expenses.map(exp => {
    if (exp.isDeleted) return exp;

    // If expense was originally in targetCurrency, preserve exact original amounts!
    if (exp.originalCurrency === targetCurrency) {
      return {
        ...exp,
        convertedAmount: exp.originalAmount,
        payers: exp.payers ? exp.payers.map(p => ({ ...p })) : [{ userId: exp.paidByUserId, amount: exp.originalAmount }],
        participants: exp.participants ? exp.participants.map(p => ({ ...p })) : []
      };
    }

    // Otherwise, convert from mainCurrency to targetCurrency (convertedAmount in main / targetRate)
    const convertedInTarget = roundMoney(div(exp.convertedAmount, targetRate), 2);
    const origAmount = exp.originalAmount || 0;

    const mappedPayers = exp.payers
      ? exp.payers.map(p => {
          const fraction = origAmount > 0 ? div(p.amount, origAmount) : 0;
          return {
            ...p,
            amount: roundMoney(mul(fraction, convertedInTarget), 2)
          };
        })
      : [{ userId: exp.paidByUserId, amount: convertedInTarget }];

    const mappedParticipants = exp.participants
      ? exp.participants.map(part => {
          if (exp.splitMode === 'custom') {
            const fraction = origAmount > 0 ? div(part.amount, origAmount) : 0;
            return {
              ...part,
              amount: roundMoney(mul(fraction, convertedInTarget), 2)
            };
          }
          return { ...part };
        })
      : [];

    return {
      ...exp,
      convertedAmount: convertedInTarget,
      payers: mappedPayers,
      participants: mappedParticipants
    };
  });

  // Map settlements to targetCurrency
  const mappedSettlements: Settlement[] = settlements.map(s => {
    if (s.currency === targetCurrency) {
      return {
        ...s,
        convertedAmount: s.amount
      };
    }
    return {
      ...s,
      convertedAmount: roundMoney(div(s.convertedAmount, targetRate), 2)
    };
  });

  return calculateParticipantBalances(members, mappedExpenses, mappedSettlements, households, allUsers);
}

