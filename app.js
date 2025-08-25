// Harita başlat - başlangıç konumu Türkiye
const map = L.map('map').setView([40.09915,33.45236],18);
// Yüksek çözünürlüklü base map
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 20,
  attribution: 'Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS'
}).addTo(map);

// Mevcut sınır katmanı referansı
let currentBoundsLayer = null;
let currentImageOverlays = []; // Array olarak değiştirdik
let manualSelectionMode = false;
let clickedPoints = [];
let currentBounds = null;
let tempMarkers = [];
let georaster = null;

const debugLog = (msg, type='info') => {
  const div = document.createElement('div');
  div.className = `log ${type}`;
  div.innerHTML = `<strong>[${new Date().toLocaleTimeString()}]</strong> ${msg}`;
  const logsContainer = document.getElementById('logs');
  logsContainer.appendChild(div);
  logsContainer.scrollTop = logsContainer.scrollHeight;
  console.log(`[${type.toUpperCase()}] ${msg}`);
};

// Manuel seçim modunu aktif/pasif et
function toggleManualMode() {
    manualSelectionMode = !manualSelectionMode;
    const toggleBtn = document.getElementById('toggleModeBtn');
    const clearSelectionBtn = document.getElementById('clearSelectionBtn');
    const clickInstructions = document.getElementById('clickInstructions');
    
    if (manualSelectionMode) {
        toggleBtn.textContent = 'Görünür Alan Moduna Geç';
        toggleBtn.classList.add('active');
        clearSelectionBtn.style.display = 'block';
        clickInstructions.style.display = 'block';
        map.getContainer().style.cursor = 'crosshair';
        debugLog('Manuel alan seçimi aktif - Haritaya tıklayarak alan seçin', 'info');
    } else {
        toggleBtn.textContent = 'Manuel Alan Seçimi Aktif Et';
        toggleBtn.classList.remove('active');
        clearSelectionBtn.style.display = 'none';
        clickInstructions.style.display = 'none';
        map.getContainer().style.cursor = '';
        clearSelection();
        getCurrentBounds(); // Görünür alanı güncelle
        debugLog('Görünür alan modu aktif', 'info');
    }
}

// Seçimi temizle
function clearSelection() {
    // Tıklanan noktaları temizle
    clickedPoints = [];
    
    // Geçici markerları kaldır
    tempMarkers.forEach(marker => map.removeLayer(marker));
    tempMarkers = [];
    
    // Bounds bilgisini güncelle
    if (manualSelectionMode) {
        document.getElementById('boundsInfo').innerHTML = `
            <strong>Manuel Alan Seçimi:</strong><br>
            Tıklanan nokta sayısı: 0
        `;
    }
}

// ESC tuşu ile iptal
function onKeyDown(e) {
    if (e.key === 'Escape' && manualSelectionMode) {
        clearSelection();
        debugLog('Seçim iptal edildi', 'warning');
    }
}

// Ekran sınırlarını al ve göster
function getCurrentBounds() {
  const bounds = map.getBounds();
  const bbox = [
    bounds.getWest(),  // minLng
    bounds.getSouth(), // minLat  
    bounds.getEast(),  // maxLng
    bounds.getNorth()  // maxLat
  ];

  // Bounds objesini güncelle
  currentBounds = [
    [bounds.getSouth(), bounds.getWest()], // SW
    [bounds.getNorth(), bounds.getEast()]  // NE
  ];

  // Sınır bilgisini güncelle
  document.getElementById('boundsInfo').innerHTML = `
    <strong>Mevcut Görünür Alan:</strong><br>
    SW: ${bounds.getSouth().toFixed(4)}, ${bounds.getWest().toFixed(4)}<br>
    NE: ${bounds.getNorth().toFixed(4)}, ${bounds.getEast().toFixed(4)}
  `;

  // Mevcut sınırları haritada göster
  if (currentBoundsLayer) {
    map.removeLayer(currentBoundsLayer);
  }

  currentBoundsLayer = L.rectangle([
    [bounds.getSouth(), bounds.getWest()],
    [bounds.getNorth(), bounds.getEast()]
  ], {
    color: '#ff0000',
    weight: 2,
    fillOpacity: 0.1,
    dashArray: '5, 5'
  }).addTo(map);

  debugLog(`Ekran sınırları güncellendi: [${bbox.map(b => b.toFixed(4)).join(', ')}]`, 'info');
  
  return bbox;
}

// Harita hareket ettiğinde sınırları güncelle
map.on('moveend', getCurrentBounds);
map.on('zoomend', getCurrentBounds);

// Harita tıklama olayı
function onMapClick(e) {
    if (!manualSelectionMode) return;
    
    const { lat, lng } = e.latlng;
    clickedPoints.push([lat, lng]);
    
    // Marker ekle
    const marker = L.circleMarker([lat, lng], {
        color: '#ff0000',
        fillColor: '#ff0000',
        fillOpacity: 0.8,
        radius: 8
    }).addTo(map);
    
    tempMarkers.push(marker);
    
    debugLog(`Nokta ${clickedPoints.length}: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'info');
    
    if (clickedPoints.length === 1) {
        document.getElementById('boundsInfo').innerHTML = `
            <strong>Manuel Alan Seçimi:</strong><br>
            1. Nokta: ${lat.toFixed(4)}, ${lng.toFixed(4)}<br>
            İkinci köşeyi seçin...
        `;
    } else if (clickedPoints.length === 2) {
        // İki nokta seçildi, dikdörtgen oluştur
        const point1 = clickedPoints[0];
        const point2 = clickedPoints[1];
        
        // Min/Max koordinatları hesapla
        const minLat = Math.min(point1[0], point2[0]);
        const maxLat = Math.max(point1[0], point2[0]);
        const minLng = Math.min(point1[1], point2[1]);
        const maxLng = Math.max(point1[1], point2[1]);
        
        // Bounds oluştur
        currentBounds = [[minLat, minLng], [maxLat, maxLng]];
        
        // Mevcut bounds katmanını kaldır
        if (currentBoundsLayer) {
            map.removeLayer(currentBoundsLayer);
        }
        
        // Yeni bounds katmanı ekle
        currentBoundsLayer = L.rectangle(currentBounds, {
            color: '#00ff00',
            weight: 3,
            fillOpacity: 0.1,
            dashArray: '5, 5'
        }).addTo(map);
        
        // Bilgileri güncelle
        document.getElementById('boundsInfo').innerHTML = `
            <strong>Seçilen Alan:</strong><br>
            SW: ${minLat.toFixed(4)}, ${minLng.toFixed(4)}<br>
            NE: ${maxLat.toFixed(4)}, ${maxLng.toFixed(4)}
        `;
        
        debugLog(`Alan seçildi: [${minLng.toFixed(4)}, ${minLat.toFixed(4)}, ${maxLng.toFixed(4)}, ${maxLat.toFixed(4)}]`, 'success');
        
        // Markerları temizle (dikdörtgen zaten gösteriyor)
        tempMarkers.forEach(marker => map.removeLayer(marker));
        tempMarkers = [];
        
        // Tıklanan noktaları sıfırla
        clickedPoints = [];
    }
}

// Bbox'u hesapla (hem manuel hem görünür alan için)
function getBboxFromBounds() {
    if (!currentBounds) {
        throw new Error('Sınır bilgisi bulunamadı');
    }
    
    return [
        currentBounds[0][1], // minLng (SW lng)
        currentBounds[0][0], // minLat (SW lat)
        currentBounds[1][1], // maxLng (NE lng)
        currentBounds[1][0]  // maxLat (NE lat)
    ];
}

// Başlangıç sınırlarını ayarla
setTimeout(getCurrentBounds, 100);

async function loadData() {
  const loadBtn = document.getElementById('loadBtn');
  loadBtn.disabled = true;
  loadBtn.textContent = 'Yükleniyor...';
  
  try {
    const type = document.getElementById('productSelect').value;
    const cloudCoverage = document.getElementById('cloudCoverage').value;
    const selectedDate = document.getElementById('selectedDate').value;
    
    debugLog(`${type.toUpperCase()+cloudCoverage} NDVI görüntüsü yükleniyor...`, 'info');
    
    // Mevcut katmanları temizle
    clearOverlays();

    // Bbox hesapla
    let bbox;
    if (manualSelectionMode) {
        if (!currentBounds) {
            throw new Error('Lütfen önce bir alan seçin (iki köşeye tıklayın)');
        }
        bbox = getBboxFromBounds();
        debugLog('Manuel seçilen alan kullanılıyor', 'info');
    } else {
        bbox = getCurrentBounds();
        debugLog('Görünür alan kullanılıyor', 'info');
    }
    
    // Alan büyüklüğüne göre çözünürlük ayarla
    const lngDiff = bbox[2] - bbox[0];
    const latDiff = bbox[3] - bbox[1];
    const avgDiff = (lngDiff + latDiff) / 2;
    
    let width, height;
    if (avgDiff < 0.01) {
      width = 1024; height = 1024;
    } else if (avgDiff < 0.1) {
      width = 768; height = 768;
    } else {
      width = 512; height = 512;
    }

    debugLog(`Alan büyüklüğü: ${avgDiff.toFixed(4)} - Çözünürlük: ${width}x${height}`, 'info');

    // Backend'e tile isteği gönder
    const requestData = {
      type: type,
      cloudCoverage: parseInt(cloudCoverage),
      selectedDate: selectedDate,
      bbox: bbox, // [minx, miny, maxx, maxy]
      width: width,
      height: height,
      manualSelection: manualSelectionMode,
      expression: "(nir-red)/(nir+red)", // NDVI
      colormap: "viridis"
    };
    
    console.log('Backend\'e gönderilen tile isteği:', requestData);

    const response = await fetch('http://localhost:8000/api/satellite-tiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('Backend\'den gelen tile verileri:', data);

    if (!data.success) {
      throw new Error('Backend\'den başarısız yanıt');
    }

    if (data.tiles.length === 0) {
      debugLog('Bu tarih ve alan için uydu görüntüsü bulunamadı', 'warning');
      return;
    }

    // Her tile için Leaflet tile layer oluştur
    data.tiles.forEach((tileData, index) => {
      try {
        // Leaflet tile layer oluştur
        const tileLayer = L.tileLayer(tileData.tiles_url, {
          minZoom: tileData.min_zoom,
          maxZoom: tileData.max_zoom,
          opacity: 0.7,
          attribution: 'ESA Sentinel-2 | Processed by TiTiler',
          crossOrigin: 'anonymous'
        });

        // Tile layer event'leri
        tileLayer.on('loading', function() {
          debugLog(`NDVI Tile ${index+1} yükleniyor...`, 'info');
        });

        tileLayer.on('load', function() {
          debugLog(`NDVI Tile ${index+1} yüklendi (Bulut: %${tileData.cloud_cover.toFixed(1)})`, 'success');
        });

        tileLayer.on('tileerror', function() {
          debugLog(`NDVI Tile ${index+1} yüklenirken hata oluştu`, 'error');
        });

        // Haritaya ekle
        tileLayer.addTo(map);
        currentImageOverlays.push(tileLayer);

        // İlk tile için harita merkezini ayarla

      } catch (error) {
        console.error(`Tile ${index+1} eklenirken hata:`, error);
        debugLog(`Tile ${index+1} eklenirken hata: ${error.message}`, 'error');
      }
    });

    // Sınır katmanını öne getir
    if (currentBoundsLayer) {
      currentBoundsLayer.bringToFront();
    }

    debugLog(`Toplam ${data.tiles.length} NDVI tile katmanı yüklendi`, 'success');

  } catch (error) {
    console.error('Tile yükleme hatası:', error);
    debugLog(`Hata: ${error.message}`, 'error');
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = 'Görünür Alan İçin Veri Yükle';
  }
}

// Overlay'leri temizle - tile layer'lar için güncellenmiş
function clearOverlays() {
    currentImageOverlays.forEach(overlay => {
        if (overlay.remove) {
            overlay.remove(); // Tile layer için
        } else {
            map.removeLayer(overlay); // Image overlay için
        }
    });
    currentImageOverlays = [];
    debugLog('Tüm tile katmanları temizlendi', 'info');
}

// Test fonksiyonu
async function testTileAPI() {
  try {
    const response = await fetch('http://localhost:8000/');
    const data = await response.json();
    console.log('API Test sonucu:', data);
    debugLog('Tile API bağlantısı başarılı', 'success');
  } catch (error) {
    console.error('API Test hatası:', error);
    debugLog('Tile API bağlantısı başarısız', 'error');
  }
}
// Overlay'leri temizle
function clearOverlays() {
    currentImageOverlays.forEach(overlay => {
        map.removeLayer(overlay);
    });
    currentImageOverlays = [];
    debugLog('Tüm overlay\'ler temizlendi', 'info');
}

// Opaklık kontrolü
function updateOpacity() {
    const opacityValue = document.getElementById('opacitySlider').value;
    document.getElementById('opacityValue').textContent = opacityValue + '%';
    
    currentImageOverlays.forEach(overlay => {
        overlay.setOpacity(opacityValue / 100);
    });
}

// Event listeners
map.on('click', onMapClick);
document.addEventListener('keydown', onKeyDown);

document.getElementById('loadBtn').addEventListener('click', loadData);
document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);
document.getElementById('toggleModeBtn').addEventListener('click', toggleManualMode);
document.getElementById('clearBtn').addEventListener('click', clearOverlays);
document.getElementById('opacitySlider').addEventListener('input', updateOpacity);

debugLog('Harita hazır! İstediğiniz alana yakınlaştırıp "Görünür Alan İçin Veri Yükle" butonuna tıklayın.', 'success');


/*from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import httpx
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



class SatelliteDataRequest(BaseModel):
    type: str
    cloudCoverage: int
    selectedDate: str
    bbox: List[float]  # [minx, miny, maxx, maxy]
    width: int
    height: int
    manualSelection: bool
    expression: Optional[str]
    colormap: Optional[str]


class TileData(BaseModel):
    tiles_url: str
    min_zoom: int
    max_zoom: int
    bounds: List[float]
    center: List[float]
    cloud_cover: float
    datetime: str
    tilejson: dict


class SatelliteResponse(BaseModel):
    success: bool
    tiles: List[TileData]
    total_count: int
    bbox: List[float]
    parameters: dict


@app.post("/api/satellite-tiles", response_model=SatelliteResponse)
async def get_satellite_tiles(request: SatelliteDataRequest):
    try:
        print(f"Gelen istek: {request}")

        titiler_endpoint = "https://titiler.xyz"

        # STAC API'den verileri al
        start_of_day = f"{request.selectedDate}T00:00:00Z"
        end_of_day = f"{request.selectedDate}T23:59:59Z"

        stac_payload = {
            "collections": ["sentinel-2-l2a"],
            "datetime": f"{start_of_day}/{end_of_day}",
            "bbox": request.bbox,
            "query": {"eo:cloud_cover": {"lt": request.cloudCoverage}}
            "sortby": [
                {"field": "datetime", "direction": "desc"}  # En yeni tarih önce
            ],
            "limit": 50  # Yeterince fazla sonuç al ki filtreleme yapabilelim

        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            # STAC API'den STAC items al
            stac_response = await client.post(
                "https://earth-search.aws.element84.com/v1/search",
                json=stac_payload,
                headers={"Content-Type": "application/json"}
            )

            if stac_response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"STAC API hatası: {stac_response.status_code}")

            stac_data = stac_response.json()
            features = stac_data.get('features', [])

            print(f"Bulunan STAC item sayısı: {len(features)}")

            if not features:
                return SatelliteResponse(
                    success=True,
                    tiles=[],
                    total_count=0,
                    bbox=request.bbox,
                    parameters={"message": "Bu tarih ve alan için uyda görüntü bulunamadı"}
                )

            tile_data_list = []



            for i, feature in enumerate(features):
                try:
                    # STAC item'ın self URL'ini al
                    stac_item_url = None
                    for link in feature.get('links', []):
                        if link.get('rel') == 'self':
                            stac_item_url = link.get('href')
                            break

                    if not stac_item_url:
                        print(f"Feature {i + 1} için self link bulunamadı, feature'ı URL olarak encode ediliyor")
                        # Feature'ı JSON string olarak kullan (fallback)
                        stac_item_url = json.dumps(feature)

                    cloud_cover = feature['properties']['eo:cloud_cover']
                    datetime_str = feature['properties']['datetime']
                    geometry = feature.get('geometry', {})

                    # Feature bounds'ını hesapla (eğer varsa)
                    if geometry and geometry.get('type') == 'Polygon':
                        coords = geometry['coordinates'][0]
                        lngs = [coord[0] for coord in coords]
                        lats = [coord[1] for coord in coords]
                        feature_bounds = [min(lngs), min(lats), max(lngs), max(lats)]
                        feature_center = [(min(lats) + max(lats)) / 2, (min(lngs) + max(lngs)) / 2]
                    else:
                        feature_bounds = request.bbox
                        feature_center = [(request.bbox[1] + request.bbox[3]) / 2,
                                          (request.bbox[0] + request.bbox[2]) / 2]
                    if(request.type=='ndvi'):
                    # TiTiler TileJSON endpoint'ine istek gönder
                        titiler_params = {
                            "url": stac_item_url,
                            "expression": "(nir-red)/(nir+red)",
                            "asset_as_band": True,
                            "rescale": "-1,1",
                            "minzoom": 8,
                            "maxzoom": 24,
                            "colormap_name":"viridis"
                        }

                    elif(request.type=='moisture'):
                        titiler_params = {

                            "url": stac_item_url,
                            "minzoom": 0,
                            "maxzoom": 18,
                            "expression": "(nir08-swir16)/(nir08+swir16)",
                            "asset_as_band": True,
                            "rescale": "-1,1",
                            "colormap_name": "viridis"  # Nem için mavi tonları
                        }

                    elif(request.type=='truecolor'):
                        titiler_params = {
                            "url": stac_item_url,
                            "assets":"visual",
                            "minzoom": 8,
                            "maxzoom": 24,
                        }

                    tilejson_url = f"{titiler_endpoint}/stac/WebMercatorQuad/tilejson.json"

                    print(f"TileJSON isteği gönderiliyor: {tilejson_url}")

                    tilejson_response = await client.get(
                        tilejson_url,
                        params=titiler_params,
                        timeout=30.0
                    )
#burada hangi veriyi s
                    if tilejson_response.status_code == 200:
                        tilejson_data = tilejson_response.json()

                        # TileJSON'dan bilgileri çıkar
                        tiles_url = tilejson_data["tiles"][0]  # İlk tile URL template
                        min_zoom = tilejson_data.get("minzoom", 8)
                        max_zoom = tilejson_data.get("maxzoom", 14)
                        tile_bounds = tilejson_data.get("bounds", feature_bounds)

                        tile_data_list.append(TileData(
                            tiles_url=tiles_url,
                            min_zoom=min_zoom,
                            max_zoom=max_zoom,
                            bounds=tile_bounds,
                            center=feature_center,
                            cloud_cover=cloud_cover,
                            datetime=datetime_str,
                            tilejson=tilejson_data
                        ))

                        print(f"Tile {i + 1}/{len(features)} başarıyla işlendi")
                        print(f"Tiles URL: {tiles_url}")

                    else:
                        print(f"TileJSON hatası tile {i + 1} için: {tilejson_response.status_code}")
                        print(f"Hata detayı: {tilejson_response.text}")

                except Exception as e:
                    print(f"Tile {i + 1} işlenirken hata: {str(e)}")
                    continue

            return SatelliteResponse(
                success=True,
                tiles=tile_data_list,
                total_count=len(features),
                bbox=request.bbox,
                parameters={
                    "type": request.type,
                    "cloud_coverage": request.cloudCoverage,
                    "date": request.selectedDate,
                    "expression": request.expression,
                    "colormap": request.colormap,
                    "processed_count": len(tile_data_list)
                }
            )

    except Exception as e:
        print(f"Genel hata: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Test endpoint
@app.get("/")
async def root():
    return {"message": "Satellite Tile API çalışıyor"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
    */
