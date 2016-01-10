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
        $scope.userName = '';
        
        // load meeting
        if (!$scope.currentMeetingId) {
            $window.location = '/index.html';
        }
        meetingService.getRaw($scope.currentMeetingId).$loaded(function(meetData) {
            var creatorId = getCreatorId(meetData.users);
            userService.get(creatorId).then(function(userObj) {
                $scope.userName = userObj.user.fullName;
                $scope.$apply();
                
                if (!meetData.name) {
                    $window.$('.loading-wrap').hide();
                    $log.log('No such activity');
                    $window.location = '/index.html';
                }

                $scope.meeting = meetData;
                $scope.time = moment($scope.meeting.timeTitle).format($scope.timeFormat);

                if ($scope.meeting.where) {
                    var whereKeys = Object.keys($scope.meeting.where);
                    $scope.place = $scope.meeting.where[whereKeys[0]];
                } else {
                    $window.location = 'activity.html?act=' + $scope.currentMeetingId;
                }
                $window.$('.title').show();
                $window.$('.loading-wrap').hide();
            });
        });
        
        var getCreatorId = function(users) {
            for (var i in users) {
                if (users[i].creator) {
                    return i;
                }
            }
            return Object.keys(users)[0];
        }
        
        $scope.yes = function() {
            $window.location = 'activity.html?act=' + $scope.currentMeetingId + '&rsvp=1';
        }
        
        $scope.no = function() {
            $window.location = 'landing_page_confirm.html?act=' + $scope.currentMeetingId;
        }
    }]);
})();
