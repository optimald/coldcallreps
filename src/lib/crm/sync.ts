import type { Prospect } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  HUBSPOT_PROVIDER,
  pullHubspotContacts,
  pushProspectToHubspot,
} from '@/lib/crm/hubspot';

const CRM_PROVIDERS = [HUBSPOT_PROVIDER] as const;

/** Push a prospect to all connected external CRM adapters for this user. */
export async function pushProspectToConnectedCrms(
  userId: string,
  prospect: Prospect
): Promise<{ provider: string; externalId: string }[]> {
  const connections = await prisma.crmConnection.findMany({
    where: {
      userId,
      status: 'connected',
      provider: { in: [...CRM_PROVIDERS] },
    },
  });

  const out: { provider: string; externalId: string }[] = [];
  for (const conn of connections) {
    if (conn.provider === HUBSPOT_PROVIDER) {
      const { externalId } = await pushProspectToHubspot(conn, prospect);
      out.push({ provider: HUBSPOT_PROVIDER, externalId });
    }
  }
  return out;
}

/** Pull updates from connected CRMs into mapped ColdCallReps prospects. */
export async function pullConnectedCrms(userId: string) {
  const connections = await prisma.crmConnection.findMany({
    where: {
      userId,
      status: 'connected',
      provider: { in: [...CRM_PROVIDERS] },
    },
  });

  const results = [];
  for (const conn of connections) {
    if (conn.provider === HUBSPOT_PROVIDER) {
      results.push({
        provider: HUBSPOT_PROVIDER,
        ...(await pullHubspotContacts(conn)),
      });
    }
  }
  return results;
}
