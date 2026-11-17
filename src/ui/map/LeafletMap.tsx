// Web only: imported lazily by PinsMap.tsx after hydration.
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useMemo } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';

import { GREECE, boundsFor, type Pin } from '@/domain/map';

import { colors } from '../theme';

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A rounded label instead of Leaflet's default image marker (no image assets to bundle). */
function pinIcon(label: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:inline-block;transform:translate(-50%,-100%);padding:4px 8px;border-radius:12px;background:${colors.primary};color:${colors.onPrimary};font:600 13px system-ui,sans-serif;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer">${escapeHtml(label)}</span>`,
    iconSize: [0, 0],
  });
}

export default function LeafletMap({
  pins,
  onPress,
}: {
  pins: Pin[];
  onPress?: (id: string) => void;
}) {
  const bounds = boundsFor(pins);
  // A new icon object makes react-leaflet replace the marker element, and a
  // re-render during a tap would then lose the click: keep one icon per label.
  const labels = pins.map((pin) => pin.label).join('\n');
  const icons = useMemo(
    () => new Map(labels.split('\n').map((label) => [label, pinIcon(label)])),
    [labels],
  );
  return (
    <MapContainer
      // bounds apply on mount: a new set of pins remounts the map.
      key={pins.map((p) => p.id).join()}
      {...(bounds ? { bounds } : { center: [GREECE.lat, GREECE.lng], zoom: 6 })}
      // Let the page scroll; zoom with the buttons or two fingers.
      scrollWheelZoom={false}
      // Leaflet focuses the map on mouse-down for arrow-key panning. The browser
      // then scrolls our scroll view to show the whole map, mid-tap, and the tap
      // on a pin is lost. Pins stay reachable with Tab.
      keyboard={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={icons.get(pin.label) ?? pinIcon(pin.label)}
          title={pin.title}
          alt={pin.title}
          // Tab to a pin, Enter opens it.
          keyboard
          eventHandlers={{
            click: () => onPress?.(pin.id),
            // Leaflet's own Enter handling only opens popups.
            keypress: (e) => {
              if (e.originalEvent.key === 'Enter') onPress?.(pin.id);
            },
          }}
        />
      ))}
    </MapContainer>
  );
}
