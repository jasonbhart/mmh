;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('errorLoggingService', 
    ['appConfig',
    function(appConfig) {
        var ref = new Firebase(appConfig.firebaseUrl);
        
        var addLog = function (data) {
            ref.child('errors').push(data);
        };

        return {
            addLog: addLog
        };
    }]);
})();
