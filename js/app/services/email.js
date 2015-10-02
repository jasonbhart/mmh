;(function() {
    "use strict";

    var app = angular.module('mmh.services');

    app.factory('emailService', ['appConfig', '$q', function(appConfig, $q) {
        var sendEmailToUsers = function (emails, notificationData) {
            console.log('Sending email to users', emails, notificationData);
        };
        
        return {
            sendEmailToUsers: sendEmailToUsers
        }
    }]);
})();
