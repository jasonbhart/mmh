;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.service('appConfig', function() {
        this.basePath = '';
        this.productionBasePath = 'https://www.socialivo.com/';
        this.dataUrl = 'https://edgeprod.com:8081/';
        this.shareFacebookUrl = 'http://socialivo.com:8080/shareFacebook';
        this.firebaseUrl = 'https://radiant-heat-9175.firebaseio.com';
        this.shareUrlBase = 'https://www.socialivo.com/activity.html';
        this.defaultRadius = 1;     // km
        this.geoLocationTimeout = 20000;    // (20 sec)
        this.sendingEmail = 'no-reply@socialivo.com';
        this.replyEmail = 'jason@socialivo.com';
        this.sendEmailURL = 'https://edgeprod.com:8081/sendEmail';
//        this.sendEmailURL = 'http://localhost:8080/sendEmail';
    });
})();
