import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Banner, AuthTextField, PrimaryButton } from '@/features/auth/FormFields';
import { AccountSectionAccent, FeatureSection } from '@/components/FeatureSection';
import { useMyActionLogs } from '@/hooks/useAuth';
import { createActionLog } from '@/services/api/actionLog';
import { patchPreferences } from '@/services/api/auth';
import { toApiError } from '@/services/api/client';
import { useAuthStore } from '@/store/authStore';
import { formatRelativeTimestamp } from '@/utils/format';
import { toastError, toastSuccess } from '@/utils/toast';
import type { AuthProfile } from '@/types/auth';

const PREPAREDNESS_ACTIONS = [
  {
    type: 'stocked_oxygen',
    label: 'Stocked O₂',
    details: '✓ Stocked O₂ cylinders',
  },
  {
    type: 'staff_called',
    label: 'Staff called',
    details: '✓ Pediatric staff briefed',
  },
  {
    type: 'protocol_reviewed',
    label: 'Protocol reviewed',
    details: '✓ Rapid triage protocol reviewed',
  },
] as const;

function siteLabels(profile: AuthProfile | undefined): string[] {
  if (!profile) return [];
  if (profile.facility_names && profile.facility_names.length > 0) {
    return profile.facility_names.map((s) => String(s).trim()).filter(Boolean);
  }
  if (profile.facility_name?.trim()) return [profile.facility_name.trim()];
  return [];
}

interface FacilityActionsPanelProps {
  profile: AuthProfile | undefined;
}

export function FacilityActionsPanel({ profile }: FacilityActionsPanelProps) {
  const queryClient = useQueryClient();
  const facilityReportingReady = useAuthStore((s) => s.facilityReportingReady);
  const setFacilityReportingReady = useAuthStore((s) => s.setFacilityReportingReady);
  const ready = Boolean(facilityReportingReady || profile?.facility_reporting_ready);

  const sites = useMemo(() => siteLabels(profile), [profile]);
  const [newSite, setNewSite] = useState('');
  const [thresholds, setThresholds] = useState<Record<string, string>>({});

  const actionLogs = useMyActionLogs(ready);

  useEffect(() => {
    if (profile?.facility_reporting_ready != null) {
      setFacilityReportingReady(Boolean(profile.facility_reporting_ready));
    }
  }, [profile?.facility_reporting_ready, setFacilityReportingReady]);

  useEffect(() => {
    const next: Record<string, string> = {};
    const saved = profile?.facility_site_pm25_thresholds || {};
    for (const site of sites) {
      const v = saved[site];
      next[site] = v != null ? String(v) : '55';
    }
    setThresholds(next);
  }, [sites, profile?.facility_site_pm25_thresholds]);

  const addSiteMutation = useMutation({
    mutationFn: (name: string) => patchPreferences({ add_facility_name: name }),
    onSuccess: async (data) => {
      toastSuccess(data.message || 'Facility added.');
      setNewSite('');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] });
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  const saveThresholdsMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, number> = {};
      for (const site of sites) {
        const raw = thresholds[site]?.trim() ?? '';
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 5 || n > 600) {
          throw new Error(`PM2.5 for "${site}" must be between 5 and 600.`);
        }
        payload[site] = n;
      }
      return patchPreferences({ facility_site_pm25_thresholds: payload });
    },
    onSuccess: async (data) => {
      toastSuccess(data.message || 'Thresholds saved.');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] });
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  const actionMutation = useMutation({
    mutationFn: createActionLog,
    onSuccess: async (data) => {
      toastSuccess(`Logged for ${data.facility_site || data.facility_id}.`);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'action-log'] });
    },
    onError: (error) => toastError(toApiError(error).message),
  });

  const statusBanner = !ready
    ? 'Signed in — reporting may stay locked until an operator approves and links your facility.'
    : `Reporting ready${profile?.facility_name ? ` as ${profile.facility_name}` : ''}. Authenticated — log actions per facility below.`;

  return (
    <View className="gap-3">
      <Banner message={statusBanner} tone={ready ? 'success' : 'info'} />
      {!ready ? (
        <Banner
          message="Action logging requires a verified, approved account with a linked facility."
          tone="info"
        />
      ) : null}

      <FeatureSection accent={AccountSectionAccent.sites}>
        <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Facilities and sites
        </Text>
        <Text className="mb-2 text-lg font-extrabold text-ink">Sites you cover</Text>
        <Text className="mb-3 text-xs leading-4 text-muted">
          Add a facility or site, set a PM2.5 alert threshold, then log preparedness
          actions for that site.
        </Text>

        <AuthTextField
          label="Facility or site name"
          value={newSite}
          onChangeText={setNewSite}
          placeholder="Add a facility or site"
          autoCapitalize="words"
        />
        <PrimaryButton
          label={addSiteMutation.isPending ? 'Adding…' : 'Add facility'}
          disabled={addSiteMutation.isPending || !newSite.trim()}
          onPress={() => addSiteMutation.mutate(newSite.trim())}
        />

        {sites.length === 0 ? (
          <Text className="mt-3 text-sm text-muted">
            Add a facility before logging preparedness actions.
          </Text>
        ) : (
          <View className="mt-4 gap-3">
            {sites.map((site) => (
              <View
                key={site}
                className="rounded-xl border border-border p-3"
                style={{ opacity: ready ? 1 : 0.55 }}>
                <Text className="mb-2 text-sm font-extrabold text-ink">{site}</Text>
                <Text className="mb-1 text-xs font-medium text-muted">
                  PM2.5 threshold (µg/m³)
                </Text>
                <TextInput
                  className="mb-3 rounded-lg border border-border bg-white px-3 py-2 text-base text-ink"
                  keyboardType="number-pad"
                  editable={ready}
                  value={thresholds[site] ?? ''}
                  onChangeText={(text) =>
                    setThresholds((prev) => ({
                      ...prev,
                      [site]: text,
                    }))
                  }
                />
              </View>
            ))}

            <PrimaryButton
              label={saveThresholdsMutation.isPending ? 'Saving…' : 'Save thresholds'}
              disabled={!ready || saveThresholdsMutation.isPending || sites.length === 0}
              onPress={() => saveThresholdsMutation.mutate()}
            />
          </View>
        )}
      </FeatureSection>

      <FeatureSection accent={AccountSectionAccent.actionLog}>
        <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Operational readiness
        </Text>
        <Text className="mb-2 text-lg font-extrabold text-ink">
          Preparedness actions
        </Text>
        <Text className="mb-3 text-xs leading-4 text-muted">
          Log a completed action against the correct facility. Each entry is kept in
          the server audit trail.
        </Text>
        {sites.length === 0 ? (
          <Text className="text-sm text-muted">
            Add a facility before logging preparedness actions.
          </Text>
        ) : (
          <View className="gap-3">
            {sites.map((site) => (
              <View
                key={`actions-${site}`}
                className="rounded-xl border border-border p-3"
                style={{ opacity: ready ? 1 : 0.55 }}>
                <Text className="mb-2 text-sm font-extrabold text-ink">{site}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {PREPAREDNESS_ACTIONS.map((action) => (
                    <View key={action.type} className="min-w-[30%] flex-1">
                      <PrimaryButton
                        label={action.label}
                        variant="secondary"
                        disabled={!ready || actionMutation.isPending}
                        onPress={() =>
                          actionMutation.mutate({
                            action_type: action.type,
                            details: action.details,
                            facility_site: site,
                          })
                        }
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </FeatureSection>

      {ready ? (
        <FeatureSection accent={AccountSectionAccent.actionLog}>
          <Text className="mb-2 text-sm font-semibold text-ink">
            Recent facility actions
          </Text>
          {actionLogs.isLoading ? (
            <Text className="text-sm text-neutral-500">Loading…</Text>
          ) : !actionLogs.data?.entries?.length ? (
            <Text className="text-sm text-neutral-500">No actions logged yet.</Text>
          ) : (
            actionLogs.data.entries.slice(0, 8).map((entry, index) => (
              <View
                key={entry._id ?? `${entry.timestamp}-${index}`}
                className="border-b border-neutral-100 py-2 dark:border-neutral-800">
                <Text className="text-sm font-medium text-neutral-900 dark:text-white">
                  {entry.action_type}
                  {entry.facility_site ? ` · ${entry.facility_site}` : ''}
                </Text>
                <Text className="text-xs text-neutral-500">
                  {formatRelativeTimestamp(entry.timestamp)}
                  {entry.details ? ` — ${entry.details}` : ''}
                </Text>
              </View>
            ))
          )}
        </FeatureSection>
      ) : null}
    </View>
  );
}
