/* global assertNamespace, process, common, temperatureui */
require('./common/NamespaceUtils.js');
require('./common/logging/LoggingSystem.js');

assertNamespace('temperatureui');

temperatureui.Webserver = function Webserver() {

   var fs                   = require('fs');
   var express              = require('express');
   var path                 = require('node:path');

   var LOGGER               = common.logging.LoggingSystem.createLogger('Webserver');

   var DEFAULT_PORT         = 8101;
   var DEFAULT_LOG_LEVEL    = 'INFO';
   var DEFAULT_INDEX_FILE   = 'index.html';

   var webserverPort        = process.env.WEBSERVER_PORT ?? DEFAULT_PORT;
   var logLevel             = common.logging.Level[process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL];
   var app                  = express();
   var httpServer;
   var sensorData           = [];
   var webRootFolder        = path.resolve(path.dirname(process.argv[1]), '..') + '/webroot';

   common.logging.LoggingSystem.setMinLogLevel(logLevel);

   LOGGER.logInfo('log level = ' + logLevel.description);

   var sendInternalServerError = function sendInternalServerError(response, text) {
      response.writeHeader(500, {'Content-Type': 'text/plain'});  
      response.write(text);  
      response.end();
   };
   
   var setResponseHeader = function setResponseHeader(response) {
      var headers = {'Content-Type': 'application/json'};
      //headers['Access-Control-Allow-Origin'] = '*';
      response.set(headers);
   };

   var replaceSpacesInRequestUrlByEscapeSequence = function replaceSpacesInRequestUrlByEscapeSequence(request,response, next) {
      request.url = request.url.replace(/%20/g, ' ');
      next();
   };

   var handleFileRequests = function handleFileRequests(request, response) {
      var requestedDocumentPath = request.path;
      var absolutePathOfRequest = webRootFolder + requestedDocumentPath;
      
      LOGGER.logDebug('request (path=' + requestedDocumentPath + ',absolutePath=' + absolutePathOfRequest + ')');

      if (absolutePathOfRequest.endsWith('/')) {
         absolutePathOfRequest += DEFAULT_INDEX_FILE;
      } 
      
      if (!fs.existsSync(absolutePathOfRequest)) {  
         LOGGER.logInfo('requested file \"' + requestedDocumentPath + '\" does not exist -> sending internal server error (absolutePathOfRequest=' + absolutePathOfRequest + ')'); 
         sendInternalServerError(response, requestedDocumentPath + ' does not exist');
      } else {
         LOGGER.logDebug('returning ' + absolutePathOfRequest);
         response.sendFile(absolutePathOfRequest);
      }
   };

   app.get('*', replaceSpacesInRequestUrlByEscapeSequence);
   app.get('*', handleFileRequests );

   httpServer = app.listen(webserverPort, () => {
      LOGGER.logInfo('web server listening on port ' + webserverPort);
   });

   this.getHttpServer = function getHttpServer() {
      return httpServer;
   };
};