/**
 * Local solar ephemeris + International Standard Atmosphere + wind.
 * Based on NOAA's approximate solar position equations (not a sky almanac).
 * Degrees for external inputs, radians for internal directions.
 */
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
export const R = 287.05287;
export const G = 9.80665;
export const GAMMA = 1.4;
export const SEA_LEVEL_PRESSURE = 101325;

export function isa(altitudeMeters, temperatureOffsetC = 0) {
  const h = Math.max(-500, Math.min(20000, altitudeMeters));
  const troposphere = Math.min(11000, h);
  const base = 288.15 - .0065 * troposphere;
  const temperatureK = Math.max(180, base + temperatureOffsetC);
  const pressure = SEA_LEVEL_PRESSURE *
    Math.pow(base / 288.15, -G / (-.0065 * R)) *
    (h > 11000 ? Math.exp(-G * (h - 11000) / (R * 216.65)) : 1);
  const density = pressure / (R * temperatureK);
  return {
    temperatureK, temperatureC: temperatureK - 273.15,
    pressurePa: pressure, density,
    speedOfSound: Math.sqrt(GAMMA * R * temperatureK),
    densityRatio: density / 1.225
  };
}
export function solarPosition(date, latitudeDeg, longitudeDeg) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError("solarPosition expects a valid Date");
  }
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 86400000;
  const gamma = 2 * Math.PI / 365 * (day - 1 + (date.getUTCHours() - 12) / 24);
  const eqTime = 229.18 * (.000075 + .001868 * Math.cos(gamma) -
    .032077 * Math.sin(gamma) - .014615 * Math.cos(2 * gamma) -
    .040849 * Math.sin(2 * gamma));
  const declination = .006918 - .399912 * Math.cos(gamma) +
    .070257 * Math.sin(gamma) - .006758 * Math.cos(2 * gamma) +
    .000907 * Math.sin(2 * gamma) - .002697 * Math.cos(3 * gamma) +
    .00148 * Math.sin(3 * gamma);
  const utcMinutes = date.getUTCHours() * 60 +
    date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolarMinutes = ((utcMinutes + eqTime + 4 * longitudeDeg) % 1440 + 1440) % 1440;
  const hourAngle = (trueSolarMinutes / 4 - 180) * DEG;
  const lat = latitudeDeg * DEG;
  const sinAlt = Math.sin(lat) * Math.sin(declination) +
    Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  const altitudeRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const east = -Math.cos(declination) * Math.sin(hourAngle);
  const north = Math.cos(lat) * Math.sin(declination) -
    Math.sin(lat) * Math.cos(declination) * Math.cos(hourAngle);
  const horizontal = Math.max(1e-8, Math.hypot(east, north));
  return {
    elevationDeg: altitudeRad * RAD,
    azimuthDeg: (Math.atan2(east, north) * RAD + 360) % 360,
    declinationDeg: declination * RAD,
    vector: { x: east, y: sinAlt, z: -north },
    isDaylight: altitudeRad > 0,
    horizontal
  };
}
export function windAt(altitude, time, weather = "limpo", seed = 113) {
  const base = weather === "vento" ? 11 : weather === "nublado" ? 6 :
    weather === "névoa" ? 2 : 3;
  const shear = Math.log1p(Math.max(0, altitude) / 80) * .33;
  const t = time + seed * .013;
  const gust = (Math.sin(t * .31) + .5 * Math.sin(t * .73 + 1.7) +
    .25 * Math.sin(t * 1.47 + 2.4)) *
    (weather === "vento" ? 3.7 : 1.0);
  return {
    x: base * .66 + shear + gust * .8,
    y: Math.sin(t * .87) * (weather === "vento" ? 1.5 : .28),
    z: -base * .31 + gust * .31,
    turbulence: weather === "vento" ? .45 : weather === "nublado" ? .17 : .05
  };
}
