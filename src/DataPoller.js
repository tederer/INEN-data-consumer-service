/* global assertNamespace, common, temperatureui, __dirname, process, URL, setTimeout */

require('./common/NamespaceUtils.js');
require('./common/logging/LoggingSystem.js');
require('./common/HttpClient.js');

assertNamespace('temperatureui');

temperatureui.DataPoller = function DataPoller(dataConsumer) {

    const HTTP_OK                   = 200;
    const HTTP_NO_CONTENT           = 204;
    
    const POLLING_INTERVAL_IN_MS    = 5000;
    const SENSORS_CONFIG_FILENAME   = 'sensors.json';

    const DEFAULT_PROVIDER_HOST     = 'localhost';
    const DEFAULT_PROVIDER_PORT     = 8100;

    var providerHost                = process.env.PROVIDER_HOST ?? DEFAULT_PROVIDER_HOST;
    var providerPort                = process.env.PROVIDER_PORT ?? DEFAULT_PROVIDER_PORT;
   
    var LOGGER                      = common.logging.LoggingSystem.createLogger('DataPoller');
    var httpClient                  = new common.HttpClient();
    var sensorConfigFilePath        = __dirname + '/../' + SENSORS_CONFIG_FILENAME;
    var sensorConfig;

    try {
        var fs                      = require('fs');
        var sensorConfigFileContent = fs.readFileSync(sensorConfigFilePath, 'utf8');
        sensorConfig                = JSON.parse(sensorConfigFileContent);
        if (sensorConfig.sensorPaths === undefined || sensorConfig.sensorPaths.length <= 0) {
            throw 'no sensors configured';
        }
        
    } catch(error) {
        LOGGER.logError('failed to read & parse configuration file (' + sensorConfigFilePath + '): ' + error);
        process.exit(1);
    }

    var currentTimeInMs = function currentTimeInMs() {
        return Date.now();
    };

    var processResponses = function processResponses(urls, responses) {
        var newSensorData = [];

        responses.forEach((response, index) => {
            if (response.status !== 'fulfilled') {
                LOGGER.logError('failed to poll sensor data: ' + response.reason);
            } else { 
                switch(response.value.statusCode) {
                    case HTTP_OK:           newSensorData.push(response.value.data);
                                            break;
                    case HTTP_NO_CONTENT:   LOGGER.logInfo('currently no data available for ' + urls[index]);
                                            break;
                    default:                LOGGER.logError('failed to poll ' + urls[index] + '(statusCode=' + response.value.statusCode + ')');
                                            break;
                }
            }
        });

        dataConsumer(newSensorData);
    };

    var pollData = async function pollData() {
        var startOfPolling = currentTimeInMs();
        var pendingPollings = [];
        var urls = [];

        sensorConfig.sensorPaths.forEach(async sensorPath => {
            var url = new URL('http://' + providerHost + ':' + providerPort + sensorPath);
            var promise = httpClient.get(url.hostname, Number.parseInt(url.port), url.pathname);
            pendingPollings.push(promise);
            urls.push(url);
        });
        Promise.allSettled(pendingPollings).then(processResponses.bind(this, urls));

        var endOfPolling = currentTimeInMs();
        var sleepDuration = Math.max(0, POLLING_INTERVAL_IN_MS - (endOfPolling - startOfPolling));
        setTimeout(pollData, sleepDuration);
    };

    pollData();
};