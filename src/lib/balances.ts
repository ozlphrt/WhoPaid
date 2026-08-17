import { Expense, TripMember, Household, Settlement, ParticipantBalance, HouseholdBalance } from '../types';
import { add, sub, mul, div, roundMoney } from './decimal';

export function calculateParticipantBalances(
  members: TripMember[],
  expenses: Expense[],
  settlements: Settlement[],
  households: Household[] = []
): {
  individualBalances: ParticipantBalance[];
  householdBalances: HouseholdBalance[];
  totalSpend: number;
} {
  // Map of userId -> { paid: Decimal, share: Decimal }
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
        // Payer share in mainCurrency = (p.amount / exp.originalAmount) * exp.convertedAmount
        const payerFraction = exp.originalAmount > 0 ? div(p.amount, exp.originalAmount) : 0;
        const payerConverted = roundMoney(mul(payerFraction, exp.convertedAmount), 2);
        
        const curPaid = paidMap.get(p.userId) || 0;
        paidMap.set(p.userId, add(curPaid, payerConverted));
      }
    } else {
      // Fallback single payer
      const curPaid = paidMap.get(exp.paidByUserId) || 0;
      paidMap.set(exp.paidByUserId, add(curPaid, exp.convertedAmount));
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

        const curShare = shareMap.get(part.userId) || 0;
        shareMap.set(part.userId, add(curShare, partConverted));
      }
    }
  }

  // 3. Process Confirmed Settlements
  // When Debtor pays Creditor Amount in settlement:
  // - Debtor's "paid" increases by settlement converted amount (they put money in)
  // - Creditor's "share" increases by settlement converted amount (they received their payback)
  for (const s of settlements) {
    if (s.status === 'completed') {
      const debtorPaid = paidMap.get(s.debtorId) || 0;
      paidMap.set(s.debtorId, add(debtorPaid, s.convertedAmount));

      const creditorShare = shareMap.get(s.creditorId) || 0;
      shareMap.set(s.creditorId, add(creditorShare, s.convertedAmount));
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
