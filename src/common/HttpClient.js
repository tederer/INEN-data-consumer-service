/* global common, assertNamespace, URL */

require('./NamespaceUtils.js');

assertNamespace('common');

const http  = require('http');
const https = require('https');

common.HttpClient = function HttpClient() {

   const TIMEOUT_IN_MS = 20 * 1000;
   
   var request = async function request(urlAsString, method, data) {
      var requestSendsDataInBody = (typeof method === 'string') && ((method === 'POST') || (method === 'DELETE'));
      var inputIsValid = (typeof urlAsString === 'string') && 
                         (typeof method      === 'string') && 
                         (!requestSendsDataInBody || (requestSendsDataInBody && (data !== undefined)));

      if (!inputIsValid) {
         return Promise.reject('request() got called with invalid arguments (urlAsString=' + urlAsString + ', method=' + method + ', data=' + JSON.stringify(data) + ')');
      }

      return new Promise((resolve, reject) => {
         var url;
         try {
            url = new URL(urlAsString);
         } catch(error) {
            reject('string \"' + urlAsString + '\" cannot get converted to an URL');
            return;
         }

         const options = {
            method:  method.toUpperCase(),
            timeout: TIMEOUT_IN_MS
         };

         var client = http;

         if (url.protocol.toUpperCase() === 'HTTPS:') {
            client = https;
            options.rejectUnauthorized = false;
         }
         
         var httpRequest = client.request(url, options, response => {
            var data = '';
            response.setEncoding('utf8');
            response.on('data',  chunk => data += chunk);
            response.on('error', error => reject('response error (url=' + urlAsString + '): ' + error));
            response.on('end', () => {
               var parsedData;
               var dataToParse = (data.length === 0) ? '""' : data;
               try {
                  parsedData = JSON.parse(dataToParse);
               } catch(error) {
                  reject('failed to parse "' + dataToParse + '": ' + error);
                  return;
               }
               
               resolve({statusCode: response.statusCode, data: parsedData});
            });
         });

         httpRequest.on('error',   error => reject('request error (url=' + urlAsString + '): ' + error));
         httpRequest.on('timeout', () => reject('request timed out (url=' + urlAsString + ')'));
         if (requestSendsDataInBody) {
            var contentToSend = JSON.stringify(data);
            httpRequest.setHeader('Content-Type', 'application/json');
            httpRequest.setHeader('Content-Length', contentToSend.length); 
            httpRequest.write(contentToSend, 'utf8');
         }
         httpRequest.end();
      });
   };

   /**
    * Sends a HTTP GET request to the provided url.
    * 
    * returns an object containing the statusCode and the received data.
    */
   this.get = async function get(urlAsString) {
      return request(urlAsString, 'GET');
   };

   /**
    * Sends a HTTP POST request containing data (as content type "application/json") to the provided url.
    * 
    * returns an object containing the statusCode and the received data.
    */
    this.post = async function post(urlAsString, data) {
      return request(urlAsString, 'POST', data);
   };

   /**
    * Sends a HTTP DELETE request containing data (as content type "application/json") to the provided url.
    * 
    * returns an object containing the statusCode and the received data.
    */
    this.delete = async function del(urlAsString, data) {
      return request(urlAsString, 'DELETE', data);
   };
};
