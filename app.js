// Harita başlat - başlangıç konumu Türkiye
const map = L.map('map').setView([40.09915,33.45236],18);
// Yüksek çözünürlüklü base map
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 20,
  attribution: 'Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS'
}).addTo(map);

const mapRight = L.map('mapRight').setView([40.09915,33.45236],18);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 20,
  attribution: 'Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS'
}).addTo(mapRight);


map.sync(mapRight);
mapRight.sync(map);


// Mevcut sınır katmanı referansı
let currentBoundsLayer = null;
let currentImageOverlays = []; // Array olarak değiştirdik
let manualSelectionMode = false;
let clickedPoints = [];
let currentPolygon = null;
let tempMarkers = [];

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
function getCurrentBoundsAsPolygon() {
  const bounds = map.getBounds();
  const polygonCoords = [
            [bounds.getSouth(), bounds.getWest()], // SW
            [bounds.getSouth(), bounds.getEast()],  // SE  
            [bounds.getNorth(), bounds.getEast()], // NE
            [bounds.getNorth(), bounds.getWest()],  // NW
            [bounds.getSouth(), bounds.getWest()]  // SW tekrar (kapalı ring için)
        ];

        // Polygon objesini oluştur - koordinatları [lng, lat] formatına çevir
        const geoJsonCoords = polygonCoords.map(coord => [coord[1], coord[0]]);
        
        currentPolygon = {
            type: "Polygon",
            coordinates: [geoJsonCoords]
        };


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
         // Leaflet için orijinal koordinatları kullan (ilk 4 köşe)

        const leafletCoords = polygonCoords.slice(0, -1); // Son tekrarlanan köşeyi çıkar
        currentBoundsLayer = L.polygon(leafletCoords, {
            color: '#ff0000',
            weight: 2,
            fillOpacity: 0.1,
            dashArray: '5, 5'
        }).addTo(map);

        debugLog(`Görünür alan polygon olarak güncellendi (4 köşe)`, 'info');
        
        return currentPolygon;
}

// Harita hareket ettiğinde sınırları güncelle
// Harita hareket ettiğinde sınırları güncelle
    map.on('moveend', () => {
        if (!manualSelectionMode) {
            getCurrentBoundsAsPolygon();
        }
    });
    
    map.on('zoomend', () => {
        if (!manualSelectionMode) {
            getCurrentBoundsAsPolygon();
        }
    });

    let firstMarker = null;
// Harita tıklama olayı

    function onMapClick(e) {
        if (!manualSelectionMode) return;

        const { lat, lng } = e.latlng;
        const clickedLatLng = L.latLng(lat, lng);

        // İlk noktaya tekrar tıklanırsa çizimi tamamla
        if (clickedPoints.length >= 3 && firstMarker && clickedLatLng.distanceTo(firstMarker.getLatLng()) < 20) {
            drawPolygonFromClickedPoints();
            return;
        }

        // Nokta ekle
        clickedPoints.push([lat, lng]);

        // Marker oluştur
        const marker = L.circleMarker([lat, lng], {
            color: '#ff0000',
            fillColor: '#ff0000',
            fillOpacity: 0.8,
            radius: 8
        }).addTo(map);
        tempMarkers.push(marker);

        // İlk marker'ı sakla
        if (clickedPoints.length === 1) {
            firstMarker = marker;
            // İlk marker'ı farklı stil yap
            marker.setStyle({
                color: '#00ff00',
                fillColor: '#00ff00',
                radius: 10
            });
        }

        // Geçici çizgileri çiz (son 2 nokta arası)
        if (clickedPoints.length > 1) {
            const lastTwoPoints = clickedPoints.slice(-2);
            L.polyline(lastTwoPoints, {
                color: '#ff0000',
                weight: 2,
                opacity: 0.7,
                dashArray: '3, 3'
            }).addTo(map);
        }

        // Bilgi yazısı
        document.getElementById('boundsInfo').innerHTML = `
            <strong>Manuel Polygon Seçimi:</strong><br>
            ${clickedPoints.length} nokta seçildi<br>
            ${clickedPoints.length >= 3 ? 'Yeşil noktaya tıklayarak polygon\'u tamamlayabilirsiniz.' : 'En az 3 nokta seçiniz.'}
        `;

        debugLog(`Nokta eklendi: ${lat.toFixed(4)}, ${lng.toFixed(4)} (Toplam: ${clickedPoints.length})`, 'info');
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

    function drawPolygonFromClickedPoints() {
        if (clickedPoints.length < 3) {
            alert("En az 3 nokta seçmelisiniz!");
            return;
        }

        // Önceki katmanları kaldır
        if (currentBoundsLayer) {
            map.removeLayer(currentBoundsLayer);
        }

        // Geçici marker ve çizgileri temizle
        map.eachLayer((layer) => {
            if (layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
                if (tempMarkers.includes(layer) || layer.options.dashArray === '3, 3') {
                    map.removeLayer(layer);
                }
            }
        });

        // Polygon oluştur (Leaflet için)
        currentBoundsLayer = L.polygon(clickedPoints, {
            color: '#00ff00',
            weight: 3,
            fillOpacity: 0.2,
            fillColor: '#00ff00'
        }).addTo(map);

        // GeoJSON formatında polygon oluştur - KAPALI RING ile
        const geoJsonCoords = clickedPoints.map(point => [point[1], point[0]]); // [lng, lat] formatına çevir
        geoJsonCoords.push(geoJsonCoords[0]); // İlk koordinatı sona ekle (kapalı ring)
        
        currentPolygon = {
            type: "Polygon",
            coordinates: [geoJsonCoords]
        };

        debugLog(`Polygon oluşturuldu: ${clickedPoints.length} köşe (kapalı ring)`, 'success');

        // Polygon bilgilerini göster
        const area = L.GeometryUtil ? L.GeometryUtil.geodesicArea(clickedPoints) : 0;
        document.getElementById('boundsInfo').innerHTML = `
            <strong>Polygon başarıyla oluşturuldu!</strong><br>
            Köşe sayısı: ${clickedPoints.length}<br>
            ${area > 0 ? `Yaklaşık alan: ${(area / 1000000).toFixed(2)} km²` : ''}
        `;

        // Geçici verileri temizle
        tempMarkers = [];
        clickedPoints = [];
        firstMarker = null;
    }

    // Polygon'dan bbox hesapla (Sentinel Hub için)
    function getPolygonGeometry() {
        if (!currentPolygon) {
            throw new Error('Polygon bulunamadı - önce bir alan seçin');
        }
        
        return currentPolygon;
    }

    // Polygon'un bounding box'ını hesapla (görüntü boyutu için)
    function getPolygonBounds() {
        if (!currentPolygon) {
            throw new Error('Polygon bulunamadı');
        }

        const coordinates = currentPolygon.coordinates[0];
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;

        coordinates.forEach(coord => {
            const [lng, lat] = coord;
            minLng = Math.min(minLng, lng);
            minLat = Math.min(minLat, lat);
            maxLng = Math.max(maxLng, lng);
            maxLat = Math.max(maxLat, lat);
        });

        return [minLng, minLat, maxLng, maxLat];
    }

    // Başlangıç sınırlarını ayarla
    setTimeout(getCurrentBoundsAsPolygon, 100);


async function loadData() {
  const loadBtn = document.getElementById('loadBtn');
  loadBtn.disabled = true;
  loadBtn.textContent = 'Yükleniyor...';
  
  try {
    const type = document.getElementById('productSelect').value;
    const cloudCoverage = document.getElementById('cloudCoverage').value;
    const selectedDate = document.getElementById('selectedDate').value;
    
    debugLog(`${type.toUpperCase()} görüntüsü yükleniyor...`, 'info');
    
    // Mevcut katmanları temizle
    clearOverlays();

    // Bbox hesapla
    let geometry;
        if (manualSelectionMode) {
            if (!currentPolygon) {
                throw new Error('Lütfen önce bir polygon seçin (en az 3 nokta)');
            }
            geometry = getPolygonGeometry();
            debugLog('Manuel seçilen polygon kullanılıyor', 'info');
        } else {
            if (!currentPolygon) {
                getCurrentBoundsAsPolygon();
            }
            geometry = getPolygonGeometry();
            debugLog('Görünür alan polygonu kullanılıyor', 'info');
        }

    
    // Alan büyüklüğüne göre çözünürlük ayarla
        const bbox = getPolygonBounds(); // [minLng, minLat, maxLng, maxLat]
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

        debugLog(`Polygon alanı: ${avgDiff.toFixed(4)} - Çözünürlük: ${width}x${height}`, 'info');

        console.log(geometry);

    // Backend'e istek gönder
    const requestData = {
      type: type,
      cloudCoverage: parseInt(cloudCoverage),
      selectedDate: selectedDate,
      bbox:bbox,
      width: width,
      height: height,
      polygon:geometry
    };


    
    console.log('Backend\'e gönderilen istek:', requestData);

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
    console.log('Backend\'den gelen yanıt:', data);

    // Gelen URL'leri kontrol et
    if (!data.image_urls || !Array.isArray(data.image_urls)) {
      throw new Error('Backend\'den geçerli image_urls listesi alınamadı');
    }

    if (data.image_urls.length === 0) {
      debugLog('Bu tarih ve alan için görüntü bulunamadı', 'warning');
      return;
    }

    debugLog(`${data.image_urls.length} adet görüntü bulundu`, 'info');

    // Her URL için sırayla image overlay oluştur (2 saniye ara ile)
    for (let index = 0; index < data.image_urls.length; index++) {
      try {
        const imageUrl = data.image_urls[index];
        console.log(`Görüntü ${index + 1} yükleniyor:`, imageUrl);
        
        // Her görüntü için image overlay oluştur
        const imageOverlay = L.imageOverlay(imageUrl, [
          [bbox[1], bbox[0]], // SW corner
          [bbox[3], bbox[2]]  // NE corner
        ], {
          opacity: 0.7, 
          interactive: false,
          attribution: `Görüntü ${index + 1}/${data.image_urls.length}`
        });

        imageOverlay.addTo(map);
        currentImageOverlays.push(imageOverlay);

        // Sınır katmanını öne getir
        if (currentBoundsLayer) {
          currentBoundsLayer.bringToFront();
        }

        debugLog(`Görüntü ${index + 1}/${data.image_urls.length} eklendi`, 'success');

        // Son görüntü değilse 2 saniye bekle
        if (index < data.image_urls.length - 1) {
          debugLog('2 saniye bekleniyor...', 'info');
          loadBtn.textContent = `Yükleniyor... (${index + 1}/${data.image_urls.length})`;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (overlayError) {
        console.error(`Görüntü ${index + 1} eklenirken hata:`, overlayError);
        debugLog(`Görüntü ${index + 1} eklenirken hata: ${overlayError.message}`, 'error');
      }
    }

    debugLog(`Toplam ${currentImageOverlays.length} PNG görüntü katmanı başarıyla yüklendi`, 'success');
    
    // İstatistikleri göster
    if (data.total_count && data.processed_count) {
      debugLog(`İstatistik: ${data.total_count} STAC item bulundu, ${data.processed_count} tanesi işlendi`, 'info');
    }

  } catch (error) {
    console.error('Görüntü yükleme hatası:', error);
    debugLog(`Hata: ${error.message}`, 'error');
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = 'Görünür Alan İçin Veri Yükle';
  }
}

// 2 saniye bekleme için yardımcı fonksiyon (alternatif olarak)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Overlay'leri temizle - güncellenmiş
function clearOverlays() {
    console.log(`${currentImageOverlays.length} overlay temizleniyor`);
    
    currentImageOverlays.forEach((overlay, index) => {
        try {
            if (overlay.remove) {
                overlay.remove(); // Tile layer için
            } else {
                map.removeLayer(overlay); // Image overlay için
            }
        } catch (error) {
            console.error(`Overlay ${index + 1} temizlenirken hata:`, error);
        }
    });
    
    currentImageOverlays = [];
    debugLog('Tüm görüntü katmanları temizlendi', 'info');
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


const controlPanel = document.querySelector(".control-panel");
const togglePanelBtn = document.getElementById("togglePanelBtn");

togglePanelBtn.addEventListener("click", () => {
    controlPanel.classList.toggle("closed");
    
    // Buton yazısını değiştir
    if (controlPanel.classList.contains("closed")) {
        togglePanelBtn.textContent = "☰ Panel Aç";
    } else {
        togglePanelBtn.textContent = "✖ Panel Kapat";
    }
});


/*from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import httpx
import json
from folium import Map, raster_layers
import folium
from titiler.core.factory import MultiBaseTilerFactory
from rio_tiler.io import STACReader
from urllib.parse import urlencode
import numpy as np


def interpolate_color(color1, color2, steps):
    """İki renk arasında gradual geçiş oluşturur"""
    colors = []
    for i in range(steps):
        ratio = i / (steps - 1)
        r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
        g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
        b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
        colors.append([r, g, b, 255])
    return colors




app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
stac_tiler = MultiBaseTilerFactory(
    reader=STACReader,
    add_preview=True,  # düşük çözünürlüklü önizleme
    add_part=True,     # parçalı veri isteği
    add_viewer=True    # basit viewer
)

app.include_router(stac_tiler.router,prefix="/stac")


class SatelliteDataRequest(BaseModel):
    type: str
    cloudCoverage: int
    selectedDate: str
    bbox: List[float]  # [minx, miny, maxx, maxy]
    width: int
    height: int
    polygon : dict


@app.post("/api/satellite-tiles")
async def get_satellite_tiles(request: SatelliteDataRequest):
    try:
        print(f"Gelen istek: {request}")

        titiler_endpoint = "http://127.0.0.1:8000"

        # STAC API'den verileri al
        start_of_day = f"{request.selectedDate}T00:00:00Z"
        end_of_day = f"{request.selectedDate}T23:59:59Z"


        

        stac_payload = {
            "collections": ["sentinel-2-l2a"],
            "datetime": f"{start_of_day}/{end_of_day}",
            "bbox": request.bbox,
            "query": {"eo:cloud_cover": {"lt": request.cloudCoverage}}
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

            image_urls = []  # URL'leri saklamak için liste

            # Tüm features için döngü
            for i, feature in enumerate(features):
                try:
                    titiler_params = None
                    stac_item_url = None
                    # Her feature için self URL'ini bul
                    #burası gereksiz olabilir
                    for link in feature.get("links", []):
                        if link.get("rel") == "self":
                            stac_item_url = link["href"]
                            print(stac_item_url)
                            break

                    if not stac_item_url:
                        print(f"Feature {i + 1} için self URL bulunamadı, atlanıyor")
                        continue



                    #(173, 0, 40) -1.00 − 0.05
                    #(197, 20, 42)	0.05 − 0.10
                    #(224, 45, 44)  0.10 − 0.15
                    #(239, 76, 58)	0.15 − 0.20
                    #(254, 108, 74)0.20 − 0.25
                    #(255, 141, 90)0.25 − 0.30
                    #(255, 171, 105)0.30 − 0.35
                    #(255, 198, 125)0.35 − 0.40
                    #(255, 224, 147)0.40 − 0.45
                    #(255, 239, 171)0.45 − 0.50
                    #(253, 254, 194)0.50 − 0.55
                    #(234, 247, 172)0.55 − 0.60
                    #(213, 239, 148)0.60 − 0.65
                    #(185, 227, 131)0.65 − 0.70
                    #(155, 216, 115)0.70 − 0.75
                    #(119, 202, 111)0.75 − 0.80
                    #(83, 189, 107) 0.80 − 0.85
                    #(20, 170, 96) 0.85-0.90
                    #(0, 151, 85) 0.90-0.95
                    #(0, 126, 71) 0.95 − 1.00




                    #(173, 0, 40)
                    #(254, 108, 74)
                    #(255, 239, 171)
                    #(155, 216, 115)
                    #(0, 126, 71)

                    ndvi_complete_colormap = {}

                    for i in range(128):
                        ndvi_complete_colormap[str(i)] = [173, 0, 40, 255]

                    # 0.112 − 0.309 (52-102)
                    for i in range(128, 154):
                        ndvi_complete_colormap[str(i)] = [254, 108, 74, 255]

                    # 0.309 − 0.506 (103-153)
                    for i in range(154, 180):
                        ndvi_complete_colormap[str(i)] = [255, 239, 171, 255]

                    # 0.506 − 0.703 (154-204)
                    for i in range(180, 231):
                        ndvi_complete_colormap[str(i)] = [155, 216, 115, 255]

                    # 0.703 − 0.90 (205-255)
                    for i in range(231, 256):
                        ndvi_complete_colormap[str(i)] = [0, 126, 71, 255]

                    moisture_complete_colormap = {}

                    for i in range(97):
                        moisture_complete_colormap[str(i)] =  [128,   0,   0,255]
                    for i in range(97,126):
                        moisture_complete_colormap[str(i)] = [255, 0, 0,255]
                    for i in range(124,132):
                        moisture_complete_colormap[str(i)] = [255, 255, 0,255]

                    for i in range(132,158):
                        moisture_complete_colormap[str(i)] = [0, 255, 255,255]

                    for i in range(158,230):
                        moisture_complete_colormap[str(i)] = [0, 0, 255,255]

                    for i in range(230,256):
                        moisture_complete_colormap[str(i)] = [255, 255, 255,255]

                    moisture_complete_colormap = {}

                    # Renk geçişlerini tanımla (resimdeki sıraya göre)
                    # Koyu mavi -> Mavi -> Cyan -> Sarı -> Kırmızı -> Koyu kırmızı

                    color_ranges = [
                        # (başlangıç_index, bitiş_index, başlangıç_renk, bitiş_renk)
                        (230, 256, [0, 0, 128], [0, 0, 255]),  # Koyu mavi -> Mavi
                        (158, 230, [0, 0, 255], [0, 255, 255]),  # Mavi -> Cyan
                        (132, 158, [0, 255, 255], [0, 255, 0]),  # Cyan -> Yeşil
                        (124, 132, [0, 255, 0], [255, 255, 0]),  # Yeşil -> Sarı
                        (97,124, [255, 255, 0], [255, 0, 0]),  # Sarı -> Kırmızı
                        (0,97, [255, 0, 0], [128, 0, 0])  # Kırmızı -> Koyu kırmızı
                    ]

                    # Her aralık için renk geçişi oluştur
                    for start_idx, end_idx, start_color, end_color in color_ranges:
                        steps = end_idx - start_idx
                        if steps > 0:
                            interpolated_colors = interpolate_color(start_color, end_color, steps)
                            for i, color in enumerate(interpolated_colors):
                                moisture_complete_colormap[str(start_idx + i)] = color




                    if (request.type == 'ndvi'):
                        titiler_params = {
                            "url": stac_item_url,
                            "expression": "(nir-red)/(nir+red)",
                            "asset_as_band": True,
                            "rescale": "-1,1",
                            "minzoom": 8,
                            "maxzoom": 24,
                            "colormap": json.dumps(ndvi_complete_colormap),
                            "resampling": "bilinear",
                        }

                    elif (request.type == 'moisture'):
                        titiler_params = {
                            "url": stac_item_url,
                            "minzoom": 0,
                            "maxzoom": 18,
                            "expression": "(nir08-swir16)/(nir08+swir16)",
                            "asset_as_band": True,
                            "rescale": "-1,1",
                            "colormap": json.dumps(moisture_complete_colormap),

                        }

                    elif (request.type == 'truecolor'):
                        titiler_params = {
                            "url": stac_item_url,
                            "assets": "visual",
                            "minzoom": 8,
                            "maxzoom": 24,
                        }

                    elif(request.type=='falsecolor'):
                        titiler_params = (
                            ("url", stac_item_url),
                            ("assets", "nir"),
                            ("assets", "red"),
                            ("assets", "green"),
                            ("minzoom", 8),
                            ("maxzoom", 14),
                            ("rescale", "0,2000"),
                        )
                    elif (request.type == 'swir'):
                        titiler_params = (
                            ("url", stac_item_url),
                            ("assets", "swir22"),
                            ("assets", "nir08"),
                            ("assets", "red"),
                            ("minzoom", 8),
                            ("maxzoom", 14),
                            ("rescale", "0,2000"),
                        )

                    if titiler_params:
                        tilejson_url = f"{titiler_endpoint}/stac/feature/{request.height}x{request.width}.tif"
                        #png mi jpeg mi ona bakılabilir öncesinde tif olarak deneyeceğim
                        json_format = {
                            "type": "Feature",
                            "properties": {},
                            "geometry": request.polygon
                        }

                        response = await client.post(
                            tilejson_url,
                            params=titiler_params,
                            json=json_format,
                            headers={"Content-Type": "application/json"},
                            timeout=30.0
                        )
                        #burada response'u alma kısmında time out hatası alıyorum
                        #normalde kod çalışıyor ama burada time out hatası veriyor

                        filename = f"deneme2314.tif"
                        with open(filename, "wb") as f:
                            f.write(response.content)



                except Exception as e:
                    print(f"Feature {i + 1} işlenirken hata: {str(e)}")
                    continue

            print(f"Toplam {len(image_urls)} URL oluşturuldu")

            return {
                "image_urls": image_urls,
            }

    except Exception as e:
        print(f"Genel hata: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    return {"message": "Satellite Tile API çalışıyor"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)*/