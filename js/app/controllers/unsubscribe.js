;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('UnsubscribeController', ['$scope', 'appConfig', 'emailService', 'util',
    function($scope, appConfig, emailService, util) {
        var userId = util.getUrlParams('user');
        var meetingId = util.getUrlParams('activity');
        
        if (!userId) {
            return false;
        }
        
        if (!meetingId || meetingId === 'all') {
            emailService.unsubscribeAll(userId);
        } else {
            emailService.unsubscribeActivity(meetingId, userId);
        }
        
    }]);
})();