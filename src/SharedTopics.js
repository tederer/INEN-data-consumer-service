/* global temperatureui, assertNamespace */

require('./common/NamespaceUtils.js');

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
