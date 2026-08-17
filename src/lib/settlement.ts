import { RecommendedTransfer, ParticipantBalance, HouseholdBalance, CurrencyCode } from '../types';
import { roundMoney, sub } from './decimal';

interface SettlementNode {
  id: string; // userId or householdId
  name: string;
  isHousehold: boolean;
  householdName?: string;
  net: number; // positive = creditor, negative = debtor
}

export function calculateOptimizedSettlements(
  individualBalances: ParticipantBalance[],
  householdBalances: HouseholdBalance[] = [],
  currency: CurrencyCode = 'EUR',
  useHouseholds: boolean = true
): RecommendedTransfer[] {
  const nodes: SettlementNode[] = [];

  if (useHouseholds && householdBalances.length > 0) {
    const householdUserIds = new Set<string>();

    // Add households as aggregate nodes
    for (const hh of householdBalances) {
      hh.memberUserIds.forEach(id => householdUserIds.add(id));
      if (Math.abs(hh.net) > 0.01) {
        nodes.push({
          id: hh.householdId,
          name: hh.name,
          isHousehold: true,
          householdName: hh.name,
          net: hh.net
        });
      }
    }

    // Add remaining independent individuals
    for (const ib of individualBalances) {
      if (!householdUserIds.has(ib.userId) && Math.abs(ib.net) > 0.01) {
        nodes.push({
          id: ib.userId,
          name: ib.name,
          isHousehold: false,
          net: ib.net
        });
      }
    }
  } else {
    // Individual-only settlement
    for (const ib of individualBalances) {
      if (Math.abs(ib.net) > 0.01) {
        nodes.push({
          id: ib.userId,
          name: ib.name,
          isHousehold: false,
          householdName: ib.householdName,
          net: ib.net
        });
      }
    }
  }

  // Debtors (net < 0) and Creditors (net > 0)
  const debtors = nodes
    .filter(n => n.net < -0.009)
    .map(d => ({ ...d, remainingDebt: Math.abs(d.net) }))
    .sort((a, b) => b.remainingDebt - a.remainingDebt);

  const creditors = nodes
    .filter(n => n.net > 0.009)
    .map(c => ({ ...c, remainingCredit: c.net }))
    .sort((a, b) => b.remainingCredit - a.remainingCredit);

  const transfers: RecommendedTransfer[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const amountToSettle = roundMoney(
      Math.min(debtor.remainingDebt, creditor.remainingCredit),
      2
    );

    if (amountToSettle > 0.009) {
      transfers.push({
        debtorId: debtor.id,
        debtorName: debtor.name,
        debtorHouseholdName: debtor.householdName,
        creditorId: creditor.id,
        creditorName: creditor.name,
        creditorHouseholdName: creditor.householdName,
        amount: amountToSettle,
        currency
      });

      debtor.remainingDebt = roundMoney(sub(debtor.remainingDebt, amountToSettle), 2);
      creditor.remainingCredit = roundMoney(sub(creditor.remainingCredit, amountToSettle), 2);
    }

    if (debtor.remainingDebt <= 0.009) {
      dIdx++;
    }
    if (creditor.remainingCredit <= 0.009) {
      cIdx++;
    }
  }

  return transfers;
}
