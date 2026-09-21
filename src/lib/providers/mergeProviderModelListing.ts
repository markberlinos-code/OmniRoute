/**
 * Pure merge of registry / synced / custom model rows for the provider detail
 * dashboard (and thus Test All targets). Cursor exclusive listing prefers the
 * live synced catalog when non-empty.
 */

import { providerUsesAuthoritativeLiveCatalog } from "@omniroute/open-sse/config/providerRegistry";
import { getRegisteredProviderEffortBaseModelId } from "@omniroute/open-sse/utils/registeredEffortVariants";
import { ensureCursorAutoCatalogEntry } from "@/lib/providerModels/cursorAutoCatalog";
import { mergeModelsWithCustomPrecedence } from "@/lib/providers/modelMetadataPrecedence";
import {
  providerUsesCuratedModelsOnly,
  providerUsesExclusiveSyncedListing,
} from "@/lib/providers/modelListingCapability";

export type ProviderListingModel = {
  id: string;
  name?: string;
  source?: string;
  [key: string]: unknown;
};

export type MergeProviderModelListingInput = {
  providerId: string;
  registryModels: Array<{ id: string; name?: string }>;
  syncedModels: Array<{ id: string; name?: string; [key: string]: unknown }>;
  customModels: Array<{ id: string; name?: string; source?: string; [key: string]: unknown }>;
  usesCuratedModelsOnly?: boolean;
};

function normalizeCustomSource(source: unknown): "imported" | "custom" {
  return source === "imported" ? "imported" : "custom";
}

function dedupeById(models: ProviderListingModel[]): ProviderListingModel[] {
  const deduped = new Map<string, ProviderListingModel>();
  for (const m of models) {
    if (m.id && !deduped.has(m.id)) deduped.set(m.id, m);
  }
  return Array.from(deduped.values());
}

export function mergeProviderModelListing(
  input: MergeProviderModelListingInput
): ProviderListingModel[] {
  const curated =
    input.usesCuratedModelsOnly === true || providerUsesCuratedModelsOnly(input.providerId);
  const synced = curated ? [] : input.syncedModels.filter((m) => m?.id);
  const custom = curated ? [] : input.customModels.filter((m) => m?.id);

  const exclusive = providerUsesExclusiveSyncedListing(input.providerId) && synced.length > 0;

  if (exclusive) {
    const withAuto = ensureCursorAutoCatalogEntry(
      synced.map((model) => ({
        ...model,
        id: model.id,
        name: model.name || model.id,
        owned_by: "cursor",
        source: "imported",
      }))
    );
    const normalizedCustom = custom.map((model) => ({
      ...model,
      id: model.id,
      name: model.name || model.id,
      source: normalizeCustomSource(model.source),
    }));
    return dedupeById(mergeModelsWithCustomPrecedence(withAuto, normalizedCustom));
  }

  // Mirror the runtime gate in `src/sse/services/model.ts::lookupModelMeta`: when the
  // provider's live catalog is authoritative and a non-empty synced catalog exists, a
  // built-in model absent from it is rejected at request time ("not available in the
  // active live catalog"). Listing it here made the dashboard show (and Test All run)
  // a model that can never succeed. The row stays listed (registry-first merge is an
  // upstream contract) but is flagged `liveCatalogMissing` so the UI can warn.
  // Custom rows stay explicit operator overrides.
  const enforceLiveCatalog =
    synced.length > 0 && providerUsesAuthoritativeLiveCatalog(input.providerId);
  const syncedIds = new Set(synced.map((model) => model.id));
  const customIds = new Set(custom.map((model) => model.id));
  const isServedByLiveCatalog = (modelId: string): boolean => {
    if (syncedIds.has(modelId) || customIds.has(modelId)) return true;
    const effortBase = getRegisteredProviderEffortBaseModelId(input.providerId, modelId);
    return effortBase !== null && syncedIds.has(effortBase);
  };

  const builtInModels = input.registryModels.map((model) => ({
    ...model,
    source: "system",
    ...(enforceLiveCatalog && !isServedByLiveCatalog(model.id) ? { liveCatalogMissing: true } : {}),
  }));
  const registryIds = new Set(builtInModels.map((model) => model.id));
  const syncedExtras = synced
    .filter((model) => model.id && !registryIds.has(model.id))
    .map((model) => ({
      ...model,
      id: model.id,
      name: model.name || model.id,
      source: "imported",
    }));
  const normalizedCustom = custom.map((model) => ({
    ...model,
    id: model.id,
    name: model.name || model.id,
    source: normalizeCustomSource(model.source),
  }));

  return dedupeById(
    mergeModelsWithCustomPrecedence([...builtInModels, ...syncedExtras], normalizedCustom)
  );
}
