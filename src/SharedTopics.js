/* global temperatureui, assertNamespace */

require('./common/NamespaceUtils.js');

assertNamespace('temperatureui.shared.topics');

//                PUBLICATIONS

/**
 * The server publishes on this topic the current values of the sensors.
 *
 * example: 
 * TODO
 */
temperatureui.shared.topics.SENSOR_VALUES = '/shared/sensorValues';
