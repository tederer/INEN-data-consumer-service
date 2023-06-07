
var recursiveAssertObject = function recursiveAssertObject(parentObject, objects) {
   
   if (parentObject[objects[0]] === undefined) {
      parentObject[objects[0]] = {};  
   }
   
   var newParentObject = parentObject[objects[0]];
   
   if (objects.length > 1) {
      recursiveAssertObject(newParentObject, objects.slice(1));
   }
};

assertNamespace = function assertNamespace(namespace) {
   
   var rootObject = (typeof window === 'undefined') ? global : window;
   var objects = namespace.split('.');
   recursiveAssertObject(rootObject, objects);
};

assertNamespace('common.infrastructure.bus');

/**
 * A Bus enables components to communicate with each other by using publications and commands bound to topics. 
 * All the comminicating components need to know are the used topics -> they do not need to know each other.
 *
 * A topic (e.g. '/webapp/client/selectedCustomers') is a unique string that identifies the command and/or publication. 
 * The same topic can be used for commands and publications.
 *
 * When a component publishes some data on a topic, all components which subscribed to publications on that topic, will get
 * the published data. The bus remembers the last published data and provides them to components that subscribe later (late join).
 *
 * When a component sends a command on a topic, all components which subscribed to commands on that topic, will get
 * the data of the command. The bus does NOT remember command data -> later subscribing components will not get them (one shot).
 */
common.infrastructure.bus.Bus = (function () {

   var Bus = function Bus() {
      
      var publicationCallbacksPerTopic = {};
      var lastPublishedDataPerTopic = {};
      var commandCallbacksPerTopic = {};

      var add = function add(callback) {
         return { 
            relatedTo: function relatedTo(topic) {
               return {
                  to: function to(map) {
                     if (map[topic] === undefined) {
                        map[topic] = [];
                     }
                     var set = map[topic];
                     set[set.length] = callback;
                  }
               };
            }
         };
      }; 

      var invokeAllCallbacksOf = function invokeAllCallbacksOf(map) {
         return {
            ofType: function ofType(topic) {
               return {
                  withData: function withData(data) {
                     if (map[topic] !== undefined) {
                        map[topic].forEach(function(callback) {
                           callback(data);
                        });
                     }
                  }
               };
            }
         };
      };
      
      this.subscribeToPublication = function subscribeToPublication(topic, callback) {
         if(topic && (typeof callback === 'function')) {
            add(callback).relatedTo(topic).to(publicationCallbacksPerTopic);
            
            var lastPublishedData = lastPublishedDataPerTopic[topic];
            
            if (lastPublishedData) {
               callback(lastPublishedData);
            }
         }
      };
      
      this.subscribeToCommand = function subscribeToCommand(topic, callback) {
         if (topic && (typeof callback === 'function')) {
            add(callback).relatedTo(topic).to(commandCallbacksPerTopic);
         }
      };
      
      this.publish = function publish(topic, data) {
         lastPublishedDataPerTopic[topic] = data;
         invokeAllCallbacksOf(publicationCallbacksPerTopic).ofType(topic).withData(data);
      };
      
      this.sendCommand = function sendCommand(topic, data) {
         invokeAllCallbacksOf(commandCallbacksPerTopic).ofType(topic).withData(data);
      };
   };
   
   return Bus;
}());

assertNamespace('common.infrastructure.busbridge');

common.infrastructure.busbridge.CONNECTION_STATE_TOPIC = 'busbridge.connected';

/**
 * A BusBridge connects two busses by using a transport media (e.g. socket.io)
 * and it has the following responsibilities:
 *    1. transmit all commands and publications, the bridge is interested in, to the other bus
 *    2. publish all commands and publications received from the other bus
 *    3. publish the connection state of the bridge locally on the topic: 
 *            common.infrastructure.busbridge.CONNECTION_STATE_TOPIC
 */

/**
 * constructor for a BusBridge.
 *
 * bus                        the instance of the local common.infrastructure.bus.Bus
 * topicsToTransmit           an Array of topics that should get transmitted via the bridge
 * connectionFactoryFunction  a function that returns either a ClientSocketIoConnection or a ServerSocketIoConnection 
 *                              (located in common.infrastructure.busbridge.connection).
 */
common.infrastructure.busbridge.BusBridge = function BusBridge(bus, topicsToTransmit, connectionFactoryFunction) {

   var onConnectCallback = function onConnectCallback() {
      bus.publish(common.infrastructure.busbridge.CONNECTION_STATE_TOPIC, true);
   };
   
   var onDisconnectCallback = function onDisconnectCallback() {
      bus.publish(common.infrastructure.busbridge.CONNECTION_STATE_TOPIC, false);
   };
   
   var onMessageCallback = function onMessageCallback(message) {
      if (message.type === 'PUBLICATION') {
         bus.publish(message.topic, message.data);
      } else if (message.type === 'COMMAND') {
         bus.sendCommand(message.topic, message.data);
      }
   };

   var connection = connectionFactoryFunction(onConnectCallback, onDisconnectCallback, onMessageCallback);
   
   bus.publish(common.infrastructure.busbridge.CONNECTION_STATE_TOPIC, 'false');

   topicsToTransmit.forEach(function(topic) {
      bus.subscribeToPublication(topic, function(data) {
         var message = common.infrastructure.busbridge.MessageFactory.createPublicationMessage(topic, data);
         connection.send(message);
      });
      bus.subscribeToCommand(topic, function(data) {
         var message = common.infrastructure.busbridge.MessageFactory.createCommandMessage(topic, data);
         connection.send(message);
      });
   });
};
 

assertNamespace('common.infrastructure.busbridge');

/**
 * constructor for a bus bridge typically used in the browser.
 *
 * bus               the local bus instance
 * topicsToTransmit  an Array of topics that should get transmitted via the bridge
 * io                the socket.io instance
 */
common.infrastructure.busbridge.ClientSocketIoBusBridge = function ClientSocketIoBusBridge(bus, topicsToTransmit, io) {
   
   var clientConnectionFactoryFunction = function serverConnectionFactoryFunction(onConnectCallback, onDisconnectCallback, onMessageCallback) {
      return new common.infrastructure.busbridge.connection.ClientSocketIoConnection(io(), onConnectCallback, onDisconnectCallback, onMessageCallback);
   };

   this.prototype = new common.infrastructure.busbridge.BusBridge(bus, topicsToTransmit, clientConnectionFactoryFunction);
};


assertNamespace('common.infrastructure.busbridge.connection');

common.infrastructure.busbridge.connection.ClientSocketIoConnection = function ClientSocketIoConnection(socket, onConnectCallback, onDisconnectCallback, onMessageCallback) {
   
   var connected = false;
   
   var onMessage = function onMessage(rawMessage) {
      onMessageCallback(JSON.parse(rawMessage));
   };
   
   var onConnect = function onConnect() {
      connected = true;
      onConnectCallback();
   };
   
   var onDisconnect = function onDisconnect() {
      connected = false;
      onDisconnectCallback();
   };
   
   this.send = function send(data) {
      if (connected) {
         socket.emit('message', JSON.stringify(data));
      }
   };
   
   onDisconnectCallback();
   socket.on('connect', onConnect);
   socket.on('disconnect', onDisconnect);
   socket.on('message', onMessage);
};


assertNamespace('common.infrastructure.busbridge.connection');

common.infrastructure.busbridge.connection.ServerSocketIoConnection = function ServerSocketIoConnection(socketIoServer, onConnectCallback, onDisconnectCallback, onMessageCallback) {
   
   var sockets = [];
   var counter = 1;
   var latestPublicationMessagesByTopic = {};
   
   var Socket = function Socket(socketIoSocket, messageCallback, disconnectCallback) {
      
      this.id = counter++;
      var thisInstance = this;
      
      var onMessage = function onMessage(rawMessage) {
         messageCallback(rawMessage, thisInstance);
      };
      
      var onDisconnect = function onDisconnect() {
         socketIoSocket.removeListener('disconnect', onDisconnect);
         socketIoSocket.removeListener('message', onMessage);
         disconnectCallback(thisInstance);
      };
      
      this.send = function send(rawMessage) {
         socketIoSocket.emit('message', rawMessage);
      };
      
      socketIoSocket.on('disconnect', onDisconnect);
      socketIoSocket.on('message', onMessage);
   };
   
   var onMessage = function onMessage(rawMessage, sendingSocket) {
      var message = JSON.parse(rawMessage);
      onMessageCallback(message);
      
      if (message.type === 'PUBLICATION') {
         latestPublicationMessagesByTopic[message.topic] = message;
      }
   };
   
   var onDisconnect = function onDisconnect(disconnectedSocket) {
      var indexToDelete = sockets.indexOf(disconnectedSocket);
      
      if (indexToDelete >= 0) {
         sockets.splice(indexToDelete, 1);
      }
      
      if (sockets.length === 0) {
         onDisconnectCallback();
      }
   };
   
   var onConnection = function onConnection(newSocketIoSocket) {
      var newSocket = new Socket(newSocketIoSocket, onMessage, onDisconnect);
      sockets[sockets.length] = newSocket;
      
      if (sockets.length === 1) {
         onConnectCallback();
      }
      
      var topics = Object.keys(latestPublicationMessagesByTopic);
      topics.forEach(function(topic) {
         newSocket.send(JSON.stringify(latestPublicationMessagesByTopic[topic]));
      });
   };
   
   this.send = function send(message) {
      var serializedMessage = JSON.stringify(message);
      sockets.forEach(function(socket) { socket.send(serializedMessage); });
      
      if (message.type === 'PUBLICATION') {
         latestPublicationMessagesByTopic[message.topic] = message;
      }
   };

   socketIoServer.on('connection', onConnection);
};


assertNamespace('common.infrastructure.busbridge');

common.infrastructure.busbridge.MessageFactory = {
   
   createPublicationMessage: function createPublicationMessage(topic, data) {
      return {
         type: 'PUBLICATION',
         topic: topic,
         data: data
      };
   },
   
   createCommandMessage: function createCommandMessage(topic, data) {
      return {
         type: 'COMMAND',
         topic: topic,
         data: data
      };
   }
};


assertNamespace('common.infrastructure.busbridge');

/**
 * constructor for a bus bridge used where the https server is running.
 *
 * bus               the local bus instance
 * topicsToTransmit  an Array of topics that should get transmitted via the bridge
 * io                the socket.io instance
 */
common.infrastructure.busbridge.ServerSocketIoBusBridge = function ServerSocketIoBusBridge(bus, topicsToTransmit, io) {
   
   var serverConnectionFactoryFunction = function serverConnectionFactoryFunction(onConnectCallback, onDisconnectCallback, onMessageCallback) {
      return new common.infrastructure.busbridge.connection.ServerSocketIoConnection(io, onConnectCallback, onDisconnectCallback, onMessageCallback);
   };

   this.prototype = new common.infrastructure.busbridge.BusBridge(bus, topicsToTransmit, serverConnectionFactoryFunction);
};


function initMap() {
  var TemperatureOverlay = function TemperatureOverlay(geolocation) {
    var div;
    var geoLocation       = geolocation;
    var content           = '';
    
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

  var QR_CODE_SELECTOR  = '#qr-code';
  var overlays          = [];
  const map             = new google.maps.Map(document.getElementById('map'), {
    zoom: 17,
    center: { lat: 47.953207382719526, lng: 16.82328721874459 },
    mapTypeId: 'satellite'
  });

  var validSensorData = function validSensorData(sensorData) {
    return  (typeof sensorData                       === 'object') &&
            (typeof sensorData.timestamp             === 'number') &&
            (typeof sensorData.temperature           === 'number') &&
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
        overlay.setContent(data.temperature.toFixed(1) + ' °C');
      }
    });
  };

  var showQrCode = function showQrCode() {
    $(QR_CODE_SELECTOR).removeClass('invisible');
  };

  var hideQrCode = function hideQrCode() {
    $(QR_CODE_SELECTOR).addClass('invisible');
    setTimeout(showQrCode, 5000);
  };

  var bus              = new common.infrastructure.bus.Bus();
  var topicsToTransmit = [];
  new common.infrastructure.busbridge.ClientSocketIoBusBridge(bus, topicsToTransmit, io);

  bus.subscribeToPublication(temperatureui.shared.topics.SENSOR_VALUES, updateTemperatureOverlays);

  $(QR_CODE_SELECTOR).on('click', hideQrCode);
}

window.initMap = initMap;


assertNamespace('temperatureui.shared.topics');

//                PUBLICATIONS

/**
 * The server publishes on this topic the current values of the sensors.
 *
 * example: 
 * [
 *     {
 *         sensorId: 'sensor1',
 *         timestamp: 1684169382069,
 *         temperature: 4.5,
 *         geolocation: { longitude: 16.82379644619579, latitude: 47.95404620544281 }
 *     },
 *     {
 *         sensorId: 'sensor2',
 *         timestamp: 1684169396468,
 *         temperature: 3.7,
 *         geolocation: { longitude: 16.82279896886495, latitude: 47.952296393788174 }
 *     }
 * ]
 */
temperatureui.shared.topics.SENSOR_VALUES = '/shared/sensorValues';
