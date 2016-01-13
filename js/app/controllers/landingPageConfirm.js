;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    app.controller('landingPageConfirmController', ['$scope', '$q', '$log', '$firebaseObject', '$firebaseArray', 'dialogs', 'dataProvider', 'sessionService', 'meetingService', 'userService', 'geoLocation', 'userGroupBuilder','$window', 'util', 'notificationService', 'emailService','localMeetingService', 'categoryService','historyService','commentService',
            function($scope, $q, $log, $firebaseObject, $firebaseArray, dialogs, dataProvider, sessionService, meetingService, userService, geoLocation, userGroupBuilder, $window, util, notificationService, emailService, localMeetingService, categoryService, historyService, commentService) {

        // get from the session
        $scope.currentMeetingId = util.getUrlParams('act');
        
        // load meeting
        if (!$scope.currentMeetingId) {
            $window.location = '/index.html';
        }
        
        $scope.suggestTime = function() {
            util.addEventToDataLayer('Landing Page', 'Step 2', 'Select Time', $scope.currentMeetingId);
            $window.location = 'activity.html?act=' + $scope.currentMeetingId + '&addTime=1';
        }
        
        $scope.suggestPlace = function() {
            util.addEventToDataLayer('Landing Page', 'Step 2', 'Select Venue', $scope.currentMeetingId);
            $window.location = 'activity.html?act=' + $scope.currentMeetingId + '&addPlace=1';
        }
        
        $scope.noSuggest = function() {
            util.addEventToDataLayer('Landing Page', 'Step 2', 'Select No', $scope.currentMeetingId);
            $window.location = 'activity.html?act=' + $scope.currentMeetingId;
        }
    }]);
})();
