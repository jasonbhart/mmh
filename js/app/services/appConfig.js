;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.service('appConfig', function() {
        this.basePath = '';
        this.dataUrl = 'https://edgeprod.com:8081/';
        this.shareFacebookUrl = 'http://socialivo.com:8080/shareFacebook';
        this.firebaseUrl = 'https://radiant-heat-9175.firebaseio.com';
        this.shareUrlBase = 'https://www.socialivo.com/activity.html';
        this.defaultRadius = 1;     // km
        this.geoLocationTimeout = 20000;    // (20 sec)
        this.sendingEmail = 'support@socialivo.com';
        this.sendEmailURL = 'http://localhost:8080/sendEmail';
    });
})();
