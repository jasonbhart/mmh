;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.service('appConfig', function() {
        this.basePath = '';
        this.dataUrl = 'https://edgeprod.com:8081/';
        this.firebaseUrl = 'https://radiant-heat-9175.firebaseio.com';
        this.shareUrlBase = 'https://www.socialivo.com/meeting.html';
        this.defaultRadius = 1;     // km
        this.geoLocationTimeout = 20000;    // (20 sec)
    });
})();
