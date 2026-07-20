/** Shape returned by `external_integrations.integration_provenance_for_source()`. */
export interface ProvenanceInfo {
  confidence: {
    score: number;
    tier: string;
    basis: string;
  };
  deployment_role: string;
  a2a: {
    usable_as_primary_measurement: boolean;
    recommended_use: string;
  };
}
