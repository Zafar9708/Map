import React, { useState, useEffect, useRef } from 'react';
import Map, { Marker, Popup, Source, Layer } from 'react-map-gl';
import axios from 'axios';
import 'mapbox-gl/dist/mapbox-gl.css';
import './WorldMap.css';

const NavigationDemo = () => {
  const MAPBOX_TOKEN = 'pk.eyJ1IjoiemFmYXI5NzA4IiwiYSI6ImNtZmR1M3ZqNTAxZDEyanByYXlyMmJ3bmgifQ.9eJXoUDbQBwe44P7TxfHdA';

  // State management
  const [viewState, setViewState] = useState({
    longitude: 77.2315,
    latitude: 28.6562,
    zoom: 10,
    pitch: 45,
    bearing: 0
  });
  
  const [currentLocation, setCurrentLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [route, setRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const mapRef = useRef();

  // Detect user's current location
  useEffect(() => {
    setIsLoading(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({
            name: "Your Current Location",
            coordinates: [longitude, latitude]
          });
          setIsLoading(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setError("Unable to retrieve your location. Using Delhi as default.");
          setCurrentLocation({
            name: "Default Location (Delhi)",
            coordinates: [77.2090, 28.5275]
          });
          setIsLoading(false);
        }
      );
    } else {
      setError("Geolocation is not supported by this browser.");
      setCurrentLocation({
        name: "Default Location (Delhi)",
        coordinates: [77.2090, 28.5275]
      });
      setIsLoading(false);
    }
  }, []);

  // Search for locations
  const handleSearch = async (query) => {
    if (!query) return;
    
    try {
      const response = await axios.get(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
        {
          params: {
            access_token: MAPBOX_TOKEN,
            proximity: currentLocation ? currentLocation.coordinates.join(',') : '77.2090,28.5275',
            limit: 5
          }
        }
      );
      
      setSearchResults(response.data.features);
      setShowSearchResults(true);
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to search for location");
    }
  };

  // Set destination from search result
  const setDestinationFromResult = (result) => {
    const [longitude, latitude] = result.center;
    const newDestination = {
      name: result.place_name,
      coordinates: [longitude, latitude]
    };
    
    setDestination(newDestination);
    setSearchQuery(result.place_name);
    setShowSearchResults(false);
    
    // Calculate route
    calculateRoute(newDestination);
  };

  // Calculate route to destination
  const calculateRoute = async (dest) => {
    if (!currentLocation) return;
    
    setIsLoading(true);
    try {
      const response = await axios.get(
        `https://api.mapbox.com/directions/v5/mapbox/driving/` +
        `${currentLocation.coordinates[0]},${currentLocation.coordinates[1]};` +
        `${dest.coordinates[0]},${dest.coordinates[1]}?` +
        `access_token=${MAPBOX_TOKEN}&geometries=geojson`
      );
      
      if (response.data.routes && response.data.routes.length > 0) {
        setRoute({
          type: 'Feature',
          geometry: response.data.routes[0].geometry
        });
        
        // Adjust view to show the entire route
        const coords = response.data.routes[0].geometry.coordinates;
        
        if (mapRef.current) {
          // Calculate bounding box manually
          let minLng = Infinity, minLat = Infinity;
          let maxLng = -Infinity, maxLat = -Infinity;
          
          coords.forEach(coord => {
            minLng = Math.min(minLng, coord[0]);
            minLat = Math.min(minLat, coord[1]);
            maxLng = Math.max(maxLng, coord[0]);
            maxLat = Math.max(maxLat, coord[1]);
          });
          
          // Add some padding
          const padding = 0.01;
          const bounds = [
            [minLng - padding, minLat - padding],
            [maxLng + padding, maxLat + padding]
          ];
          
          mapRef.current.fitBounds(bounds, {
            padding: 100,
            pitch: 45,
            essential: true
          });
        }
      }
    } catch (err) {
      console.error("Route calculation error:", err);
      setError("Failed to calculate route");
      
      // Fallback to straight line if API fails
      setRoute({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [currentLocation.coordinates, dest.coordinates]
        }
      });
    }
    setIsLoading(false);
  };

  // Handle map load
  const handleMapLoad = (event) => {
    mapRef.current = event.target;
  };

  // Reset map view
  const resetView = () => {
    if (currentLocation && destination && mapRef.current) {
      const coords = [currentLocation.coordinates, destination.coordinates];
      
      // Calculate bounding box manually
      let minLng = Infinity, minLat = Infinity;
      let maxLng = -Infinity, maxLat = -Infinity;
      
      coords.forEach(coord => {
        minLng = Math.min(minLng, coord[0]);
        minLat = Math.min(minLat, coord[1]);
        maxLng = Math.max(maxLng, coord[0]);
        maxLat = Math.max(maxLat, coord[1]);
      });
      
      // Add some padding
      const padding = 0.01;
      const bounds = [
        [minLng - padding, minLat - padding],
        [maxLng + padding, maxLat + padding]
      ];
      
      mapRef.current.fitBounds(bounds, {
        padding: 100,
        pitch: 45,
        essential: true
      });
    }
  };

  return (
    <div className="navigation-demo">
      {/* Header */}
      <header className="demo-header">
        <p>Real-time routing from your current location to any destination</p>
      </header>

      {/* Main content */}
      <div className="demo-content">
        {/* Search panel */}
        <div className="search-panel">
          <div className="search-box">
            <h3>Find Destination</h3>
            <div className="search-input-container">
              <input
                type="text"
                placeholder="Search destination..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              />
              <button onClick={() => handleSearch(searchQuery)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {showSearchResults && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((result, index) => (
                  <div 
                    key={index} 
                    className="search-result-item"
                    onClick={() => setDestinationFromResult(result)}
                  >
                    {result.place_name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {currentLocation && (
            <div className="location-info">
              <h4>Current Location</h4>
              <p>{currentLocation.name}</p>
            </div>
          )}

          {destination && (
            <div className="location-info">
              <h4>Destination</h4>
              <p>{destination.name}</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="action-buttons">
            <button onClick={resetView} disabled={!destination}>
              Reset View
            </button>
            <button onClick={() => setDestination(null)} disabled={!destination}>
              Clear
            </button>
          </div>
        </div>

        {/* Map container */}
        <div className="map-container">
          {isLoading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <p>Loading map...</p>
            </div>
          )}

          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            onLoad={handleMapLoad}
            style={{ width: '100%', height: '100%' }}
            mapStyle="mapbox://styles/mapbox/streets-v11"
          >
            {/* Current location marker */}
            {currentLocation && (
              <Marker
                longitude={currentLocation.coordinates[0]}
                latitude={currentLocation.coordinates[1]}
              >
                <div 
                  className="marker current-marker"
                  onMouseEnter={() => setHoverInfo(currentLocation)}
                  onMouseLeave={() => setHoverInfo(null)}
                ></div>
              </Marker>
            )}

            {/* Destination marker */}
            {destination && (
              <Marker
                longitude={destination.coordinates[0]}
                latitude={destination.coordinates[1]}
              >
                <div 
                  className="marker destination-marker"
                  onMouseEnter={() => setHoverInfo(destination)}
                  onMouseLeave={() => setHoverInfo(null)}
                ></div>
              </Marker>
            )}

            {/* Route visualization */}
            {route && (
              <Source id="route" type="geojson" data={route}>
                <Layer
                  id="route-line"
                  type="line"
                  layout={{
                    'line-join': 'round',
                    'line-cap': 'round'
                  }}
                  paint={{
                    'line-color': '#4ecdc4',
                    'line-width': 4
                    // Removed line-dasharray to make it a solid line
                  }}
                />
              </Source>
            )}

            {/* Hover popup */}
            {hoverInfo && (
              <Popup
                longitude={hoverInfo.coordinates[0]}
                latitude={hoverInfo.coordinates[1]}
                anchor="top"
                closeButton={false}
                closeOnClick={false}
              >
                <div className="popup-content">
                  <h4>{hoverInfo.name}</h4>
                  <p>{hoverInfo.coordinates[0].toFixed(4)}, {hoverInfo.coordinates[1].toFixed(4)}</p>
                </div>
              </Popup>
            )}
          </Map>
        </div>
      </div>
    </div>
  );
};

export default NavigationDemo;