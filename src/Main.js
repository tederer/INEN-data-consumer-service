/* global common, __dirname, process, temperatureui */

require('./common/logging/LoggingSystem.js');
require('./common/infrastructure/bus/Bus.js');
require('./common/infrastructure/busbridge/ServerSocketIoBusBridge.js');
require('./Webserver.js');
require('./DataPoller.js');
require('./SharedTopics.js');
require('./Configuration.js');

var DEFAULT_LOG_LEVEL   = 'INFO';
   
var config      = new temperatureui.Configuration();
var fs          = require('fs');
var logLevel    = common.logging.Level[process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL];
var LOGGER      = common.logging.LoggingSystem.createLogger('Main');
var info        = {start: (new Date()).toISOString()};

common.logging.LoggingSystem.setMinLogLevel(logLevel);

var initInfo = function initInfo() {
    var result;
    try {
       var fileContent = fs.readFileSync(__dirname + '/../package.json', 'utf8');
       var packageJson = JSON.parse(fileContent);
       info.version    = packageJson.version;
       LOGGER.logInfo('version ' + info.version);
    } catch(e) {
       LOGGER.logError('failed to read version: ' + e);
    }
    return result;
};

initInfo();
LOGGER.logInfo('log level = ' + logLevel.description);

config.load().then(() => {
    const bus              = new common.infrastructure.bus.Bus();
    const webserver        = new temperatureui.Webserver(info);
       
    const { Server }       = require('socket.io');
    const io               = new Server(webserver.getHttpServer());
    const topicsToTransmit = [temperatureui.shared.topics.SENSOR_VALUES];
    
    new common.infrastructure.busbridge.ServerSocketIoBusBridge(bus, topicsToTransmit, io);
    
    new temperatureui.DataPoller(config, newSensorData => { 
        bus.publish(temperatureui.shared.topics.SENSOR_VALUES, newSensorData);
    });    
});
