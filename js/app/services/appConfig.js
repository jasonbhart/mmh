;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.service('appConfig', function() {
        this.firebaseUrl = 'https://radiant-heat-9175.firebaseio.com';
        this.shareUrlBase = 'https://radiant-heat-9175.firebaseapp.com/';
    });
})();
