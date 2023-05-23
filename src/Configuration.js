/* global assertNamespace, common, temperatureui, __dirname, process, setTimeout */

require('./common/NamespaceUtils.js');
require('./common/logging/LoggingSystem.js');
require('./common/HttpClient.js');

assertNamespace('temperatureui');

temperatureui.Configuration = function Configuration() {
    const DEFAULT_PROVIDER_HOST     = 'localhost';
    const DEFAULT_PROVIDER_PORT     = 8100;
    
    const SENSORS_CONFIG_FILENAME   = 'sensors.json';
    var LOGGER                      = common.logging.LoggingSystem.createLogger('Configuration');
    
    var configUrl                   = process.env.CONFIG_URL;
    var host;
    var port;                        
    var paths                       = [];
    var sensorConfigFilePath        = __dirname + '/../' + SENSORS_CONFIG_FILENAME;
    var sensorConfig;

    var loadConfigFromLocalFile = function loadConfigFromLocalFile() {
        return new Promise((resolve, reject) => {
            LOGGER.logInfo('using config in local file');
            try {
                var fs                      = require('fs');
                var sensorConfigFileContent = fs.readFileSync(sensorConfigFilePath, 'utf8');
                sensorConfig                = JSON.parse(sensorConfigFileContent);
                if (sensorConfig.sensorPaths === undefined || sensorConfig.sensorPaths.length <= 0) {
                    LOGGER.logError('no sensors configured');
                    reject();
                    return;
                }
                host  = process.env.PROVIDER_HOST ?? DEFAULT_PROVIDER_HOST;
                port  = process.env.PROVIDER_PORT ?? DEFAULT_PROVIDER_PORT;
                paths = sensorConfig.sensorPaths;
                resolve();
            } catch(error) {
                LOGGER.logError('failed to read & parse configuration file (' + sensorConfigFilePath + '): ' + error);
                reject();
            }
        });
    };
    
    var loadConfigFromUrl = function loadConfigFromUrl() {
        return new Promise((resolve, reject) => {
            LOGGER.logInfo('loading config from ' + configUrl);
            var httpClient = new common.HttpClient();
            var request    = httpClient.get(configUrl); 
            
            Promise.allSettled([request])
                .then(responses => {
                    if (responses[0].status !== 'fulfilled') {
                        LOGGER.logError('promise of HTTP GET request not fulfilled: ' + responses[0].reason);
                        reject();
                        return;
                    }
                    if (responses[0].value.statusCode !== 200) {
                        LOGGER.logError('status code of HTTP GET request not 200 (statusCode = ' + responses[0].value.statusCode + ')');
                        reject();
                        return;
                    }
                    host  = responses[0].value.data.host;
                    port  = responses[0].value.data.port;
                    paths = responses[0].value.data.sensorPaths;
                    resolve();
                })
                .catch(error => {
                    LOGGER.logError('HTTP GET request failed: ' + error);
                    reject();
                });
        });
    };

    this.load = function load() {
        return new Promise((resolve, reject) => {
            var promise = (typeof configUrl === 'string') ? loadConfigFromUrl() : loadConfigFromLocalFile();
            promise
                .then(() => {
                    LOGGER.logInfo('host=' + host);
                    LOGGER.logInfo('port=' + port);
                    LOGGER.logInfo('paths=' + paths);
                    resolve();
                })
                .catch(err => {
                    reject(err);
                });
        });
    };        
    
    this.getHost = function getHost() {
        return host;
    };

    this.getPort = function getPort() {
        return port;
    };

    this.getPaths = function getPaths() {
        return paths;
    };
};
