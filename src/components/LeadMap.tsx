import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Lead } from '../types';
import { MapPin } from 'lucide-react';

// Fix Leaflet's default icon path issues with Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LeadMapProps {
  leads: Lead[];
}

interface GeocodedLead extends Lead {
  lat?: number;
  lng?: number;
}

export default function LeadMap({ leads }: LeadMapProps) {
  const [geocodedLeads, setGeocodedLeads] = useState<GeocodedLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simple geocoding using Nominatim (OpenStreetMap)
    // Warning: Nominatim has usage limits (1 req/sec). For production, use a dedicated geocoding service.
    const geocodeLeads = async () => {
      setLoading(true);
      const results: GeocodedLead[] = [];
      
      for (const lead of leads) {
        if (!lead.address || lead.address.trim() === '') {
          results.push(lead);
          continue;
        }

        try {
          // Delay to respect rate limits
          await new Promise(r => setTimeout(r, 1000));
          
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=\${encodeURIComponent(lead.address)}`);
          const data = await response.json();
          
          if (data && data.length > 0) {
            results.push({
              ...lead,
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon)
            });
          } else {
            results.push(lead);
          }
        } catch (e) {
          console.error("Geocoding failed for", lead.address, e);
          results.push(lead);
        }
      }
      
      setGeocodedLeads(results);
      setLoading(false);
    };

    if (leads.length > 0) {
      geocodeLeads();
    } else {
      setGeocodedLeads([]);
      setLoading(false);
    }
  }, [leads]);

  const mapCenter: [number, number] = [20.5937, 78.9629]; // Default to India, or average of coords
  const zoomLevel = 4;

  const validLeads = geocodedLeads.filter(l => l.lat !== undefined && l.lng !== undefined);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 overflow-hidden flex flex-col h-[500px]">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-indigo-500" />
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Lead Map</h3>
      </div>
      
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Geocoding addresses...</p>
          <p className="text-xs mt-2 text-center max-w-md">Note: Using free public geocoding which may be slow to respect rate limits.</p>
        </div>
      ) : (
        <div className="flex-1 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 relative z-0">
          <MapContainer center={mapCenter} zoom={zoomLevel} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {validLeads.map((lead) => (
              <Marker key={lead.id} position={[lead.lat!, lead.lng!]}>
                <Popup>
                  <div className="text-sm">
                    <strong className="block text-base mb-1">{lead.clientName}</strong>
                    <div className="text-zinc-600 mb-1">{lead.contact}</div>
                    <div className="text-zinc-500 text-xs mb-2">{lead.address}</div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-600">
                      {lead.status}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
