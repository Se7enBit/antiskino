// Web only: imported lazily by PinsMap.tsx after hydration (MapLibre needs a browser).
import 'maplibre-gl/dist/maplibre-gl.css';

import Constants from 'expo-constants';
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import { lngLatBoundsFor, type Pin } from '@/domain/map';

import { colors } from '../theme';
import { MAP_STYLE } from './style';

// MapLibre's worker is a separate file that Metro can't bundle: postinstall
// copies it to public/ (scripts/copy-map-worker.js), served under the site's base URL.
setWorkerUrl(
  `${window.location.origin}${Constants.expoConfig?.experiments?.baseUrl ?? ''}/maplibre-gl-worker.js`,
);

/** A rounded label button per pin (focusable: Tab to it, Enter opens it). */
function pinElement(pin: Pin, onPress: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = pin.label;
  el.title = pin.title;
  el.setAttribute('aria-label', pin.title === pin.label ? pin.title : `${pin.title}, ${pin.label}`);
  Object.assign(el.style, {
    padding: '4px 8px',
    border: 'none',
    borderRadius: '12px',
    background: colors.primary,
    color: colors.onPrimary,
    font: '600 13px system-ui, sans-serif',
    whiteSpace: 'nowrap',
    boxShadow: '0 1px 4px rgba(0,0,0,.3)',
    cursor: 'pointer',
  });
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onPress();
  });
  return el;
}

/**
 * The pins are read once: PinsMap remounts this component for a new set of
 * pins, so the map is created once per set.
 */
export default function MapLibreWebMap({
  pins: initialPins,
  onPress,
}: {
  pins: Pin[];
  onPress?: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [pins] = useState(initialPins);
  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  });

  useEffect(() => {
    if (!container.current) return;
    const map = new MapLibreMap({
      container: container.current,
      style: MAP_STYLE,
      bounds: lngLatBoundsFor(pins),
      // Let the page scroll; zoom with the buttons, a double tap or two fingers.
      scrollZoom: false,
      // No arrow-key panning: focusing the map mid-tap made the page scroll and lose the tap.
      keyboard: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: { compact: true },
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    for (const pin of pins) {
      new Marker({
        element: pinElement(pin, () => onPressRef.current?.(pin.id)),
        anchor: 'bottom',
      })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);
    }
    return () => map.remove();
  }, [pins]);

  return <div ref={container} style={{ width: '100%', height: '100%' }} />;
}
