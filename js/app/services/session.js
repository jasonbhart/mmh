;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('sessionService', ['$q', '$firebaseObject', '$firebaseArray', '$log', 'appConfig', function($q, $firebaseObject, $firebaseArray, $log, appConfig) {
        return {
            get: function(id) {
                return new User(id, $q, appConfig, $firebaseObject, $firebaseArray, $log);
            }
        };
    }]);
})();
