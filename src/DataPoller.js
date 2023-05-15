/* global assertNamespace, common, temperatureui, __dirname, process, URL, setTimeout */

require('./common/NamespaceUtils.js');
require('./common/logging/LoggingSystem.js');
require('./common/HttpClient.js');

assertNamespace('temperatureui');

temperatureui.DataPoller = function DataPoller(dataConsumer) {

    const POLLING_INTERVAL_IN_MS    = 1000;
    const SENSORS_CONFIG_FILENAME   = 'sensors.json';

    var LOGGER                      = common.logging.LoggingSystem.createLogger('DataPoller');
    var httpClient                  = new common.HttpClient();
    var sensorConfigFilePath        = __dirname + '/../' + SENSORS_CONFIG_FILENAME;
        
    try {
        var fs                      = require('fs');
        var sensorConfigFileContent = fs.readFileSync(sensorConfigFilePath, 'utf8');
        var sensorConfig            = JSON.parse(sensorConfigFileContent);
        if (sensorConfig.sensorUrls === undefined || sensorConfig.sensorUrls.length <= 0) {
            throw 'no sensors configured';
        }
        
    } catch(error) {
        LOGGER.logError('failed to read & parse configuration file (' + sensorConfigFilePath + '): ' + error);
        process.exit(1);
    }

    var currentTimeInMs = function currentTimeInMs() {
        return Date.now();
    };

    var processResponses = function processResponses(responses) {
        var newSensorData = [];

        responses.forEach(response => {
            if (response.status !== 'fulfilled') {
                LOGGER.logError('failed to poll sensor data: ' + response.reason);
                return;
            } 

            if (response.value.statusCode !== 200) {
                LOGGER.logError('statusCode (' + response.value.statusCode + ') is not equal 200.');
                return;
            }

            newSensorData.push(response.value.data);
        });

        dataConsumer(newSensorData);
    };

    var pollData = async function pollData() {
        var startOfPolling = currentTimeInMs();
        var pendingPollings = [];
        
        sensorConfig.sensorUrls.forEach(async sensorUrl => {
            var url = new URL(sensorUrl);
            var promise = httpClient.get(url.hostname, Number.parseInt(url.port), url.pathname);
            pendingPollings.push(promise);
        });
        Promise.allSettled(pendingPollings).then(processResponses);

        var endOfPolling = currentTimeInMs();
        var sleepDuration = Math.max(0, POLLING_INTERVAL_IN_MS - (endOfPolling - startOfPolling));
        setTimeout(pollData, sleepDuration);
    };

    pollData();
};