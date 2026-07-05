export type ApproximateLocation = {
  latitude: number;
  longitude: number;
  is_approximate: true;
};

export type ExactLocation = {
  latitude: number;
  longitude: number;
  is_approximate: false;
};

/**
 * Deterministic 2 km offset using chargerId as seed.
 * Same charger always produces the same offset angle so the pin never jumps.
 */
function seedAngle(chargerId: string): number {
  let h = 0;
  for (let i = 0; i < chargerId.length; i++) {
    h = (Math.imul(31, h) + chargerId.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) / 0x100000000) * 2 * Math.PI;
}

export function applyLocationOffset(
  lat: number,
  lng: number,
  chargerId: string,
  offsetMeters = 2000,
): ApproximateLocation {
  const angle = seedAngle(chargerId);
  const latitude = lat + (offsetMeters / 111320) * Math.sin(angle);
  const longitude =
    lng +
    (offsetMeters / (111320 * Math.cos((lat * Math.PI) / 180))) *
      Math.cos(angle);
  return { latitude, longitude, is_approximate: true };
}
