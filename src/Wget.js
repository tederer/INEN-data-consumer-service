/* global common, assertNamespace, temperatureui */

require('./common/NamespaceUtils.js');

assertNamespace('temperatureui');

temperatureui.Wget = function Wget() {

    const { exec } = require('node:child_process');

    this.query = async function query(urlAsString) {
        return new Promise((resolve, reject) => {
            exec('wget -q -O- --no-check-certificate ' + urlAsString, (error, stdout, stderr) => {
            if (error) {
                reject('failed to query ' + urlAsString + ': ' + error);
                return;
            }
            try {
                var parsedData = JSON.parse(stdout);
                resolve({statusCode: 200, data: parsedData});
            } catch (err) {
                reject('failed to parse "' + stdout + '" received for ' + urlAsString + ': ' + err);
            }
            });
            return;
        });
    };
};