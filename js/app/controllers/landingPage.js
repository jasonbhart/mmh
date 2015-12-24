;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');
    
    app.controller('landingPageController', ['$scope', '$q', '$log', '$firebaseObject', '$firebaseArray', 'dialogs', 'dataProvider', 'sessionService', 'meetingService', 'userService', 'geoLocation', 'userGroupBuilder','$window', 'util', 'notificationService', 'emailService','localMeetingService', 'categoryService','historyService','commentService',
            function($scope, $q, $log, $firebaseObject, $firebaseArray, dialogs, dataProvider, sessionService, meetingService, userService, geoLocation, userGroupBuilder, $window, util, notificationService, emailService, localMeetingService, categoryService, historyService, commentService) {

        // get from the session
        $scope.timeFormat = 'h:mmA';
        $scope.time = '';
        $scope.place = {};
        $scope.meeting = null;
        $scope.currentPage = util.getCurrentPage();
        $scope.currentMeetingId = util.getUrlParams('act');
        $window.$('.loading-wrap').show();
        
        // load meeting
        if (!$scope.currentMeetingId) {
            $window.location = '/index.html';
        }
        meetingService.getRaw($scope.currentMeetingId).$loaded(function(meetData) {
            if (!meetData.name) {
                $window.$('.loading-wrap').hide();
                $log.log('No such activity');
                $window.location = '/index.html';
            }
            
            $scope.meeting = meetData;
            $scope.time = moment($scope.meeting.timeTitle).format($scope.timeFormat);
            var whereKeys = Object.keys($scope.meeting.where);
            if (whereKeys[0]) {
                $scope.place = $scope.meeting.where[whereKeys[0]];
            } else {
                $window.location = 'activity.html?act=' + $scope.currentMeetingId;
            }
            $window.$('.loading-wrap').hide();
        });
        
        $scope.yes = function() {
            $window.location = 'activity.html?act=' + $scope.currentMeetingId + '&rsvp=1';
        }
        
        $scope.no = function() {
            $window.location = 'landing_page_confirm.html?act=' + $scope.currentMeetingId;
        }
    }]);
})();
