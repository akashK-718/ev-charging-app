'use client';

import { ChargerBottomSheet } from '@/components/chargers/ChargerBottomSheet';
import type { ChargerRow } from '@/components/chargers/ChargerCard';
import { ChargerListView } from '@/components/chargers/ChargerListView';
import { FilterSheet } from '@/components/chargers/FilterSheet';
import { FloatingViewToggle } from '@/components/chargers/FloatingViewToggle';
import { ModeToggle } from '@/components/chargers/ModeToggle';
import { RADIUS_STEPS, RadiusSlider } from '@/components/chargers/RadiusSlider';
import { RouteCompactSummary } from '@/components/chargers/RouteCompactSummary';
import { RouteInputs } from '@/components/chargers/RouteInputs';
import { ExploreResultsPanel } from '@/components/explore/ExploreResultsPanel';
import type { ChargerMarkerData } from '@/components/maps/MapView';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { useExploreSearch } from '@/hooks/useExploreSearch';
import { countActiveFilters, filterChargers, resolveConnectors } from '@/lib/explore/filters';
import { haversineKm } from '@/lib/haversine';
import { computeRouteBounds } from '@/lib/maps/geometry';
import { cn } from '@/lib/utils';
import type { CompatibilityState, ExploreFilterState, FilterVehicle } from '@/types/explore';
import { Filter, LocateFixed, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

import type { Vehicle } from '@/lib/explore/session';
import {
  DEFAULT_FILTER_STATE,
  DELHI_NCR,
  SESSION_KEY_SUGGESTION_DISMISSED_NEAR_ME,
  SESSION_KEY_SUGGESTION_DISMISSED_ROUTE,
} from '@/lib/explore/session';

const MapView = dynamic(
  () => import('@/components/maps/MapView').then(m => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-gray-100 animate-pulse" />,
  },
);

const AddressAutocomplete = dynamic(
  () => import('@/components/maps/AddressAutocomplete').then(m => ({ default: m.AddressAutocomplete })),
  { ssr: false },
);

// ── Page component ────────────────────────────────────────────────────────────

export default function ExplorePage() {
  const {
    viewMode, searchMode, featureFlags, selectedCharger, setSelectedCharger, showToast, toastMessage,
    chargers, fetchLoading, routeChargers, routeFetchLoading, routeChargerTotal,
    searchCenter, centerType, searchAddress, gpsCoords, gpsAvailable, radius, allIndiaMode, locationLoading,
    routeFrom, setRouteFrom, routeFromAddress, routeTo, setRouteTo, routeToAddress,
    routeBuffer, setRouteBuffer, routeCoverage, setRouteCoverage, routeResult, routeLoading,
    activeRouteInput, setActiveRouteInput, geocodingPin, fromIsGps, setFromIsGps,
    routeEditOpen, setRouteEditOpen, isSwapping,
    handleAddressChange, handleAddressSelect, handleUseGpsLocation, handleRadiusChange,
    handlePinDragEnd, handleGpsRouteRefresh, handleFromAddressChange, handleToAddressChange, handleSwap,
    handleViewModeChange, handleSearchModeChange, handleLongPress, handleRefresh,
  } = useExploreSearch();
  const zoom = 12;

  // ── Per-mode filter state (Near Me and Along Route are fully independent) ──
  const [nearMeFilters,    setNearMeFilters]    = useState<ExploreFilterState>(DEFAULT_FILTER_STATE);
  const [routeFilters,     setRouteFilters]     = useState<ExploreFilterState>(DEFAULT_FILTER_STATE);
  const [filtersOpen,      setFiltersOpen]      = useState(false);

  // ── Vehicles (fetched once; used by FilterSheet Vehicle section + chip) ───
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  // ── Per-mode suggestion dismissal (session-scoped) ────────────────────────
  const [nearMeSuggestionDismissed, setNearMeSuggestionDismissed] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY_SUGGESTION_DISMISSED_NEAR_ME) === '1'; }
    catch { return false; }
  });
  const [routeSuggestionDismissed, setRouteSuggestionDismissed] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY_SUGGESTION_DISMISSED_ROUTE) === '1'; }
    catch { return false; }
  });

  // ── Fetch vehicles (for FilterSheet Vehicle section + suggestion chip) ─────
  // Fetches all of the user's vehicles once on mount.  The default vehicle is
  // derived from the list so the same data feeds both the Filters sheet and
  // the suggestion chip without a second request.
  useEffect(() => {
    fetch('/api/users/vehicles')
      .then(r => r.ok ? r.json() as Promise<{ vehicles: Vehicle[] }> : null)
      .then(data => { if (data?.vehicles) setVehicles(data.vehicles); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Per-mode filter helpers ───────────────────────────────────────────────

  function setActiveFilters(updater: ExploreFilterState | ((prev: ExploreFilterState) => ExploreFilterState)) {
    if (isRouteMode) setRouteFilters(updater);
    else setNearMeFilters(updater);
  }

  function handleApplyFilters(filters: ExploreFilterState) {
    setActiveFilters(filters);
  }

  function resetFilters() {
    setActiveFilters(DEFAULT_FILTER_STATE);
  }

  function applyVehicleSuggestion() {
    if (!defaultVehicle) return;
    setActiveFilters(prev => ({
      ...prev,
      compatibility: { type: 'vehicle', vehicleId: defaultVehicle.id, connectorTypes: defaultVehicle.connector_types },
    }));
  }

  function dismissVehicleSuggestion() {
    if (isRouteMode) {
      setRouteSuggestionDismissed(true);
      try { sessionStorage.setItem(SESSION_KEY_SUGGESTION_DISMISSED_ROUTE, '1'); } catch {}
    } else {
      setNearMeSuggestionDismissed(true);
      try { sessionStorage.setItem(SESSION_KEY_SUGGESTION_DISMISSED_NEAR_ME, '1'); } catch {}
    }
  }

  function clearCompatibility() {
    setActiveFilters(prev => ({ ...prev, compatibility: { type: 'none' } }));
  }

  // Used by ChargerListView's inline connector toggles (manual mode).
  function toggleConnector(ct: string) {
    setActiveFilters(prev => {
      const currentSet = prev.compatibility.type === 'manual'
        ? new Set(prev.compatibility.connectors)
        : new Set<string>();
      currentSet.has(ct) ? currentSet.delete(ct) : currentSet.add(ct);
      const newCompat: CompatibilityState = currentSet.size === 0
        ? { type: 'none' }
        : { type: 'manual', connectors: currentSet };
      return { ...prev, compatibility: newCompat };
    });
  }

  // Used by ChargerListView's inline price slider.
  function handleMaxPriceChange(price: number) {
    setActiveFilters(prev => ({ ...prev, maxPrice: price }));
  }

  function bumpRadius() {
    const steps = Array.from(RADIUS_STEPS);
    const next = steps.find(s => isFinite(s) ? s > radius : true);
    if (next !== undefined) handleRadiusChange(next);
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const isRouteMode    = searchMode === 'along_route';
  const activeFilters  = isRouteMode ? routeFilters  : nearMeFilters;
  const suggestionDismissed = isRouteMode ? routeSuggestionDismissed : nearMeSuggestionDismissed;

  // The default vehicle is the vehicle with is_default=true, used for the suggestion chip.
  const defaultVehicle = vehicles.find(v => v.is_default) ?? null;

  // Resolve which connector set is currently active for charger filtering.
  const activeConnectors = resolveConnectors(activeFilters.compatibility);

  // Suggestion chip: Compatibility = none, default vehicle with connectors exists, not dismissed.
  const showSuggestionChip =
    defaultVehicle !== null &&
    defaultVehicle.connector_types.length > 0 &&
    activeFilters.compatibility.type === 'none' &&
    !suggestionDismissed;

  // Active vehicle filter chip: Compatibility = vehicle (suggestion was accepted or set via Filters).
  const showVehicleFilterChip = activeFilters.compatibility.type === 'vehicle';

  const visibleChargers = filterChargers(chargers, activeFilters);
  const visibleRouteChargers = filterChargers(routeChargers, activeFilters);

  const hiddenByFilters = isRouteMode
    ? routeChargers.length - visibleRouteChargers.length
    : chargers.length - visibleChargers.length;

  // Badge counts ONE per filter DIMENSION deviating from Any — max 4.
  // Multiple manual connector chips still count as 1 (it's one Compatibility dimension).
  const activeFilterCount = countActiveFilters(activeFilters);
  const compatState = activeFilters.compatibility;
  const activeVehicle: FilterVehicle | null =
    compatState.type === 'vehicle'
      ? (vehicles.find(v => v.id === compatState.vehicleId) ?? null)
      : null;

  const activeFetchLoading = isRouteMode ? routeFetchLoading : fetchLoading;

  const radiusKm = isFinite(radius) ? radius / 1000 : 0;

  const counterLabel = activeFetchLoading
    ? 'Searching…'
    : allIndiaMode
      ? `${chargers.length.toLocaleString('en-IN')} chargers across India`
      : hiddenByFilters > 0
        ? `${visibleChargers.length} of ${chargers.length} charger${chargers.length === 1 ? '' : 's'} (${hiddenByFilters} hidden)`
        : `${visibleChargers.length} charger${visibleChargers.length === 1 ? '' : 's'} within ${radiusKm % 1 === 0 ? radiusKm : radiusKm.toFixed(1)} km`;

  const mapCenter = searchCenter ?? DELHI_NCR;

  const chargerMarkersData: ChargerMarkerData[] = (isRouteMode ? visibleRouteChargers : visibleChargers).map(c => ({
    id: c.id,
    coords: { lat: Number(c.latitude), lng: Number(c.longitude) },
    status: c.status as 'active' | 'paused',
    pricePerKwh: Number(c.price_per_kwh),
  }));

  const selectedDistanceKm = useMemo(() => {
    if (!selectedCharger) return undefined;
    if (isRouteMode) {
      const rc = visibleRouteChargers.find(c => c.id === selectedCharger.id);
      return rc ? rc.distance_from_route_m / 1000 : undefined;
    }
    if (!searchCenter) return undefined;
    return haversineKm(searchCenter, {
      lat: Number(selectedCharger.latitude),
      lng: Number(selectedCharger.longitude),
    });
  }, [selectedCharger, isRouteMode, visibleRouteChargers, searchCenter]);

  const fitBoundsTarget = useMemo(
    () => (routeResult ? computeRouteBounds(routeResult.geometry) : undefined),
    [routeResult],
  );

  const panelChargers = isRouteMode ? visibleRouteChargers : visibleChargers;

  const routeSearchControls = (
                  routeResult && !routeEditOpen ? (
                    /* State 3: compact summary */
                    <RouteCompactSummary
                      fromAddress={routeFromAddress}
                      toAddress={routeToAddress}
                      distanceMeters={routeResult.distanceMeters}
                      durationSeconds={routeResult.durationSeconds}
                      chargerCount={visibleRouteChargers.length}
                      chargerCountLoading={routeFetchLoading}
                      routeLoading={routeLoading}
                      chargerRawCount={routeChargers.length}
                      chargerCappedTotal={routeChargerTotal > 0 ? routeChargerTotal : undefined}
                      coverageM={routeCoverage}
                      onCoverageChange={setRouteCoverage}
                      offRouteM={routeBuffer}
                      onOffRouteChange={setRouteBuffer}
                      onEdit={() => setRouteEditOpen(true)}
                    />
                  ) : (
                    /* States 1/2/4: From + To inputs with swap */
                    <RouteInputs
                      fromAddress={routeFromAddress}
                      toAddress={routeToAddress}
                      onFromAddressChange={handleFromAddressChange}
                      onToAddressChange={handleToAddressChange}
                      onFromSelect={r => { setFromIsGps(false); setRouteFrom(r); setActiveRouteInput('to'); }}
                      onToSelect={r => setRouteTo(r)}
                      onGpsRefresh={handleGpsRouteRefresh}
                      activeInput={activeRouteInput}
                      onSetActive={setActiveRouteInput}
                      fromGeocoding={geocodingPin === 'from'}
                      toGeocoding={geocodingPin === 'to'}
                      fromIsGps={fromIsGps}
                      onSwap={handleSwap}
                      canSwap={!!(routeFrom && routeTo) && !isSwapping}
                      isSwapping={isSwapping}
                      routeLoading={routeLoading}
                      onDone={routeEditOpen ? () => setRouteEditOpen(false) : undefined}
                    />
                  )
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        'flex flex-col',
        'md:h-[calc(100dvh-var(--navbar-h))]',
        viewMode === 'map' ? 'h-dvh' : 'min-h-dvh',
      )}
    >
      {/* ── Header: segmented mode toggle + filters ────────────────────── */}
      <div className="border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-2 px-3 pb-2.5 pt-[calc(var(--screen-top-inset)+0.625rem)] md:px-5 desk:px-6">
          {featureFlags.route_planning_enabled && (
            <ModeToggle value={searchMode} onChange={handleSearchModeChange} />
          )}
          <div className="flex-1" />
          <button
            onClick={() => setFiltersOpen(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors',
              activeFilterCount > 0
                ? 'bg-ink text-white border-ink'
                : 'bg-gray-100 text-muted border-gray-200 hover:text-ink hover:bg-gray-200',
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
          </button>
        </div>

        {/* ── Vehicle compatibility chips ────────────────────────────────── */}
        {showSuggestionChip && defaultVehicle && (
          <div className="flex items-center gap-2 px-3 pb-2.5 md:px-5 desk:px-6">
            <button
              type="button"
              onClick={applyVehicleSuggestion}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-soft border border-green/30 text-xs font-semibold text-green-deep hover:bg-green/20 transition-colors"
            >
              {`Show chargers for ${defaultVehicle.nickname ?? 'your vehicle'}`}
            </button>
            <button
              type="button"
              onClick={dismissVehicleSuggestion}
              aria-label="Dismiss suggestion"
              className="shrink-0 size-5 rounded-full bg-gray-100 hover:bg-gray-200 grid place-items-center transition-colors text-muted hover:text-ink"
            >
              <X className="size-3" />
            </button>
          </div>
        )}
        {showVehicleFilterChip && (
          <div className="flex items-center gap-2 px-3 pb-2.5 md:px-5 desk:px-6">
            <button
              type="button"
              onClick={clearCompatibility}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green text-white border border-green text-xs font-semibold hover:bg-green/90 transition-colors"
            >
              {`${activeVehicle?.nickname ?? 'Your vehicle'} · Compatible`}
              <X className="size-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── Content: column on mobile/tablet, row at desktop ─────────────── */}
      <div className="flex-1 flex flex-col desk:flex-row desk:overflow-hidden desk:min-h-0">

        {/* ── Map — map mode on mobile/tablet, always visible at desktop ──── */}
        <div
          className={cn(
            'relative overflow-hidden desk:flex-[3]',
            viewMode === 'map' ? 'flex-1' : 'hidden desk:block',
          )}
        >
          {locationLoading ? (
            <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center">
              <p className="text-sm text-muted">Getting your location…</p>
            </div>
          ) : (
            <MapView
              center={mapCenter}
              zoom={zoom}
              fitIndia={!isRouteMode && allIndiaMode}
              chargerMarkers={chargerMarkersData}
              searchRadius={!isRouteMode && !allIndiaMode ? radius : undefined}
              userLocation={!isRouteMode && centerType === 'gps' && gpsAvailable === true ? (gpsCoords ?? undefined) : undefined}
              manualCenter={!isRouteMode && centerType === 'manual' ? mapCenter : undefined}
              routeGeometry={isRouteMode ? routeResult?.geometry : undefined}
              routeBuffer={isRouteMode ? routeBuffer : undefined}
              routeRecalculating={isRouteMode && routeLoading}
              fromCoords={isRouteMode ? routeFrom?.coords : undefined}
              toCoords={isRouteMode ? routeTo?.coords : undefined}
              fromAddress={isRouteMode ? routeFrom?.address : undefined}
              toAddress={isRouteMode ? routeTo?.address : undefined}
              activeRoutePin={isRouteMode ? activeRouteInput : undefined}
              onFromPinDragEnd={isRouteMode && routeFrom ? c => handlePinDragEnd('from', c) : undefined}
              onToPinDragEnd={isRouteMode && routeTo ? c => handlePinDragEnd('to', c) : undefined}
              fitBoundsTarget={isRouteMode ? fitBoundsTarget : undefined}
              selectedChargerId={selectedCharger?.id}
              onChargerClick={id => {
                const source = isRouteMode ? routeChargers : chargers;
                const found = source.find(c => c.id === id);
                if (found) setSelectedCharger(found);
              }}
              onMapClick={() => setSelectedCharger(null)}
              onLongPress={handleLongPress}
            />
          )}

          {/* ── Map overlay: controls ─────────────────────────────────────── */}
          {!locationLoading && (
            <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-3 pointer-events-auto">
                {isRouteMode ? (
                  routeSearchControls
                ) : (
                  /* Near-me mode */
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <AddressAutocomplete
                          value={searchAddress}
                          onChange={handleAddressChange}
                          onSelect={handleAddressSelect}
                          placeholder="Search a location…"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => { void handleUseGpsLocation(); }}
                        title={gpsAvailable === false ? 'Location access denied' : 'Use my location'}
                        aria-label="Use current GPS location"
                        disabled={gpsAvailable === false}
                        className={cn(
                          'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                          gpsAvailable === false
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : centerType === 'gps' && gpsAvailable === true
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200 text-ink',
                        )}
                      >
                        <LocateFixed className="w-4 h-4" />
                      </button>
                    </div>
                    <span
                      className={cn(
                        'block text-xs font-semibold transition-colors',
                        activeFetchLoading ? 'text-muted' : 'text-ink',
                      )}
                    >
                      {counterLabel}
                    </span>
                    <RadiusSlider
                      value={allIndiaMode ? Infinity : radius}
                      onChange={handleRadiusChange}
                      isLoading={fetchLoading}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Toast ─────────────────────────────────────────────────────── */}
          <div
            className={cn(
              'absolute bottom-6 left-4 right-16 z-20 transition-all duration-300',
              showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none',
            )}
          >
            <div className="bg-ink text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg text-center">
              {toastMessage}
            </div>
          </div>

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {!activeFetchLoading && !locationLoading &&
            (isRouteMode
              ? visibleRouteChargers.length === 0 && routeResult !== null
              : visibleChargers.length === 0) && (
            <div className="absolute inset-0 flex items-end justify-center pb-28 pointer-events-none z-10">
              <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-5 py-4 mx-4 text-center pointer-events-auto">
                {isRouteMode ? (
                  <>
                    <p className="font-semibold text-ink text-sm">No chargers along this route</p>
                    {activeFilterCount > 0 ? (
                      <button onClick={resetFilters} className="mt-2 text-xs font-semibold text-volt-deep underline">
                        Clear filters
                      </button>
                    ) : (
                      <p className="text-xs text-muted mt-1">Try increasing the buffer radius.</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-ink text-sm">
                      {allIndiaMode
                        ? 'No chargers found across India'
                        : `No chargers within ${radiusKm % 1 === 0 ? radiusKm : radiusKm.toFixed(1)} km`}
                    </p>
                    {activeFilterCount > 0 ? (
                      <button onClick={resetFilters} className="mt-2 text-xs font-semibold text-volt-deep underline">
                        Clear filters
                      </button>
                    ) : !allIndiaMode ? (
                      <button
                        onClick={bumpRadius}
                        className="mt-2 px-4 py-1.5 rounded-xl bg-ink text-white text-xs font-semibold"
                      >
                        Search wider area
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bottom sheet — mobile + tablet only (desk:hidden inside component) */}
          <ChargerBottomSheet
            charger={selectedCharger}
            distanceKm={selectedDistanceKm}
            distanceSuffix={isRouteMode ? 'off your route' : 'away'}
            onClose={() => setSelectedCharger(null)}
            defaultVehicle={defaultVehicle}
          />
        </div>

        {/* ── Results panel — desktop only ──────────────────────────────────── */}
        <ExploreResultsPanel
          panelChargers={panelChargers}
          activeFetchLoading={activeFetchLoading}
          activeFilterCount={activeFilterCount}
          resetFilters={resetFilters}
          isRouteMode={isRouteMode}
          searchCenter={searchCenter}
          selectedCharger={selectedCharger}
        />

        {/* ── List view — mobile/tablet only ──────────────────────────────── */}
        {viewMode === 'list' && (
          <div className="flex-1 px-4 sm:px-6 py-4 max-w-5xl mx-auto w-full desk:hidden">
            {/* Search controls — same logic as map overlay but inline */}
            <div className="mb-4 bg-white rounded-xl shadow-sm border border-gray-100 p-3 space-y-2">
              {isRouteMode ? (
                routeSearchControls
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <AddressAutocomplete
                        value={searchAddress}
                        onChange={handleAddressChange}
                        onSelect={handleAddressSelect}
                        placeholder="Search a location…"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => { void handleUseGpsLocation(); }}
                      title={gpsAvailable === false ? 'Location access denied' : 'Use my location'}
                      aria-label="Use current GPS location"
                      disabled={gpsAvailable === false}
                      className={cn(
                        'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                        gpsAvailable === false
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : centerType === 'gps'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-ink',
                      )}
                    >
                      <LocateFixed className="w-4 h-4" />
                    </button>
                  </div>
                  <span
                    className={cn(
                      'block text-xs font-semibold transition-colors',
                      activeFetchLoading ? 'text-muted' : 'text-ink',
                    )}
                  >
                    {counterLabel}
                  </span>
                  <RadiusSlider
                    value={allIndiaMode ? Infinity : radius}
                    onChange={handleRadiusChange}
                    isLoading={fetchLoading}
                  />
                </>
              )}
            </div>

            {!isRouteMode && allIndiaMode && chargers.length >= 100 && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-volt-soft border border-volt/20 text-volt-deep text-xs font-semibold">
                Showing 100 of many chargers — narrow your radius to see more.
              </div>
            )}
            <ChargerListView
              chargers={isRouteMode ? (routeChargers as ChargerRow[]) : chargers}
              loading={activeFetchLoading || locationLoading}
              userCoords={searchCenter ?? undefined}
              selectedConnectors={activeConnectors ?? new Set()}
              maxPrice={activeFilters.maxPrice}
              onConnectorToggle={toggleConnector}
              onMaxPriceChange={handleMaxPriceChange}
              onClearFilters={resetFilters}
            />
          </div>
        )}
      </div>

      {/* ── Floating view toggle — mobile/tablet only ── */}
      <div className="fixed bottom-20 right-4 z-30 desk:hidden">
        <FloatingViewToggle value={viewMode} onChange={handleViewModeChange} />
      </div>

      {/* Filter sheet */}
      <FilterSheet
        isOpen={filtersOpen}
        filters={activeFilters}
        vehicles={vehicles}
        onApply={handleApplyFilters}
        onClose={() => setFiltersOpen(false)}
      />
      <PullToRefresh onRefresh={handleRefresh} />
    </div>
  );
}
