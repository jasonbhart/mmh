;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('HistoryController', ['$scope', 'meetingInfo', 'sessionService', 'util', 'geoLocation','$window', 'googleMap','historyService', 'appConfig', 'userService', 'meetingService', '$firebaseObject', '$q',
            function ($scope, meetingInfo, sessionService, util, geoLocation, $window, googleMap, historyService, appConfig, userService, meetingService, $firebaseObject, $q) {
        $scope.currentUser = null;
        $scope.baseUrl = 'https://www.socialivo.com/';
        var ref = new Firebase(appConfig.firebaseUrl + '/meets');
        $scope.rsvpMeetingList = [];
        $scope.currentPage = 5;
        $scope.history = [];
        
        sessionService.ready.then(function() {
            var initAuth = function(user) {
                $scope.currentUser = user;
                userService.get(user.id).then(function(userObj) {
                    userObj.meetingList.$loaded().then(function(data) {
                        userObj.removePassedActivities();
                        userObj.removeUnusedActivities(user.id);
                        $scope.meetingList = data;
                    });
                    
                    if (!sessionService.getViewedTutorialStatus()) {
                        $scope.startTutorial();
                        sessionService.setViewedTutorialStatus();
                    }
                });
                
                historyService.getLastHistory(user.id).then(function(history) {
                    $scope.history = history.reverse();
                    console.log(history);
                }); 
            }; 
            
            $scope.$on('auth.changed', function(evt, user) {
                initAuth(user);
            });

        });
        
        $scope.getMeetingName = function(meeting, includeTime) {
            return meetingService.getMeetingName(meeting, includeTime);
        };
        
        $scope.getDate = function (isoString) {
            return moment(isoString).format('MMMM Do YYYY');
        }
        
    }]);
})();
