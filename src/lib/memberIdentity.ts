import { TripMember } from '../types';

export function normalizeMemberEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isGuestMemberEmail(email: string): boolean {
  return normalizeMemberEmail(email).endsWith('@whopaid.guest');
}

export function hasMemberWithEmail(members: TripMember[], email: string): boolean {
  const normalizedEmail = normalizeMemberEmail(email);
  return normalizedEmail.length > 0 && members.some(
    member => normalizeMemberEmail(member.email) === normalizedEmail
  );
}

export function uniqueInvitedEmails(emails: string[], ownerEmail: string): string[] {
  const ownerNormalizedEmail = normalizeMemberEmail(ownerEmail);
  const seen = new Set<string>(ownerNormalizedEmail ? [ownerNormalizedEmail] : []);

  return emails.reduce<string[]>((unique, email) => {
    const cleanEmail = email.trim();
    const normalizedEmail = normalizeMemberEmail(cleanEmail);
    if (!normalizedEmail || seen.has(normalizedEmail)) return unique;

    seen.add(normalizedEmail);
    unique.push(cleanEmail);
    return unique;
  }, []);
}

export function consolidateTripMembers(members: TripMember[]): TripMember[] {
  const groups = new Map<string, TripMember[]>();
  const realEmailKeysByName = new Map<string, Set<string>>();

  for (const member of members) {
    const normalizedEmail = normalizeMemberEmail(member.email);
    if (!normalizedEmail || isGuestMemberEmail(normalizedEmail)) continue;
    const normalizedName = member.name.trim().toLowerCase();
    if (!normalizedName) continue;
    const keys = realEmailKeysByName.get(normalizedName) || new Set<string>();
    keys.add(`email:${normalizedEmail}`);
    realEmailKeysByName.set(normalizedName, keys);
  }

  for (const member of members) {
    const normalizedEmail = normalizeMemberEmail(member.email);
    const normalizedName = member.name.trim().toLowerCase();
    const realNameMatches = realEmailKeysByName.get(normalizedName);
    const claimedGuestKey = isGuestMemberEmail(normalizedEmail) && realNameMatches?.size === 1
      ? [...realNameMatches][0]
      : null;
    const identityKey = claimedGuestKey || (normalizedEmail ? `email:${normalizedEmail}` : `user:${member.userId}`);
    groups.set(identityKey, [...(groups.get(identityKey) || []), member]);
  }

  return [...groups.values()].map(group => {
    const ordered = [...group].sort((left, right) => {
      if (left.role !== right.role) return left.role === 'owner' ? -1 : 1;
      if (isGuestMemberEmail(left.email) !== isGuestMemberEmail(right.email)) {
        return isGuestMemberEmail(left.email) ? 1 : -1;
      }
      const joinedDifference = left.joinedAt.localeCompare(right.joinedAt);
      return joinedDifference || left.id.localeCompare(right.id);
    });
    const canonical = ordered[0];
    const authenticated = ordered.find(member => member.authUid);
    const aliases = [...new Set(ordered.flatMap(member => [
      ...(member.legacyUserIds || []),
      member.userId
    ]).filter(userId => userId && userId !== canonical.userId))];

    return {
      ...canonical,
      authUid: canonical.authUid || authenticated?.authUid,
      name: authenticated?.name || canonical.name,
      role: ordered.some(member => member.role === 'owner') ? 'owner' : 'member',
      isActive: ordered.some(member => member.isActive),
      legacyUserIds: aliases.length > 0 ? aliases : canonical.legacyUserIds
    };
  });
}
