"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Map as MapboxMap, Marker } from "mapbox-gl";
import type { PeerDot } from "@/lib/types";
import { dotColor } from "@/lib/color";

// No placeholder fallback: a fake token fails silently and hides the setup hint below.
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function WorldMap({
  peers,
  me,
  onPeerClick,
  canConnect,
  spinning,
}: {
  peers: PeerDot[];
  me: { lat: number; lng: number } | null;
  onPeerClick: (id: string) => void;
  canConnect: boolean;
  spinning: boolean; // slow idle rotation behind the entry screen
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const meMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  // Marker click handlers are bound once, so read the live click handler +
  // connectability through refs (synced in an effect, never during render).
  const onPeerClickRef = useRef(onPeerClick);
  const canConnectRef = useRef(canConnect);
  useEffect(() => {
    onPeerClickRef.current = onPeerClick;
    canConnectRef.current = canConnect;
  });

  // Initialise the map once.
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    const markers = markersRef.current;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe",
        center: [100, 15],
        zoom: 1.6,
        attributionControl: true,
      });
      map.on("style.load", () => {
        // Night-sky atmosphere around the globe.
        map.setFog({
          color: "rgb(14, 17, 30)",
          "high-color": "rgb(40, 34, 90)",
          "horizon-blend": 0.08,
          "space-color": "rgb(7, 9, 16)",
          "star-intensity": 0.4,
        });
      });
      map.on("load", () => {
        if (!cancelled) setReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      markers.clear();
      meMarkerRef.current?.remove();
      meMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Spin the globe slowly while the entry screen is up.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !spinning) return;
    let frame = 0;
    const spin = () => {
      const center = map.getCenter();
      center.lng -= 0.04;
      map.jumpTo({ center });
      frame = requestAnimationFrame(spin);
    };
    frame = requestAnimationFrame(spin);
    return () => cancelAnimationFrame(frame);
  }, [ready, spinning]);

  // Once we know where the user is, fly down to them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    map.flyTo({ center: [me.lng, me.lat], zoom: 4, duration: 2800, essential: true });
  }, [me, ready]);

  // Show / move the user's own "you are here" pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !me) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      if (!meMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "pulse-me";
        el.title = "You (only you see this spot; others see your dot 1–3 km away)";
        el.innerHTML = `<span class="pulse-me-label">You</span>`;
        meMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([me.lng, me.lat])
          .addTo(map);
      } else {
        meMarkerRef.current.setLngLat([me.lng, me.lat]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me, ready]);

  // Reconcile markers whenever the peer list changes (or the map becomes ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled) return;
      const markers = markersRef.current;
      const seen = new Set<string>();

      for (const peer of peers) {
        seen.add(peer.id);
        let marker = markers.get(peer.id);
        if (!marker) {
          // Mapbox positions the marker element with a transform, so all the
          // styling (and the hover scale) lives on an inner span.
          const el = document.createElement("button");
          el.className = "pulse-dot";
          el.style.color = dotColor(peer.id);
          el.setAttribute("aria-label", "Connect with this stranger");
          el.innerHTML = `<span class="pulse-dot-core"></span>`;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (canConnectRef.current) onPeerClickRef.current(peer.id);
          });
          marker = new mapboxgl.Marker({ element: el })
            .setLngLat([peer.lng, peer.lat])
            .addTo(map);
          markers.set(peer.id, marker);
        }
        const el = marker.getElement();
        el.classList.toggle("is-busy", peer.busy);
        el.title = peer.busy ? "In a conversation" : "Tap to say hi";
      }

      // Drop markers for peers that went offline / got filtered out.
      for (const [id, marker] of markers) {
        if (!seen.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [peers, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full bg-ink" />

      {!TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="max-w-md rounded-lg bg-zinc-800 p-4 text-sm text-zinc-200">
            Set{" "}
            <code className="text-emerald-400">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
            <code>.env</code> to load the map.
          </p>
        </div>
      )}
    </div>
  );
}
