/* global assertNamespace, common, temperatureui, __dirname, process, URL, setTimeout */

require('./common/NamespaceUtils.js');
require('./common/logging/LoggingSystem.js');

assertNamespace('temperatureui');

temperatureui.DataPoller = function DataPoller(config, dataConsumer) {

    const HTTP_OK                   = 200;
    const HTTP_NO_CONTENT           = 204;
    
    const POLLING_INTERVAL_IN_MS    = 5000;
    
    var LOGGER                      = common.logging.LoggingSystem.createLogger('DataPoller');
    var httpClient                  = new common.HttpClient();
    
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

        config.getPaths().forEach(async sensorPath => {
            var url = 'http://' + config.getHost() + ':' + config.getPort() + sensorPath;
            pendingPollings.push(httpClient.get(url));
            urls.push(url);
        });
        Promise.allSettled(pendingPollings).then(processResponses.bind(this, urls));

        var endOfPolling = currentTimeInMs();
        var sleepDuration = Math.max(0, POLLING_INTERVAL_IN_MS - (endOfPolling - startOfPolling));
        setTimeout(pollData, sleepDuration);
    };

    pollData();
};