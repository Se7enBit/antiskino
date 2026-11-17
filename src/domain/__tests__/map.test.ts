import { GREECE, boundsFor, pinsOf, regionFor, type Pin } from '../map';

const pin = (id: string, lat: number, lng: number): Pin => ({ id, lat, lng, title: id, label: id });

describe('pinsOf', () => {
  it('skips campings without coordinates', () => {
    const items = [
      { id: 'a', lat: 40, lng: 23 },
      { id: 'b', lat: null, lng: 23 },
      { id: 'c', lat: 39, lng: null },
    ];
    const pins = pinsOf(
      items,
      (item) => item,
      (item, lat, lng) => pin(item.id, lat, lng),
    );
    expect(pins.map((p) => p.id)).toEqual(['a']);
  });
});

describe('regionFor', () => {
  it('shows Greece without pins', () => {
    expect(regionFor([])).toMatchObject({ latitude: GREECE.lat, longitude: GREECE.lng });
  });

  it('frames every pin with a margin', () => {
    const region = regionFor([pin('a', 40, 23), pin('b', 39, 22)]);
    expect(region.latitude).toBeCloseTo(39.5);
    expect(region.longitude).toBeCloseTo(22.5);
    expect(region.latitudeDelta).toBeCloseTo(1.4);
    expect(region.longitudeDelta).toBeCloseTo(1.4);
  });

  it('zooms in on a single pin, but not endlessly', () => {
    expect(regionFor([pin('a', 40.2, 23.6)])).toEqual({
      latitude: 40.2,
      longitude: 23.6,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  });
});

describe('boundsFor', () => {
  it('gives the corners of the same frame', () => {
    expect(boundsFor([])).toBeNull();
    const [[south, west], [north, east]] = boundsFor([pin('a', 40, 23), pin('b', 39, 22)])!;
    expect(south).toBeCloseTo(38.8);
    expect(west).toBeCloseTo(21.8);
    expect(north).toBeCloseTo(40.2);
    expect(east).toBeCloseTo(23.2);
  });
});
