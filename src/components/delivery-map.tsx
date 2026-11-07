import { useEffect, useRef, useState } from 'react';
import { Crosshair, Minus, Plus, Navigation } from 'lucide-react';

export type GeoPoint = { latitude: number; longitude: number };

export interface DeliveryMapProps {
  courierLocation: GeoPoint | null;
  destinationLocation?: GeoPoint | null;
  destinationTitle?: string;
  destinationNeighborhood?: string;
  className?: string;
  interactive?: boolean;
  showWazeButton?: boolean;
  onRouteCalculated?: (info: { distanceKm: number; durationMin: number }) => void;
  onRequestLocation?: () => void;
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
  showWazeButton = true,
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

  // Initialize Leaflet Map
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

        // Dark Matter tiles (CartoDB) - Dark theme match
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png', {
          subdomains: 'abcd',
          maxZoom: 19,
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

  // Update Courier Marker
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
      <div class="relative flex items-center justify-center" style="width: 58px; height: 58px;">
        <!-- Forward light beam -->
        <div class="absolute -top-3 w-10 h-10 pointer-events-none opacity-60" style="background: radial-gradient(circle at 50% 100%, rgba(56,189,248,0.7) 0%, rgba(2,132,199,0.1) 70%, transparent 100%); clip-path: polygon(25% 0%, 75% 0%, 100% 100%, 0% 100%);"></div>
        <!-- Pulse ring -->
        <span class="absolute w-12 h-12 rounded-full bg-sky-500/30 animate-ping"></span>
        <span class="absolute w-10 h-10 rounded-full border border-sky-400 bg-sky-500/20 shadow-[0_0_15px_rgba(56,189,248,0.6)]"></span>
        
        <!-- Motoboy 3D Avatar (Red helmet, red backpack/mochila Tia Val) -->
        <svg viewBox="0 0 64 64" width="46" height="46" class="relative z-10 drop-shadow-md">
          <!-- Scooter rear tire -->
          <rect x="29" y="47" width="6" height="10" rx="3" fill="#0f172a" stroke="#334155" stroke-width="1"/>
          <!-- Mudguard -->
          <path d="M26 45 Q32 41 38 45" stroke="#1e293b" stroke-width="3" fill="none"/>
          <!-- Red Tail light glow -->
          <rect x="28" y="43" width="8" height="3" rx="1.5" fill="#ef4444" style="filter: drop-shadow(0 0 4px #ef4444);"/>
          <!-- Scooter Chassis -->
          <ellipse cx="32" cy="38" rx="11" ry="6" fill="#dc2626" stroke="#991b1b" stroke-width="1"/>
          
          <!-- Mirrors -->
          <circle cx="18" cy="21" r="2.2" fill="#94a3b8" stroke="#0f172a" stroke-width="1"/>
          <circle cx="46" cy="21" r="2.2" fill="#94a3b8" stroke="#0f172a" stroke-width="1"/>
          <line x1="22" y1="25" x2="18" y2="21" stroke="#475569" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="42" y1="25" x2="46" y2="21" stroke="#475569" stroke-width="1.8" stroke-linecap="round"/>
          
          <!-- Driver shoulders -->
          <path d="M20 34 C20 27 44 27 44 34 Z" fill="#1e293b"/>
          
          <!-- Thermal Delivery Bag (Mochila Vermelha estilo iFood) -->
          <rect x="22" y="24" width="20" height="15" rx="3.5" fill="#ef4444" stroke="#b91c1c" stroke-width="1.2"/>
          <!-- Handle -->
          <path d="M28 24 C28 22 36 22 36 24" fill="none" stroke="#7f1d1d" stroke-width="1.5"/>
          <!-- Reflective stripe -->
          <rect x="24" y="30" width="16" height="3" rx="1" fill="#f8fafc" opacity="0.95"/>
          <rect x="24" y="35" width="16" height="1" fill="#991b1b"/>
          
          <!-- Helmet seen from rear/top -->
          <ellipse cx="32" cy="18" rx="8" ry="8.5" fill="#ef4444" stroke="#991b1b" stroke-width="1.2"/>
          <!-- 3D Gloss highlight -->
          <ellipse cx="29" cy="15" rx="3.5" ry="2" fill="#fecaca" opacity="0.7"/>
          <!-- Visor border -->
          <path d="M25 19 Q32 22 39 19" stroke="#0f172a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        </svg>
      </div>
    `;

    const icon = L.divIcon({
      className: 'custom-courier-pin',
      html,
      iconSize: [58, 58],
      iconAnchor: [29, 29],
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

  // Update Destination Marker
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
      <div class="relative flex flex-col items-center" style="transform: translate(-50%, -100%);">
        ${
          neighborhoodLabel
            ? `<div class="mb-1 whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-0.5 text-[11px] font-black text-white shadow-lg border border-white/20 backdrop-blur-sm tracking-wide">
                ${neighborhoodLabel}
               </div>`
            : ''
        }
        <div class="relative flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_4px_12px_rgba(220,38,38,0.5)] ring-4 ring-red-500/30">
          <svg class="h-5 w-5 fill-current" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        </div>
        <div class="h-2 w-2 rotate-45 -mt-1 bg-red-600 shadow-md"></div>
        <div class="h-2 w-8 rounded-full bg-black/40 blur-[2px] mt-0.5"></div>
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

  // Calculate & Draw Road Polyline (OSRM)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const L = (window as unknown as { L: any }).L;
    if (!L) return;

    if (!courierLocation || !destinationLocation) {
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
          // GeoJSON is [lon, lat] -> Leaflet wants [lat, lon]
          latlngs = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
        } else {
          // Fallback line
          latlngs = [
            [courierLocation.latitude, courierLocation.longitude],
            [destinationLocation.latitude, destinationLocation.longitude],
          ];
        }

        if (routeGlowPolylineRef.current) routeGlowPolylineRef.current.remove();
        if (routePolylineRef.current) routePolylineRef.current.remove();

        // Blue glow outer line
        routeGlowPolylineRef.current = L.polyline(latlngs, {
          color: '#38bdf8',
          weight: 9,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(mapInstanceRef.current);

        // Core blue route line
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

        // Fit map bounds to view both points nicely
        try {
          const bounds = L.latLngBounds(latlngs);
          mapInstanceRef.current.fitBounds(bounds, {
            paddingTopLeft: [40, 40],
            paddingBottomRight: [40, 120],
            maxZoom: 16,
          });
        } catch {}
      })
      .catch(() => {
        // Fallback straight line
        if (!active || !mapInstanceRef.current) return;
        const latlngs: Array<[number, number]> = [
          [courierLocation.latitude, courierLocation.longitude],
          [destinationLocation.latitude, destinationLocation.longitude],
        ];
        if (routeGlowPolylineRef.current) routeGlowPolylineRef.current.remove();
        if (routePolylineRef.current) routePolylineRef.current.remove();

        routeGlowPolylineRef.current = L.polyline(latlngs, {
          color: '#38bdf8',
          weight: 7,
          opacity: 0.3,
        }).addTo(mapInstanceRef.current);

        routePolylineRef.current = L.polyline(latlngs, {
          color: '#0284c7',
          weight: 4,
          opacity: 0.9,
        }).addTo(mapInstanceRef.current);
      });

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [courierLocation?.latitude, courierLocation?.longitude, destinationLocation?.latitude, destinationLocation?.longitude, mapReady]);

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

      {/* Top Floating ETA Badge (when route is ready) */}
      {routeInfo && routeInfo.durationMin > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-[400] -translate-x-1/2">
          <div className="flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-slate-900/90 px-3.5 py-1.5 text-xs font-black text-sky-300 shadow-xl backdrop-blur-md">
            <span className="h-2 w-2 animate-ping rounded-full bg-sky-400" />
            <span>~{routeInfo.durationMin} min</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-200">{routeInfo.distanceKm} km</span>
          </div>
        </div>
      )}

      {/* Floating Zoom Controls (Top Right) */}
      <div className="absolute right-3 top-3 z-[400] flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Aproximar mapa"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-900/80 text-white shadow-lg backdrop-blur-md transition active:scale-95 hover:bg-slate-800"
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Afastar mapa"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-slate-900/80 text-white shadow-lg backdrop-blur-md transition active:scale-95 hover:bg-slate-800"
        >
          <Minus size={18} />
        </button>
      </div>

      {/* Floating Bottom Left: Minha Localização */}
      <div className="absolute bottom-4 left-3 z-[400]">
        <button
          type="button"
          onClick={handleRecenter}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-900/85 px-3 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md transition active:scale-95 hover:bg-slate-800"
        >
          <Crosshair size={15} className="text-sky-400" />
          <span>Minha localização</span>
        </button>
      </div>

      {/* Floating Bottom Right: Waze Navigation Button */}
      {showWazeButton && destinationLocation && (
        <div className="absolute bottom-4 right-3 z-[400]">
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
