export type UserNotificationPrefs = {
  emailEnabled?: boolean;
  mutedEvents?: string[];
};

export type BrandNotificationDefaults = {
  acceptMessage?: string;
  rejectMessage?: string;
  replyToEmail?: string;
};

export function parseUserPrefs(raw?: string | null): UserNotificationPrefs {
  try {
    const v = JSON.parse(raw || '{}') as UserNotificationPrefs;
    return {
      emailEnabled: v.emailEnabled !== false,
      mutedEvents: Array.isArray(v.mutedEvents) ? v.mutedEvents.map(String) : [],
    };
  } catch {
    return { emailEnabled: true, mutedEvents: [] };
  }
}

export function parseBrandDefaults(raw?: string | null): BrandNotificationDefaults {
  try {
    const v = JSON.parse(raw || '{}') as BrandNotificationDefaults;
    return {
      acceptMessage: typeof v.acceptMessage === 'string' ? v.acceptMessage : undefined,
      rejectMessage: typeof v.rejectMessage === 'string' ? v.rejectMessage : undefined,
      replyToEmail: typeof v.replyToEmail === 'string' ? v.replyToEmail : undefined,
    };
  } catch {
    return {};
  }
}

export function isEventMuted(prefs: UserNotificationPrefs, eventKey: string) {
  if (prefs.emailEnabled === false) return true;
  return (prefs.mutedEvents || []).includes(eventKey);
}
