import { Text, View } from 'react-native';

import type { AuthProfile } from '@/types/auth';

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="border-b border-neutral-100 py-2 dark:border-neutral-800">
      <Text className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</Text>
      <Text className="mt-0.5 text-sm text-neutral-900 dark:text-white">
        {value && String(value).trim() ? String(value) : '—'}
      </Text>
    </View>
  );
}

interface ProfileCardProps {
  profile: AuthProfile | undefined;
  facilityReportingReady: boolean;
}

export function ProfileCard({ profile, facilityReportingReady }: ProfileCardProps) {
  if (!profile) {
    return (
      <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="text-sm text-neutral-500">Loading profile…</Text>
      </View>
    );
  }

  const cities =
    (profile.cities && profile.cities.length > 0
      ? profile.cities.join(', ')
      : profile.city) || null;
  const facilities =
    (profile.facility_names && profile.facility_names.length > 0
      ? profile.facility_names.join(', ')
      : profile.facility_name) || null;

  return (
    <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
        My registration
      </Text>
      <Row label="Name" value={profile.name} />
      <Row label="Email" value={profile.email} />
      <Row label="Phone" value={profile.phone_number} />
      <Row label="WhatsApp" value={profile.whatsapp_number} />
      <Row label="Role" value={profile.contact_type} />
      <Row label="Cities" value={cities} />
      <Row label="Facilities" value={facilities} />
      <Row
        label="Channels"
        value={(profile.preferred_channels || []).join(', ') || null}
      />
      <Row
        label="Topics"
        value={(profile.environmental_topics || []).join(', ') || null}
      />
      <Row label="Verification" value={profile.verification_status} />
      <Row label="Approval" value={profile.approval_status} />
      <Row
        label="Facility reporting"
        value={
          facilityReportingReady || profile.facility_reporting_ready
            ? 'Ready'
            : 'Not ready'
        }
      />
    </View>
  );
}
