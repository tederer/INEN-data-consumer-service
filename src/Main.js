/* global common, __dirname, process, temperatureui */

require('./common/logging/LoggingSystem.js');
require('./common/infrastructure/bus/Bus.js');
require('./common/infrastructure/busbridge/ServerSocketIoBusBridge.js');
require('./Webserver.js');
require('./DataPoller.js');
require('./SharedTopics.js');

const bus              = new common.infrastructure.bus.Bus();
const webserver        = new temperatureui.Webserver();
   
const { Server }       = require('socket.io');
const io               = new Server(webserver.getHttpServer());
const topicsToTransmit = [temperatureui.shared.topics.SENSOR_VALUES];

new common.infrastructure.busbridge.ServerSocketIoBusBridge(bus, topicsToTransmit, io);

new temperatureui.DataPoller(newSensorData => { 
    bus.publish(temperatureui.shared.topics.SENSOR_VALUES, newSensorData);
});
