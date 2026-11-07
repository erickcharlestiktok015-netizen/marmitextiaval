import { useEffect, useRef, useState } from 'react';
import { Crosshair, Minus, Plus } from 'lucide-react';

export type GeoPoint = { latitude: number; longitude: number };

export interface DeliveryMapProps {
  courierLocation: GeoPoint | null;
  destinationLocation?: GeoPoint | null;
  destinationTitle?: string;
  destinationNeighborhood?: string;
  className?: string;
  interactive?: boolean;
  showRoute?: boolean;
  showWazeButton?: boolean;
  showLocationPill?: boolean;
  onRouteCalculated?: (info: { distanceKm: number; durationMin: number }) => void;
  onRequestLocation?: () => void;
  onFitRoute?: () => void;
}

// Global script loader for Leaflet
let leafletLoadPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as unknown as { L?: unknown }).L) return Promise.resolve();
  if (leafletLoadPromise) return leafletLoadPromise;

  leafletLoadPromise = new Promise((resolve, reject) => {
    // Inject CSS
    const linkId = 'leaflet-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // Inject JS
    const scriptId = 'leaflet-js';
    if (document.getElementById(scriptId)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.crossOrigin = '';
    script.onload = () => resolve();
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
  return leafletLoadPromise;
}

export function DeliveryMap({
  courierLocation,
  destinationLocation,
  destinationTitle,
  destinationNeighborhood,
  className = 'h-72 w-full',
  interactive = true,
  showRoute = true,
  showWazeButton = true,
  showLocationPill = true,
  onRouteCalculated,
  onRequestLocation,
}: DeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const courierMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const destMarkerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routePolylineRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeGlowPolylineRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);

  // Initialize Leaflet Map with 100% Free, Reliable Dark Tiles (Zero API Key Required)
  useEffect(() => {
    let active = true;
    if (!containerRef.current) return;

    loadLeaflet()
      .then(() => {
        if (!active || !containerRef.current) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = (window as unknown as { L: any }).L;
        if (!L) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const defaultCenter: [number, number] = courierLocation
          ? [courierLocation.latitude, courierLocation.longitude]
          : destinationLocation
          ? [destinationLocation.latitude, destinationLocation.longitude]
          : [-3.7319, -38.5267]; // Fortaleza padrão

        const map = L.map(containerRef.current, {
          center: defaultCenter,
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
          dragging: interactive,
          touchZoom: interactive,
          scrollWheelZoom: interactive,
          doubleClickZoom: interactive,
        });

        // 1) Primary Dark Base Tiles: Esri World Dark Gray Base (No API key, globally available, no watermark)
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: '',
          crossOrigin: true,
        }).addTo(map);

        // 2) Esri World Dark Gray Reference: Clean street names and labels in English/Portuguese
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: '',
          crossOrigin: true,
        }).addTo(map);

        mapInstanceRef.current = map;
        setMapReady(true);
      })
      .catch((err) => {
        console.error('Falha ao inicializar mapa:', err);
      });

    return () => {
      active = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [interactive]);

  // Update Courier Marker (Motoboy Avatar com capacete, mochila Tia Val e scooter)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as unknown as { L: any }).L;
    if (!L) return;

    if (!courierLocation) {
      if (courierMarkerRef.current) {
        courierMarkerRef.current.remove();
        courierMarkerRef.current = null;
      }
      return;
    }

    const html = `
      <div class="relative flex items-center justify-center cursor-pointer transition-transform duration-300 hover:scale-110" style="width: 60px; height: 60px;">
        <!-- Forward pulse / radar cone -->
        <span class="absolute w-14 h-14 rounded-full bg-sky-500/25 animate-ping"></span>
        <span class="absolute w-11 h-11 rounded-full border border-sky-400/80 bg-sky-500/20 shadow-[0_0_18px_rgba(56,189,248,0.7)]"></span>
        
        <!-- Motoboy 3D Avatar (Capacete vermelho, mochila térmica Tia Val e scooter) -->
        <svg viewBox="0 0 64 64" width="48" height="48" class="relative z-10 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
          <!-- Sombra no chão -->
          <ellipse cx="32" cy="56" rx="16" ry="4" fill="rgba(0,0,0,0.4)" filter="blur(1px)"/>
          
          <!-- Pneu traseiro scooter -->
          <rect x="29" y="47" width="6" height="10" rx="3" fill="#090d16" stroke="#334155" stroke-width="1"/>
          <!-- Para-lama -->
          <path d="M25 46 Q32 41 39 46" stroke="#1e293b" stroke-width="3" fill="none"/>
          <!-- Luz traseira vermelha com brilho -->
          <rect x="28" y="44" width="8" height="3" rx="1.5" fill="#ef4444" style="filter: drop-shadow(0 0 5px #ef4444);"/>
          <!-- Chassi da scooter -->
          <ellipse cx="32" cy="39" rx="12" ry="6" fill="#dc2626" stroke="#991b1b" stroke-width="1"/>
          
          <!-- Guidão e retrovisores -->
          <line x1="19" y1="23" x2="45" y2="23" stroke="#475569" stroke-width="2.2" stroke-linecap="round"/>
          <circle cx="18" cy="20" r="2.5" fill="#cbd5e1" stroke="#0f172a" stroke-width="1"/>
          <circle cx="46" cy="20" r="2.5" fill="#cbd5e1" stroke="#0f172a" stroke-width="1"/>
          
          <!-- Ombros / Jaqueta escura do piloto -->
          <path d="M19 35 C19 27 45 27 45 35 Z" fill="#0f172a"/>
          
          <!-- Mochila térmica vermelha (Mochila Tia Val / iFood) -->
          <rect x="21" y="24" width="22" height="16" rx="3.5" fill="#ea1d2c" stroke="#b91c1c" stroke-width="1.2"/>
          <!-- Faixa refletiva branca horizontal da mochila -->
          <rect x="21" y="31" width="22" height="3" fill="#ffffff" opacity="0.95"/>
          <rect x="21" y="32" width="22" height="1" fill="#facc15" opacity="0.8"/>
          <!-- Alças da mochila -->
          <line x1="24" y1="24" x2="24" y2="34" stroke="#7f1d1d" stroke-width="1.2"/>
          <line x1="40" y1="24" x2="40" y2="34" stroke="#7f1d1d" stroke-width="1.2"/>
          
          <!-- Capacete do Motoboy (Vermelho com visor preto brilhante) -->
          <circle cx="32" cy="18" r="8" fill="#ea1d2c" stroke="#991b1b" stroke-width="1.2"/>
          <!-- Viseira fumê -->
          <path d="M27 15 Q32 13 37 15 Q38 19 32 20 Q26 19 27 15 Z" fill="#020617" stroke="#334155" stroke-width="0.8"/>
          <!-- Brilho na viseira -->
          <path d="M28 15 Q31 14 34 15" stroke="#38bdf8" stroke-width="1" fill="none" stroke-linecap="round" opacity="0.9"/>
          <!-- Brilho no capacete -->
          <path d="M27 13 Q31 11 35 12" stroke="#fca5a5" stroke-width="1" fill="none" opacity="0.7"/>
        </svg>
      </div>
    `;

    const icon = L.divIcon({
      className: 'custom-motoboy-pin',
      html,
      iconSize: [60, 60],
      iconAnchor: [30, 30],
    });

    if (courierMarkerRef.current) {
      courierMarkerRef.current.setLatLng([courierLocation.latitude, courierLocation.longitude]);
    } else {
      courierMarkerRef.current = L.marker([courierLocation.latitude, courierLocation.longitude], {
        icon,
        zIndexOffset: 1000,
      }).addTo(mapInstanceRef.current);
    }
  }, [courierLocation, mapReady]);

  // Update Destination Marker (Casinha Vermelha com Etiqueta do Bairro)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as unknown as { L: any }).L;
    if (!L) return;

    if (!destinationLocation) {
      if (destMarkerRef.current) {
        destMarkerRef.current.remove();
        destMarkerRef.current = null;
      }
      return;
    }

    const neighborhoodLabel = destinationNeighborhood || (destinationTitle ? destinationTitle.split(',')[0] : '');

    const html = `
      <div class="relative flex flex-col items-center cursor-pointer transition-transform duration-300 hover:scale-110" style="transform: translate(-50%, -100%);">
        ${
          neighborhoodLabel
            ? `<div class="mb-1 whitespace-nowrap rounded-lg bg-[#0b0f19]/95 px-2.5 py-1 text-[11px] font-black text-white shadow-xl border border-red-500/40 backdrop-blur-md tracking-wide">
                📍 ${neighborhoodLabel}
               </div>`
            : ''
        }
        <!-- Red destination pin with house icon -->
        <div class="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-red-600 to-red-500 text-white shadow-[0_6px_18px_rgba(234,29,44,0.6)] ring-4 ring-red-500/30 border border-white/20">
          <svg class="h-6 w-6 fill-current drop-shadow-sm" viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </div>
        <div class="h-2.5 w-2.5 rotate-45 -mt-1.5 bg-red-600 shadow-md"></div>
        <div class="h-2 w-9 rounded-full bg-black/50 blur-[2px] mt-0.5"></div>
      </div>
    `;

    const icon = L.divIcon({
      className: 'custom-dest-pin',
      html,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    if (destMarkerRef.current) {
      destMarkerRef.current.setLatLng([destinationLocation.latitude, destinationLocation.longitude]);
    } else {
      destMarkerRef.current = L.marker([destinationLocation.latitude, destinationLocation.longitude], {
        icon,
        zIndexOffset: 800,
      }).addTo(mapInstanceRef.current);
    }
  }, [destinationLocation, destinationNeighborhood, destinationTitle, mapReady]);

  // Calculate & Draw Road Polyline (OSRM com traçado pelas ruas e linha azul neon)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as unknown as { L: any }).L;
    if (!L) return;

    if (!courierLocation || !destinationLocation || !showRoute) {
      if (routePolylineRef.current) {
        routePolylineRef.current.remove();
        routePolylineRef.current = null;
      }
      if (routeGlowPolylineRef.current) {
        routeGlowPolylineRef.current.remove();
        routeGlowPolylineRef.current = null;
      }
      setRouteInfo(null);
      return;
    }

    let active = true;
    const url = `https://router.project-osrm.org/route/v1/driving/${courierLocation.longitude},${courierLocation.latitude};${destinationLocation.longitude},${destinationLocation.latitude}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const applyRoute = (latlngs: Array<[number, number]>, dist: number, dur: number) => {
      if (!active || !mapInstanceRef.current) return;

      if (routeGlowPolylineRef.current) routeGlowPolylineRef.current.remove();
      if (routePolylineRef.current) routePolylineRef.current.remove();

      // Outer glowing cyan halo
      routeGlowPolylineRef.current = L.polyline(latlngs, {
        color: '#38bdf8',
        weight: 10,
        opacity: 0.35,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapInstanceRef.current);

      // Core electric cyan/blue line
      routePolylineRef.current = L.polyline(latlngs, {
        color: '#0284c7',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapInstanceRef.current);

      const info = { distanceKm: dist, durationMin: dur };
      setRouteInfo(info);
      onRouteCalculated?.(info);

      try {
        const bounds = L.latLngBounds(latlngs);
        mapInstanceRef.current.fitBounds(bounds, {
          paddingTopLeft: [50, 50],
          paddingBottomRight: [50, 140],
          maxZoom: 16,
        });
      } catch {
        // Ignore map fitting errors if the route bounds cannot be calculated.
      }
    };

    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        clearTimeout(timeout);
        if (!active || !mapInstanceRef.current) return;

        let latlngs: Array<[number, number]> = [];
        let dist = 0;
        let dur = 0;

        if (data && data.code === 'Ok' && data.routes && data.routes[0]) {
          const route = data.routes[0];
          dist = Number((route.distance / 1000).toFixed(1));
          dur = Math.max(1, Math.round(route.duration / 60));
          latlngs = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
        } else {
          // Fallback straight / intermediate line
          latlngs = [
            [courierLocation.latitude, courierLocation.longitude],
            [destinationLocation.latitude, destinationLocation.longitude],
          ];
          const rad = (n: number) => (n * Math.PI) / 180;
          const dLat = rad(destinationLocation.latitude - courierLocation.latitude);
          const dLon = rad(destinationLocation.longitude - courierLocation.longitude);
          const x =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(courierLocation.latitude)) * Math.cos(rad(destinationLocation.latitude)) * Math.sin(dLon / 2) ** 2;
          dist = Number((6371 * 2 * Math.asin(Math.sqrt(x))).toFixed(1));
          dur = Math.max(2, Math.round(dist * 2.5));
        }

        applyRoute(latlngs, dist, dur);
      })
      .catch(() => {
        if (!active || !mapInstanceRef.current) return;
        const latlngs: Array<[number, number]> = [
          [courierLocation.latitude, courierLocation.longitude],
          [destinationLocation.latitude, destinationLocation.longitude],
        ];
        const rad = (n: number) => (n * Math.PI) / 180;
        const dLat = rad(destinationLocation.latitude - courierLocation.latitude);
        const dLon = rad(destinationLocation.longitude - courierLocation.longitude);
        const x =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(rad(courierLocation.latitude)) * Math.cos(rad(destinationLocation.latitude)) * Math.sin(dLon / 2) ** 2;
        const dist = Number((6371 * 2 * Math.asin(Math.sqrt(x))).toFixed(1));
        const dur = Math.max(2, Math.round(dist * 2.5));
        applyRoute(latlngs, dist, dur);
      });

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [courierLocation?.latitude, courierLocation?.longitude, destinationLocation?.latitude, destinationLocation?.longitude, mapReady, showRoute]);

  // Center on courier
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    onRequestLocation?.();
    if (courierLocation) {
      mapInstanceRef.current.flyTo([courierLocation.latitude, courierLocation.longitude], 16, {
        duration: 0.8,
      });
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const handleOpenWaze = () => {
    if (!destinationLocation) return;
    const { latitude, longitude } = destinationLocation;
    window.open(`https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`relative overflow-hidden bg-[#0a0f18] ${className}`}>
      {/* Map Canvas */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Top Floating ETA Badge */}
      {showRoute && routeInfo && routeInfo.durationMin > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[400] -translate-x-1/2">
          <div className="flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-[#0b0f19]/90 px-3.5 py-1.5 text-xs font-black text-sky-300 shadow-2xl backdrop-blur-md">
            <span className="h-2 w-2 animate-ping rounded-full bg-sky-400" />
            <span>~{routeInfo.durationMin} min</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-200">{routeInfo.distanceKm} km</span>
          </div>
        </div>
      )}

      {/* Floating Zoom Controls (Top Right) */}
      <div className="absolute right-3.5 top-3.5 z-[400] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Aproximar mapa"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-[#0e1422]/90 text-white shadow-xl backdrop-blur-md transition active:scale-95 hover:bg-slate-800"
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Afastar mapa"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-[#0e1422]/90 text-white shadow-xl backdrop-blur-md transition active:scale-95 hover:bg-slate-800"
        >
          <Minus size={18} />
        </button>
      </div>

      {/* Floating Minha Localização (posicionado no topo para nunca colidir com a barrinha inferior) */}
      {showLocationPill && (
        <div className="absolute top-3.5 left-3.5 z-[400]">
          <button
            type="button"
            onClick={handleRecenter}
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-[#0e1422]/90 px-3.5 py-2 text-xs font-bold text-white shadow-2xl backdrop-blur-md transition active:scale-95 hover:bg-slate-800"
          >
            <Crosshair size={15} className="text-sky-400" />
            <span>Minha localização</span>
          </button>
        </div>
      )}

      {/* Floating Bottom Right: Waze Navigation Button */}
      {showWazeButton && destinationLocation && (
        <div className="absolute bottom-4 right-3.5 z-[400]">
          <button
            type="button"
            onClick={handleOpenWaze}
            title="Navegar no Waze"
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-sky-400/40 bg-gradient-to-tr from-sky-600 to-sky-400 text-white shadow-[0_4px_16px_rgba(2,132,199,0.5)] transition active:scale-95 hover:scale-105"
          >
            {/* Waze Icon SVG */}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12.003 2.005c-5.523 0-10 4.477-10 10 0 1.821.488 3.53 1.34 5.006L2 21.995l5.148-1.328a9.96 9.96 0 0 0 4.855 1.338c5.523 0 10-4.477 10-10s-4.477-10-10-10zm-3 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm6 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm-6.5 5.5c.8-1 2-1.5 3.5-1.5s2.7.5 3.5 1.5a.75.75 0 1 1-1.18.94c-.54-.68-1.36-.94-2.32-.94-.96 0-1.78.26-2.32.94a.75.75 0 0 1-1.18-.94z"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
