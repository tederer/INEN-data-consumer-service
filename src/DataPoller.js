/* global assertNamespace, common, temperatureui, __dirname, process, URL, setTimeout */

require('./common/NamespaceUtils.js');
require('./common/logging/LoggingSystem.js');
require('./Wget.js');
require('./common/HttpClient.js');

assertNamespace('temperatureui');

temperatureui.DataPoller = function DataPoller(config, dataConsumer) {

    const HTTP_OK                   = 200;
    const HTTP_NO_CONTENT           = 204;
    
    const POLLING_INTERVAL_IN_MS    = 5000;
    
    var LOGGER                      = common.logging.LoggingSystem.createLogger('DataPoller');
    var startOfPolling;
    //var wget                        = new temperatureui.Wget();
    var httpClient                  = new common.HttpClient();

    var currentTimeInMs = function currentTimeInMs() {
        return Date.now();
    };

    var processResponses = function processResponses(urls, responses) {
        var newSensorData = [];

        responses.forEach((response, index) => {
            if (response.status !== 'fulfilled') {
                LOGGER.logError('failed to poll ' + urls[index] + ': ' + response.reason);
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
        var pendingPollings = [];
        var urls = [];
        startOfPolling = currentTimeInMs();
        
        config.getPaths().forEach(async sensorPath => {
            var auth = config.getAuth();
            if (auth.length > 0) {
                auth += '@';
            }
            var url = config.getProtocol() + '//' + auth + config.getHost() + ':' + config.getPort() + sensorPath;
            pendingPollings.push(httpClient.get(url));
            urls.push(url);
        });
        Promise.allSettled(pendingPollings)
            .then(processResponses.bind(this, urls))
            .finally(() => {
                var endOfPolling = currentTimeInMs();
                var sleepDuration = Math.max(0, POLLING_INTERVAL_IN_MS - (endOfPolling - startOfPolling));
                setTimeout(pollData, sleepDuration);
            });
    };

    pollData();
};