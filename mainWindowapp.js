// Harita başlat - başlangıç konumu Türkiye
const map = L.map('mapMain').setView([40.09915,33.45236],18);
// Yüksek çözünürlüklü base map
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 20,
  attribution: 'Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS'
}).addTo(map);    


let currentBoundsLayer = null;
let currentImageOverlays = []; // Array olarak değiştirdik
let manualSelectionMode = false;
let clickedPoints = [];
let currentPolygon = null;
let tempMarkers = [];
let tempLayers = [];
let georaster = null;

function refreshMaps() {
  window.setTimeout(() => {
      if (map) map.invalidateSize();
  }, 500);
}
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

        
    return currentPolygon;
}
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
    let loadBtn = document.getElementById('loadBtnMain');
    loadBtn.disabled = true;
    loadBtn.textContent = 'Yükleniyor...';
    try {
        let type= document.getElementById('productSelectMain').value;;
        let cloudCoverage = document.getElementById('cloudCoverageMain').value;
        let selectedDate = document.getElementById('selectedDateMain').value;
        
        // Mevcut katmanları temizle
        clearOverlays(map,currentImageOverlays);

        // Bbox hesapla
        let geometry;
            if (manualSelectionMode) {
                if (!currentPolygon) {
                    throw new Error('Lütfen önce bir polygon seçin (en az 3 nokta)');
                }
                geometry = getPolygonGeometry();

            } else {
                if (!currentPolygon) {
                    getCurrentBoundsAsPolygon();
                }
                geometry = getPolygonGeometry();

            }

        
            const bbox = getPolygonBounds(); // [minLng, minLat, maxLng, maxLat]
            let width, height;
            width=512;
            height=512;

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


        // Her URL için sırayla image overlay oluştur (2 saniye ara ile)
        for (let index = 0; index < data.image_urls.length; index++) {
        try {
            const imageUrl = data.image_urls[index];
            console.log(`Görüntü ${index + 1} yükleniyor:`, imageUrl);

            const response = await fetch(imageUrl);
            const arrayBuffer = await response.arrayBuffer();
            const colorMap = (value) => {
            if (value === 0 || value === 255 ||value === null || isNaN(value)) return null;

            // NDVI değeri uint8'den [-1, 1] aralığına çevrilir
            const pixelValue = (value / 255) * 2 - 1;


            if(type==="ndvi"){
                if (pixelValue === -1.0) {
                    return 'rgb(13, 13, 13)'; // Su kütleleri için mavi
                } else if (pixelValue <= - 0.4) {
                    return'rgb(191, 191, 191)'; // Çorak arazi, kum, kaya için açık kahve/bej (Tan)
                } else if (pixelValue<= -0.2) {
                    return 'rgb(219, 219, 219)'; // Çok seyrek bitki örtüsü için sarımsı
                } else if (pixelValue <= 0.0) {
                    return 'rgb(235, 235, 235)'; // Çalı ve otlaklar için açık yeşil
                } else if (pixelValue <= 0.1) {
                    return 'rgb(255, 250, 204)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.15) {
                    return 'rgb(237, 232, 181)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.2) {
                    return 'rgb(222, 217, 156)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.25) {
                    return 'rgb(204, 199, 130)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.3) {
                    return  'rgb(189, 184, 107)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.35) {
                    return  'rgb(176, 194, 97)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.4) {
                    return  'rgb(163, 204, 89)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.45) {
                    return  'rgb(145, 191, 82)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.5) {
                    return  'rgb(128, 179, 71)' ; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.55) {
                    return  'rgb(112, 163, 64)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.6) {
                    return  'rgb(97, 150, 54)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.65) {
                    return  'rgb(79, 138, 46)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.7) {
                    return  'rgb(64, 125, 36)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.75) {
                    return  'rgb(48, 110, 28)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.8) {
                    return  'rgb(33, 97, 18)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                else if (pixelValue <= 0.85) {
                    return  'rgb(15, 84, 10)'; // Orta yoğunlukta bitki örtüsü için orta yeşil
                } 
                
                else { 
                    return 'rgb(0, 69, 0)'; // Yoğun ormanlar için koyu yeşil (DarkGreen)
                }
            }
            else if(type === "moisture"){
            if (pixelValue <= -0.4) {
            return 'rgb(128, 0, 0)'; // Koyu kırmızı - Çorak toprak
        } else if (pixelValue <= -0.24) {
            return 'rgb(180, 0, 0)'; // Kırmızı - Çok kuru
        } else if (pixelValue <= -0.1) {
            return 'rgb(255, 0, 0)'; // Parlak kırmızı - Kuru
        } else if (pixelValue <= -0.032) {
            return 'rgb(255, 80, 0)'; // Kırmızı-turuncu
        } else if (pixelValue <= 0.0) {
            return 'rgb(255, 160, 0)'; // Turuncu
        } else if (pixelValue<= 0.032) {
            return 'rgb(255, 255, 0)'; // Sarı - Hafif su stresi
        } else if (pixelValue <= 0.1) {
            return 'rgb(128, 255, 128)'; // Sarı-cyan geçiş
        } else if (pixelValue <= 0.24) {
            return 'rgb(0, 255, 255)'; // Cyan - Su stresi yok
        } else if (pixelValue <= 0.4) {
            return 'rgb(0, 180, 255)'; // Açık mavi
        } else if (pixelValue<= 0.6) {
            return 'rgb(0, 100, 255)'; // Mavi
        } else if (pixelValue<= 0.8) {
            return 'rgb(0, 0, 255)'; // Koyu mavi
        } else { // value > 0.8
            return 'rgb(0, 0, 128)'; // En koyu mavi - Su kütleleri
        }
    }
        }

            georaster = await parseGeoraster(arrayBuffer);

            const layer = new GeoRasterLayer({
            georaster: georaster,
            opacity: 0.7,
            resolution: 256,
            pixelValuesToColorFn: values => colorMap(values[0])
            

            });

            layer.addTo(map);
            currentImageOverlays.push(layer);

            // Sınır katmanını öne getir
            if (currentBoundsLayer) {
            currentBoundsLayer.bringToFront();
            }


        } catch (overlayError) {
            console.error(`Görüntü ${index + 1} eklenirken hata:`, overlayError);
        }
        setTimeout(refreshMaps, 500);
        }

        
    } catch (error) {
        console.error('Görüntü yükleme hatası:', error);
    } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = 'Görünür Alan İçin Veri Yükle';
    }
    }

    function clearOverlays() {
    console.log(`${currentImageOverlays.length} overlay temizleniyor`);
    
    currentImageOverlays.forEach((overlay, index) => {
        try {
            map.removeLayer(overlay);
        } catch (error) {
            console.error(`Overlay ${index + 1} temizlenirken hata:`, error);
        }
    });
    // Diziyi temizle
    currentImageOverlays.length = 0; // Array'i boşalt
    georaster = null;
    refreshMaps();
}

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


document.getElementById('loadBtnMain').addEventListener('click',loadData);
document.getElementById('opacitySliderMain').addEventListener('input', updateOpacity);
map.on("click", handleMapClick);
document.getElementById('clearBtnMain').addEventListener('click',clearOverlays);
function updateOpacity() {
    const opacityValue = document.getElementById('opacitySliderMain').value;
    document.getElementById('opacityValueMain').textContent = opacityValue + '%';
    
    currentImageOverlays.forEach(overlay => {
        overlay.setOpacity(opacityValue / 100);
    });
}


function handleMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const type = document.getElementById('productSelectMain').value;

    // Sol harita için değer hesapla
    if (georaster !== null) {
        try {
            const x = Math.floor((lng - georaster.xmin) / georaster.pixelWidth);
            const y = Math.floor((georaster.ymax - lat) / georaster.pixelHeight);
            
            // Sınır kontrolü
            if (x >= 0 && x < georaster.width && y >= 0 && y < georaster.height) {
                const value = (georaster.values[0][y][x] / 255) * 2 - 1;
                
                L.popup()
                    .setLatLng([lat, lng])
                    .setContent(`${type} Değeri: ${value.toFixed(4)}`)
                    .openOn(map);
            }
        } catch (error) {
            console.error('Sol harita değer okuma hatası:', error);
        }
    }

}
