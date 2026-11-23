import test from 'node:test';
import assert from 'node:assert/strict';
import { simplifyRouteGeoJSON, truncateRouteGeometry, computeRouteBounds } from '../src/lib/maps/geometry';
import { haversineKm } from '../src/lib/haversine';

const line = (coordinates: number[][]) => JSON.stringify({ type: 'LineString', coordinates });

test('simplifying a long route retains both endpoints and leaves short routes alone', () => {
  const coordinates = Array.from({ length: 100 }, (_, i) => [77 + i / 1000, 28]);
  const result = JSON.parse(simplifyRouteGeoJSON(line(coordinates), 10));
  assert.deepEqual(result.coordinates[0], coordinates[0]);
  assert.deepEqual(result.coordinates.at(-1), coordinates.at(-1));
  assert.ok(result.coordinates.length < coordinates.length);
  const short = line(coordinates.slice(0, 2));
  assert.equal(simplifyRouteGeoJSON(short, 10), short);
});

test('route coverage interpolates the final point at the selected distance', () => {
  const route = line([[0, 0], [1, 0], [2, 0]]);
  const segmentMeters = haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) * 1000;
  const result = JSON.parse(truncateRouteGeometry(route, segmentMeters * 1.5));
  assert.deepEqual(result.coordinates, [[0, 0], [1, 0], [1.5, 0]]);
  assert.equal(truncateRouteGeometry(route, Infinity), route);
  assert.equal(truncateRouteGeometry(route, segmentMeters * 3), route);
});

test('invalid geometry leaves the original input intact', () => {
  for (const input of ['invalid', '{}']) {
    assert.equal(simplifyRouteGeoJSON(input, 10), input);
    assert.equal(truncateRouteGeometry(input, 100), input);
  }
});

test('bounds cover all coordinates, including negative latitude and longitude', () => {
  assert.deepEqual(computeRouteBounds([{ lng: 4, lat: -2 }, { lng: -3, lat: 5 }, { lng: 1, lat: 1 }]), [[-3, -2], [4, 5]]);
  assert.equal(computeRouteBounds([]), undefined);
  assert.equal(computeRouteBounds([{ lng: 1, lat: 1 }]), undefined);
});
