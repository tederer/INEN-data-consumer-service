/* global common, google, setTimeout, window, temperatureui, io */

function initMap() {
  var TemperatureOverlay = function TemperatureOverlay(geolocation) {
    var div;
    var geoLocation = geolocation;
    var content     = '';
  
    this.getGeoLocation = function getGeoLocation() {
      return geoLocation;
    };
  
    this.setContent = function setContent(text) {
      content       = text;
      if (div !== undefined) {
        div.innerText = content;
      }
    };
  
    this.onAdd = function onAdd() {
      div           = document.createElement('div');
      div.id        = 'temperatureOverlay';
      div.innerText = content;
  
      this.getPanes().overlayLayer.appendChild(div);
    };
  
    this.draw = function draw() {
      if (div !== undefined) {
        const pixelPosition = this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(geolocation.latitude, geolocation.longitude));
        div.style.left      = (pixelPosition.x - div.clientWidth / 2) + 'px';
        div.style.top       = (pixelPosition.y - div.clientHeight / 2) + 'px';
      }
    };
  
    this.onRemove = function onRemove() {
      if (div !== undefined) {
        div.parentNode.removeChild(div);
        div = undefined;
      }
    };
  };
    
  TemperatureOverlay.prototype = new google.maps.OverlayView();

  var overlays = [];
  const map    = new google.maps.Map(document.getElementById('map'), {
    zoom: 17,
    center: { lat: 47.953207382719526, lng: 16.82328721874459 },
    mapTypeId: 'satellite'
  });

  var validSensorData = function validSensorData(sensorData) {
    return  (typeof sensorData                       === 'object') &&
            (typeof sensorData.timestamp             === 'number') &&
            (typeof sensorData.unit                  === 'string') &&
            (typeof sensorData.value                 === 'number') &&
            (typeof sensorData.geolocation           === 'object') &&
            (typeof sensorData.geolocation.longitude === 'number') &&
            (typeof sensorData.geolocation.latitude  === 'number');
  };

  var compareGeoLocation = function compareGeoLocation(a, b) {
    return  (a !== undefined) && 
            (b !== undefined) &&
            (a.longitude === b.longitude) && 
            (a.latitude === b.latitude);
  };

  var getOverlay = function getOverlay(geolocation) {
    var overlay = overlays.find(overlay => compareGeoLocation(overlay.getGeoLocation(), geolocation));
    if (overlay === undefined) {
      overlay = new TemperatureOverlay(geolocation);
      overlay.setMap(map);
      overlays.push(overlay);
    }
    return overlay;
  };

  var removeOverlaysWithoutData = function removeOverlaysWithoutData(sensorData) {
    var overlayIndicesToDelete = [];
    
    overlays.forEach((overlay, index) => {
      var result = sensorData.find(data => compareGeoLocation(data.geolocation, overlay.getGeoLocation()));
      if (result === undefined) {
        overlayIndicesToDelete.push(index);
      }
    });

    if (overlayIndicesToDelete.length > 0) {
      var newOverlays = [];
    
      overlays.forEach((overlay, index) => {
        if (overlayIndicesToDelete.find(x => x === index) === undefined) {
          newOverlays.push(overlay);
        } else {
          overlay.onRemove();
        }
      });

      overlays = newOverlays;
    }
  };

  var updateTemperatureOverlays = function updateTemperatureOverlays(sensorData) {
    removeOverlaysWithoutData(sensorData);

    sensorData.forEach(data => {
      if (validSensorData(data)) {
        var overlay = getOverlay(data.geolocation);
        overlay.setContent(data.value.toFixed(1) + ' ' + data.unit);
      }
    });
  };

  var bus              = new common.infrastructure.bus.Bus();
  var topicsToTransmit = [];
  new common.infrastructure.busbridge.ClientSocketIoBusBridge(bus, topicsToTransmit, io);

  bus.subscribeToPublication(temperatureui.shared.topics.SENSOR_VALUES, updateTemperatureOverlays);
}

window.initMap = initMap;
