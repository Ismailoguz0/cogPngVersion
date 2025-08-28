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
    
    debugLog(`${type.toUpperCase()} görüntüsü yükleniyor...`, 'info');
    
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
      width = 2048; height = 2048;  // Çok küçük alan için yüksek çözünürlük
    } else if (avgDiff < 0.1) {
      width = 2048; height = 2048;
    } else {
      width = 1024; height = 1024;
    }

    //bu çözünürlük ayarlarına bakılacak hangi çözünürlük daha iyi 

    debugLog(`Alan büyüklüğü: ${avgDiff.toFixed(4)} - Çözünürlük: ${width}x${height}`, 'info');

    // Backend'e istek gönder
    const requestData = {
      type: type,
      cloudCoverage: parseInt(cloudCoverage),
      selectedDate: selectedDate,
      bbox: bbox,
      width: width,
      height: height
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
          opacity: 0.7, // Her katman biraz daha şeffaf
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

/*from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import httpx
import json
from folium import Map, raster_layers
import folium

from urllib.parse import urlencode

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


@app.post("/api/satellite-tiles")
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
                    for link in feature.get("links", []):
                        if link.get("rel") == "self":
                            stac_item_url = link["href"]
                            break

                    if not stac_item_url:
                        print(f"Feature {i + 1} için self URL bulunamadı, atlanıyor")
                        continue

                    if (request.type == 'ndvi'):
                        titiler_params = {
                            "url": stac_item_url,
                            "expression": "(nir-red)/(nir+red)",
                            "asset_as_band": True,
                            "rescale": "-1,1",
                            "minzoom": 8,
                            "maxzoom": 24,
                            "colormap_name": "viridis"
                        }

                    elif (request.type == 'moisture'):
                        titiler_params = {
                            "url": stac_item_url,
                            "minzoom": 0,
                            "maxzoom": 18,
                            "expression": "(nir08-swir16)/(nir08+swir16)",
                            "asset_as_band": True,
                            "rescale": "-1,1",
                            "colormap_name": "viridis"
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
                        tilejson_url = f"{titiler_endpoint}/stac/bbox/{request.bbox[0]},{request.bbox[1]},{request.bbox[2]},{request.bbox[3]}/{request.height}x{request.width}.png"
                        query_string = urlencode(titiler_params)
                        full_image_url = f"{tilejson_url}?{query_string}"

                        image_urls.append(full_image_url)
                        print(f"Feature {i + 1} için URL oluşturuldu")

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

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
    */