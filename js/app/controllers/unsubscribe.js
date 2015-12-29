;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('UnsubscribeController', ['$scope', 'appConfig', 'emailService', 'util', 'sessionService', 'userService',
    function($scope, appConfig, emailService, util, sessionService, userService) {
        $scope.currentUser = null;
        sessionService.ready.then(function() {
            var initAuth = function(user) {
                $scope.currentUser = user;
                userService.get(user.id).then(function(userObj) {
                    userObj.meetingList.$loaded().then(function(data) {
                        userObj.removePassedActivities();
                        userObj.removeUnusedActivities(user.id);
                        $scope.meetingList = data;
                    });
                });
            }; 
            
            $scope.$on('auth.changed', function(evt, user) {
                initAuth(user);
            });

        });
        
        
        var userId = util.getUrlParams('user');
        var meetingId = util.getUrlParams('activity');
        
        if (!userId) {
            return false;
        }
        
        userId = decodeURIComponent(userId);
        
        if (!meetingId || meetingId === 'all') {
            emailService.unsubscribeAll(userId);
        } else {
            emailService.unsubscribeActivity(meetingId, userId);
        }
        
    }]);
})();