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

    setTimeout(refreshMaps, 1000);

    const createCursorIcon = () => {
    return L.divIcon({
        className: 'cursor-marker',
        html: `
        <div style="
            width: 15px;
            height: 15px;
            border: 2px solid #010101ff;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.2);
            box-shadow: 0 0 10px rgba(2, 2, 2, 0.5);
            transform: translate(-50%, -50%);
        "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    };

    // Sol harita için sağ haritada gösterilecek cursor
    let cursorMarkerRight = L.marker([0, 0], {
    icon: createCursorIcon(),
    interactive: false,
    opacity: 0.8
    });

    // Sağ harita için sol haritada gösterilecek cursor
    let cursorMarkerLeft = L.marker([0, 0], {
    icon: createCursorIcon(),
    interactive: false,
    opacity: 0.8
    });

    // Sol harita mouse olayları
    map.on('mousemove', function(e) {
    cursorMarkerRight.setLatLng(e.latlng);
    if (!mapRight.hasLayer(cursorMarkerRight)) {
        cursorMarkerRight.addTo(mapRight);
    }
    });

    map.on('mouseout', function() {
    if (mapRight.hasLayer(cursorMarkerRight)) {
        mapRight.removeLayer(cursorMarkerRight);
    }
    });

    // Sağ harita mouse olayları
    mapRight.on('mousemove', function(e) {
    cursorMarkerLeft.setLatLng(e.latlng);
    if (!map.hasLayer(cursorMarkerLeft)) {
        cursorMarkerLeft.addTo(map);
    }
    });

    mapRight.on('mouseout', function() {
    if (map.hasLayer(cursorMarkerLeft)) {
        map.removeLayer(cursorMarkerLeft);
    }
    });


    // Mevcut sınır katmanı referansı
    let currentBoundsLayer = null;
    let currentBoundsLayerRight = null;
    let currentImageOverlays = []; // Array olarak değiştirdik
    let manualSelectionMode = false;
    let clickedPoints = [];
    let currentPolygon = null;
    let tempMarkers = [];
    let tempLayers = [];
    let currentImageOverlaysRight = [];
    let georasterLeft = null;
    let georasterRight = null;

    function refreshMaps() {
    window.setTimeout(() => {
        if (map) map.invalidateSize();
        if (mapRight) mapRight.invalidateSize();
    }, 500);
    }


    // Manuel seçim modunu aktif/pasif et
    function toggleManualMode() {
        manualSelectionMode = !manualSelectionMode;
        const toggleBtn = document.getElementById('toggleModeBtn');
        const clearSelectionBtn = document.getElementById('clearSelectionBtn');
        
        if (manualSelectionMode) {
            toggleBtn.textContent = 'Görünür Alan Moduna Geç';
            toggleBtn.classList.add('active');
            clearSelectionBtn.style.display = 'block';
            map.getContainer().style.cursor = 'crosshair';
        } else {
            toggleBtn.textContent = 'Manuel Alan Seçimi Aktif Et';
            toggleBtn.classList.remove('active');
            clearSelectionBtn.style.display = 'none';
            map.getContainer().style.cursor = '';
            clearSelection();
            getCurrentBounds(); // Görünür alanı güncelle
        }
        refreshMaps();
    }


    // Seçimi temizle
    function clearSelection() {
        // Tıklanan noktaları temizle
    if (currentBoundsLayer) {
            map.removeLayer(currentBoundsLayer);
            currentBoundsLayer = null;
        }
        
        // SAĞ haritadan polygon'u kaldır - BU EKSİKTİ
        if (currentBoundsLayerRight) {
            mapRight.removeLayer(currentBoundsLayerRight);
            currentBoundsLayerRight = null; 
        }

        clickedPoints = [];
        
        // Geçici markerları kaldır
        tempMarkers.forEach(marker => map.removeLayer(marker));
        tempMarkers = [];
        tempLayers.forEach(layer => map.removeLayer(layer));
        tempLayers = [];
        
        // İlk marker referansını temizle
        firstMarker = null;


    }

    // ESC tuşu ile iptal
    function onKeyDown(e) {
        if (e.key === 'Escape' && manualSelectionMode) {
            clearSelection();
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

    // Mevcut sınırları haritada göster
    if (currentBoundsLayer) {
        map.removeLayer(currentBoundsLayer);
    }
    if (currentBoundsLayerRight) {
            mapRight.removeLayer(currentBoundsLayerRight);
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
                const tempLine =L.polyline(lastTwoPoints, {
                    color: '#ff0000',
                    weight: 2,
                    opacity: 0.7,
                    dashArray: '3, 3'
                }).addTo(map);
                tempLayers.push(tempLine);
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

        function drawPolygonFromClickedPoints() {
        if (clickedPoints.length < 3) {
            alert("En az 3 nokta seçmelisiniz!");
            return;
        }

        // Önceki katmanları kaldır
        if (currentBoundsLayer) {
            map.removeLayer(currentBoundsLayer);
            mapRight.removeLayer(currentBoundsLayer);
        }

        // Geçici marker ve çizgileri temizle
        tempMarkers.forEach(marker => map.removeLayer(marker));
        tempMarkers = [];
        tempLayers.forEach(layer => map.removeLayer(layer));
        tempLayers = [];

        // SOL harita için polygon
        currentBoundsLayer = L.polygon(clickedPoints, {
            color: '#00ff00',
            weight: 3,
            fillOpacity: 0.05,
            fillColor: '#00ff00'
        }).addTo(map);

        // SAĞ harita için ayrı polygon oluştur
        currentBoundsLayerRight = L.polygon(clickedPoints, {
            color: '#00ff00',
            weight: 3,
            fillOpacity: 0.05,
            fillColor: '#00ff00'
        }).addTo(mapRight);

        // GeoJSON formatında polygon oluştur
        const geoJsonCoords = clickedPoints.map(point => [point[1], point[0]]);
        geoJsonCoords.push(geoJsonCoords[0]);
        
        currentPolygon = {
            type: "Polygon",
            coordinates: [geoJsonCoords]
        };

        // Bilgileri göster
        const area = L.GeometryUtil ? L.GeometryUtil.geodesicArea(clickedPoints) : 0;

        tempMarkers = [];
        clickedPoints = [];
        firstMarker = null;
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


    async function loadData(selectedMap,map,currentImageOverlays,currentBoundsLayer) {
    let loadBtn = null;
    if (selectedMap === "left") {
        loadBtn = document.getElementById('loadBtn');
    } else if (selectedMap === "right") {
        loadBtn = document.getElementById('loadBtnRight');
    }

    if (!loadBtn) {
        console.error('Load butonu bulunamadı!');
        return;
    }

    loadBtn.disabled = true;
    loadBtn.textContent = 'Yükleniyor...';
    try {
        let type= null;
        let cloudCoverage = null;
        let selectedDate = null;
        if(selectedMap==="left"){
        type = document.getElementById('productSelectLeft').value;
        cloudCoverage = document.getElementById('cloudCoverageLeft').value;
        selectedDate = document.getElementById('selectedDateLeft').value;
        }
        else if(selectedMap==="right"){
        type = document.getElementById('productSelectRight').value;
        cloudCoverage = document.getElementById('cloudCoverageRight').value;
        selectedDate = document.getElementById('selectedDateRight').value;

        }
        
        
        // Mevcut katmanları temizle
        clearOverlays(selectedMap,map,currentImageOverlays);

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
        //Burada her url için değil gelen tek görüntü için işleme yapılacak 


        try {
            const imageUrl = data.image_urls[1];
            const tiffUrl = data.image_urls[0];

            const response = await fetch(tiffUrl);
            const arrayBuffer = await response.arrayBuffer();

            const georaster = await parseGeoraster(arrayBuffer);
            if(selectedMap==="left"){
                georasterLeft=georaster;
            }
            else if (selectedMap==="right"){
                georasterRight=georaster;
            }
            //georaster yüklendi 
            //buraya georasterı yükledikten sonra png çekeceğim 
            // Her görüntü için image overlay oluştur
            const layer = L.imageOverlay(imageUrl, [
            [bbox[1], bbox[0]], // SW corner
            [bbox[3], bbox[2]]  // NE corner
            ], {
            opacity: 0.7, 
            interactive: false,
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


        
    } catch (error) {
        console.error('Görüntü yükleme hatası:', error);
    } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = 'Görünür Alan İçin Veri Yükle';
    }
    }

    // Overlay'leri temizle - güncellenmiş
    function clearOverlays(selectedMap,map,overlayArray) {
        console.log(`${overlayArray.length} overlay temizleniyor`);
        
        overlayArray.forEach((overlay, index) => {
            try {
                map.removeLayer(overlay);
            } catch (error) {
                console.error(`Overlay ${index + 1} temizlenirken hata:`, error);
            }
        });
        if(selectedMap==="left"){
            georasterLeft=null;
        }
        else if(selectedMap==="right"){
            georasterRight=null;
        }
        // Diziyi temizle
        overlayArray.length = 0; // Array'i boşalt
        refreshMaps();
    }
    // Opaklık kontrolü
    function updateOpacity() {
        const opacityValue = document.getElementById('opacitySliderLeft').value;
        document.getElementById('opacityValueLeft').textContent = opacityValue + '%';
        
        currentImageOverlays.forEach(overlay => {
            overlay.setOpacity(opacityValue / 100);
        });
    }

    function updateOpacityRight() {
        const opacityValue = document.getElementById('opacitySliderRight').value;
        document.getElementById('opacityValueRight').textContent = opacityValue + '%';
        
        currentImageOverlaysRight.forEach(overlay => {
            overlay.setOpacity(opacityValue / 100);
        });
    }




    // Event listeners
    map.on('click', onMapClick);
    document.addEventListener('keydown', onKeyDown);

    document.getElementById('loadBtn').addEventListener('click',() => loadData("left",map,currentImageOverlays,currentBoundsLayer));
    document.getElementById('loadBtnRight').addEventListener('click',() => loadData("right",mapRight,currentImageOverlaysRight,currentBoundsLayerRight));
    document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);
    document.getElementById('toggleModeBtn').addEventListener('click', toggleManualMode);
    document.getElementById('clearBtnLeft').addEventListener('click', () => {
        clearOverlays("left",map,currentImageOverlays);
    });

    // Sağ harita için de ekleyin (HTML'de varsa)
    document.getElementById('clearBtnRight')?.addEventListener('click', () => {
        clearOverlays("right",mapRight,currentImageOverlaysRight);
    });
    document.getElementById('opacitySliderLeft').addEventListener('input', updateOpacity);
    document.getElementById('opacitySliderRight').addEventListener('input', updateOpacityRight);

    window.addEventListener('resize', refreshMaps);
    const controlPanel = document.getElementById("control-panel-left");
    const togglePanelBtn = document.getElementById("togglePanelBtn");
    // Her iki haritaya aynı fonksiyonu bağla
    map.on("click", handleMapClick);
    mapRight.on("click", handleMapClick);

    //buralarda map ve mapRight ayrımına dikkat eksik şeyler var o yüzden 
    //click olayları çakışıyor olabilir ona bakılacak 
    //solda kaydırdığımda sağda da değerleri görmek istiyorum 
    //haritanın overlayin üzerinden çıkınca bu işlemi durduracak ama boş yerde çalıştırmayacak

    // Ortak popup fonksiyonu
    function handleMapClick(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        const typeLeft = document.getElementById('productSelectLeft').value;
        const typeRight = document.getElementById('productSelectRight').value;

        // Sol harita için değer hesapla
        if (georasterLeft !== null) {
            try {
                const xLeft = Math.floor((lng - georasterLeft.xmin) / georasterLeft.pixelWidth);
                const yLeft = Math.floor((georasterLeft.ymax - lat) / georasterLeft.pixelHeight);
                
                // Sınır kontrolü
                if (xLeft >= 0 && xLeft < georasterLeft.width && yLeft >= 0 && yLeft < georasterLeft.height) {
                    const valueLeft = (georasterLeft.values[0][yLeft][xLeft] / 255) * 2 - 1;

                    if(parseFloat(valueLeft.toFixed(4))===-0.0039){
                        L.popup()
                        .setLatLng([lat, lng])
                        .setContent("No data found there is a cloud or sth")
                        .openOn(map);

                    }
                    else{
                        L.popup()
                        .setLatLng([lat, lng])
                        .setContent(`${typeLeft} Değeri: ${valueLeft.toFixed(4)}`)
                        .openOn(map);


                    }
                    

                }
            } catch (error) {
                console.error('Sol harita değer okuma hatası:', error);
            }
        }

        // Sağ harita için değer hesapla
        if (georasterRight !== null) {
            try {
                const xRight = Math.floor((lng - georasterRight.xmin) / georasterRight.pixelWidth);
                const yRight = Math.floor((georasterRight.ymax - lat) / georasterRight.pixelHeight);
                
                // Sınır kontrolü
                if (xRight >= 0 && xRight < georasterRight.width && yRight >= 0 && yRight < georasterRight.height) {
                    const valueRight = (georasterRight.values[0][yRight][xRight] / 255) * 2 - 1;

                    if(parseFloat(valueRight.toFixed(4))===-0.0039){
                        L.popup()
                        .setLatLng([lat, lng])
                        .setContent("No data found there is a cloud or sth")
                        .openOn(mapRight);

                    }
                    else{
                        L.popup()
                        .setLatLng([lat, lng])
                        .setContent(`${typeRight} Değeri: ${valueRight.toFixed(4)}`)
                        .openOn(mapRight);
                    }
                    

                }
            } catch (error) {
                console.error('Sağ harita değer okuma hatası:', error);
            }
        }
    }

/*
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import httpx
import json
from folium import Map, raster_layers
import folium
from titiler.core.factory import MultiBaseTilerFactory
from titiler.core.factory import TilerFactory
from rio_tiler.io import STACReader
from urllib.parse import urlencode
import numpy as np
import boto3
from datetime import datetime, timedelta
from rasterio.io import MemoryFile

s3_client = boto3.client('s3')

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
    add_part=True,  # parçalı veri isteği
    add_viewer=True  # basit viewer
)

cog = TilerFactory()
app.include_router(cog.router, prefix="/cog")

app.include_router(stac_tiler.router, prefix="/stac")


class SatelliteDataRequest(BaseModel):
    type: str
    cloudCoverage: int
    selectedDate: str
    bbox: List[float]  # [minx, miny, maxx, maxy]
    width: int
    height: int
    polygon: dict


def compress_geotiff_lzw(input_bytes: bytes) -> bytes:
    """GeoTIFF'i LZW ile sıkıştır - bellekte"""
    try:
        # Önce veriyi rasterio ile aç
        with MemoryFile(input_bytes) as memfile:
            with memfile.open() as src:
                # Veriyi numpy array olarak oku
                data = src.read()
                profile = src.profile.copy()

                # LZW sıkıştırma parametrelerini ekle
                profile.update(
                    compress='lzw',
                    predictor=2,
                    tiled=True,
                    blockxsize=256,
                    blockysize=256
                )

                # Yeni sıkıştırılmış dosya oluştur
                with MemoryFile() as output_memfile:
                    with output_memfile.open(**profile) as dst:
                        dst.write(data)
                    # Sıkıştırılmış bytes'ı döndür
                    return output_memfile.read()

    except Exception as e:
        print(f"LZW sıkıştırma hatası detay: {str(e)}")
        import traceback
        traceback.print_exc()
        # Hata durumunda orijinal bytes'ı döndür
        return input_bytes


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
            "query": {"eo:cloud_cover": {"lt": 15}}
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
            for j, feature in enumerate(features):
                try:
                    titiler_params = None
                    stac_item_url = None
                    # Her feature için self URL'ini bul
                    for link in feature.get("links", []):
                        if link.get("rel") == "self":
                            stac_item_url = link["href"]
                            print(stac_item_url)
                            break

                    if not stac_item_url:
                        print(f"Feature {j+ 1} için self URL bulunamadı, atlanıyor")
                        continue



                    if (request.type == 'ndvi'):
                        titiler_params = {
                            "url": stac_item_url,
                            "expression": "(nir-red)/(nir+red)*(scl!=8)*(scl!=9)*(scl!=10)*(scl!=11)*(scl!=3)",
                            "asset_as_band": True,
                            "return_mask":True,
                            "rescale": "-1,1",


                        }

                    elif (request.type == 'moisture'):
                        titiler_params = {
                            "url": stac_item_url,
                            "minzoom": 0,
                            "maxzoom": 18,
                            "expression": "(nir08-swir16)/(nir08+swir16)*(scl!=8)*(scl!=9)*(scl!=10)*(scl!=11)*(scl!=3)",
                            "asset_as_band": True,
                            "return_mask": True,
                            "rescale": "-1,1",

                        }

                    elif (request.type == 'truecolor'):
                        titiler_params = {
                            "url": stac_item_url,
                            "assets": "visual",
                            "minzoom": 8,
                            "maxzoom": 24,
                        }


                    if titiler_params:
                        tilejson_url = f"{titiler_endpoint}/stac/feature/{request.height}x{request.width}.tif"
                        json_format = {
                            "type": "Feature",
                            "properties": {},
                            "geometry": request.polygon
                        }

                        tiffResponse = await client.post(
                            tilejson_url,
                            params=titiler_params,
                            json=json_format,
                            headers={"Content-Type": "application/json",
                                     "Accept": "image/tiff; application=geotiff"},
                            timeout=30.0
                        )
                        pngUrl=f"{titiler_endpoint}/stac/feature/{request.height}x{request.width}.png"
                        png_params = titiler_params.copy()
                        if(request.type == 'ndvi' or request.type == 'moisture'):
                            png_params["colormap_name"] = "viridis"
                        #bu colormap olayını koşullu yapmam gerekiyor ndvi için moisture için ve true color için farklı farklı olabilir
                        #burada önce bu veri var mı kontrol eden bir fonksiyon yazmam gerekiyor
                        #eğer yoksa bunları yapacak

                        pngResponse = await client.post(
                            pngUrl,
                            params=png_params,
                            json=json_format,
                            headers={"Content-Type": "application/json"},
                            timeout=30.0
                        )

                        account_id="1223123"
                        field_id="1"
                        date_folder=start_of_day
                        fileType=request.type
                        filename = f"{account_id}/{field_id}/{date_folder}/{fileType}"

                        compressed_data=compress_geotiff_lzw(tiffResponse.content)
                        s3_client.put_object(
                            Bucket="my-sentinel2-bucket",#burası en üstteki klasör
                            Key=filename+".tif",
                            Body=compressed_data,
                            ContentType="image/tiff",
                        )
                        s3_client.put_object(
                            Bucket="my-sentinel2-bucket",
                            Key=filename+".png",
                            Body=pngResponse.content,
                            ContentType="image/png",
                        )

                    tiff_url=f"https://my-sentinel2-bucket.s3.eu-north-1.amazonaws.com/{filename}.tif"
                    image_url=f"https://my-sentinel2-bucket.s3.eu-north-1.amazonaws.com/{filename}.png"
                    image_urls.append(tiff_url)
                    image_urls.append(image_url)
                    #burada daha değişiklik yapılacak
                    #sadece istediğim bulduğum görüntüyü alıp onun image url'ini ve tif url'ini vereceğim ama istediğim görüntü için birkaç şey yapmam gerekiyor
                    #colormap'e ayar çekilecek kendi colormapimiz mi yoksa hazır colormap mi




                except Exception as e:
                    print(f"Feature {j + 1} işlenirken hata: {str(e)}")
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