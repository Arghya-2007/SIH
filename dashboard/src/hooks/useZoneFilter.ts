"use client";

import { useState, useMemo } from 'react';
import { useRealtime } from './useRealtime';

export type StatusFilterOption = 'all' | 'online' | 'offline' | 'gaps';

export function useZoneFilter() {
  const { readings, nodeStatuses, activeZones: realtimeActiveZones } = useRealtime();
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');

  // Stable list of all known zones across activeZones, readings, and nodeStatuses
  const allKnownZones = useMemo(() => {
    return Array.from(
      new Set([
        ...realtimeActiveZones,
        ...Object.keys(readings),
        ...Object.keys(nodeStatuses),
      ])
    )
      .filter(Boolean)
      .sort();
  }, [realtimeActiveZones, readings, nodeStatuses]);

  const filteredZones = useMemo(() => {
    const result: Record<string, string[]> = {};

    allKnownZones.forEach(zoneId => {
      if (selectedZone !== 'all' && selectedZone !== zoneId) return;

      const nodesInZone = new Set<string>([
        ...Object.keys(readings[zoneId] || {}),
        ...Object.keys(nodeStatuses[zoneId] || {}),
      ]);

      const matchingNodes = Array.from(nodesInZone).filter(nodeId => {
        // Query search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesQuery =
            nodeId.toLowerCase().includes(q) || zoneId.toLowerCase().includes(q);
          if (!matchesQuery) return false;
        }

        // Status filter
        const status = nodeStatuses[zoneId]?.[nodeId];
        const isOnline = status?.status === 'online';
        const hasGaps = (status?.gapCount || 0) > 0;

        if (statusFilter === 'online' && !isOnline) return false;
        if (statusFilter === 'offline' && isOnline) return false;
        if (statusFilter === 'gaps' && !hasGaps) return false;

        return true;
      });

      if (matchingNodes.length > 0 || (selectedZone === zoneId && !searchQuery)) {
        result[zoneId] = matchingNodes.sort();
      }
    });

    return result;
  }, [readings, nodeStatuses, allKnownZones, selectedZone, searchQuery, statusFilter]);

  return {
    selectedZone,
    setSelectedZone,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    filteredZones,
    activeZones: allKnownZones,
  };
}
