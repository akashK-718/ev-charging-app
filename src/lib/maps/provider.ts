// All map-provider calls in this app go through this file.
// Components must import `maps` from here — never from provider SDKs directly.
// To swap providers: change the import + export at the bottom of this file.

export type { MapProvider } from './types';

import { mapboxProvider } from './mapbox';
import type { MapProvider } from './types';

// Active provider — change this one line to swap the implementation.
export const maps: MapProvider = mapboxProvider;
