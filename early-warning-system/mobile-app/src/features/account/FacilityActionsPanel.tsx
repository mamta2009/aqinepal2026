import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Banner, AuthTextField, PrimaryButton } from '@/features/auth/FormFields';
import { useMyActionLogs } from '@/hooks/useAuth';
import { createActionLog } from '@/services/api/actionLog';
import { patchPreferences } from '@/services/api/auth';
import { toApiError } from '@/services/api/client';
import { useAuthStore } from '@/store/authStore';
import { formatRelativeTimestamp } from '@/utils/format';

import type { AuthProfile } from '@/types/auth';

const PREPAREDNESS_ACTIONS = [
  {
    type: 'stocked_oxygen',
    label: 'Stocked O₂',
    details: '✓ Stocked O₂ cylinders',
  },
  {
    type: 'staff_called',
    label: 'Staff Called',
    details: '✓ Pediatric staff briefed',
  },
  {
    type: 'protocol_reviewed',
    label: 'Protocol OK',
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
  const [banner, setBanner] = useState<{ message: string; tone: 'info' | 'error' | 'success' } | null>(
    null,
  );

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
      setBanner({ message: data.message || 'Facility added.', tone: 'success' });
      setNewSite('');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] });
    },
    onError: (error) => setBanner({ message: toApiError(error).message, tone: 'error' }),
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
      setBanner({ message: data.message || 'Thresholds saved.', tone: 'success' });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'profile'] });
    },
    onError: (error) => setBanner({ message: toApiError(error).message, tone: 'error' }),
  });

  const actionMutation = useMutation({
    mutationFn: createActionLog,
    onSuccess: async (data) => {
      setBanner({
        message: `Logged for ${data.facility_site || data.facility_id}.`,
        tone: 'success',
      });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'action-log'] });
    },
    onError: (error) => setBanner({ message: toApiError(error).message, tone: 'error' }),
  });

  const statusBanner = !ready
    ? 'Signed in — reporting may stay locked until an operator approves and links your facility.'
    : `Reporting ready${profile?.facility_name ? ` as ${profile.facility_name}` : ''}${profile?.facility_id ? ` (${profile.facility_id})` : ''
    }. Authenticated — log actions per facility below.`;

  return (
    <View className="gap-3">
      <Text className="text-lg font-bold text-neutral-900 dark:text-white">Facility Actions</Text>
      <Text className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        Preparedness buttons (O₂, Staff, …) require a verified account that is operator-approved with a
        facility / site linked. Password sign-in can succeed sooner — actions stay disabled until ready.
      </Text>

      <Banner message={statusBanner} tone={ready ? 'success' : 'info'} />
      {banner ? <Banner message={banner.message} tone={banner.tone} /> : null}

      <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <Text className="mb-1 text-sm font-semibold text-neutral-900 dark:text-white">
          Sites you cover
        </Text>
        <Text className="mb-3 text-xs leading-4 text-neutral-500">
          Add each facility or site name (your enrolment), set a PM2.5 alert threshold per site, then log
          preparedness actions for that site.
        </Text>

        <AuthTextField
          label="Add facility / site name"
          value={newSite}
          onChangeText={setNewSite}
          placeholder="e.g. Ward 12 municipal clinic"
          autoCapitalize="words"
        />
        <PrimaryButton
          label={addSiteMutation.isPending ? 'Adding…' : 'Add facility'}
          disabled={addSiteMutation.isPending || !newSite.trim()}
          onPress={() => addSiteMutation.mutate(newSite.trim())}
        />

        {sites.length === 0 ? (
          <Text className="mt-3 text-sm text-neutral-500">No facilities on file yet.</Text>
        ) : (
          <View className="mt-4 gap-3">
            {sites.map((site) => (
              <View
                key={site}
                className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700"
                style={{ opacity: ready ? 1 : 0.55 }}>
                <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
                  {site}
                </Text>
                <Text className="mb-1 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  PM2.5 alert (µg/m³)
                </Text>
                <TextInput
                  className="mb-3 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
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

            <PrimaryButton
              label={saveThresholdsMutation.isPending ? 'Saving…' : 'Save thresholds'}
              disabled={!ready || saveThresholdsMutation.isPending || sites.length === 0}
              onPress={() => saveThresholdsMutation.mutate()}
            />
          </View>
        )}
      </View>

      {ready ? (
        <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
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
        </View>
      ) : null}
    </View>
  );
}
