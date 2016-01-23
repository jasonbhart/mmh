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
        $scope.currentUser = null;
        $scope.currentPage = util.getCurrentPage();
        $scope.currentMeetingId = util.getUrlParams('act');
        $window.$('.loading-wrap').show();
        $window.$('.time-clock').hide();
        $scope.userName = '';
        $scope.selectedTime = false;
        
        // load meeting
        if (!$scope.currentMeetingId) {
            $window.location = '/index.html';
        }
        
        sessionService.ready.then(function() {
            var initAuth = function(user) {
                $scope.currentUser = user;
            };
            
            meetingService.getRaw($scope.currentMeetingId).$loaded(function(meetData) {
                var creatorId = getCreatorId(meetData.users);
                
                if ($scope.currentUser.id == creatorId) {
                    $window.location = 'activity.html?act=' + $scope.currentMeetingId;
                }
                
                userService.get(creatorId).then(function(userObj) {
                    if (!meetData.name) {
                        $window.$('.loading-wrap').hide();
                        $window.location = '/index.html';
                    }

                    $window.$('.time-clock').show();
                    $scope.userName = userObj.user.fullName;
                    $scope.$apply();


                    $scope.meeting = meetData;
                    
                    $scope.time = moment($scope.meeting.timeTitle).format($scope.timeFormat);
                    var currentTime = moment().format($scope.timeFormat);
                    var futureTime = false;
                    
                    // select the nearest future time with current time, and get its object key
                    if ($scope.time < currentTime) {
                        angular.forEach($scope.meeting.when, function (time, key) {
                            var formattedTime = moment(time).format($scope.timeFormat);
                            if (formattedTime > currentTime) {
                                if (futureTime) {
                                    if (formattedTime < $scope.time) {
                                        $scope.time = formattedTime;
                                        $scope.selectedTime = key;
                                    }
                                } else {
                                    $scope.time = formattedTime;
                                    futureTime = true;
                                    $scope.selectedTime = key;
                                }
                            }
                        });
                    }

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
                util.addEventToDataLayer('Landing Page', 'Step 1', 'Select Yes', $scope.currentMeetingId);
                var redirectUrl = 'activity.html?act=' + $scope.currentMeetingId + '&rsvp=1';
                if ($scope.selectedTime) {
                    redirectUrl += '&selectedTime=' + $scope.selectedTime;
                }
                
                $window.location = redirectUrl;
            }

            $scope.no = function() {
                util.addEventToDataLayer('Landing Page', 'Step 1', 'Select No', $scope.currentMeetingId);
                $window.location = 'landing_page_confirm.html?act=' + $scope.currentMeetingId;
            }
        
            initAuth(sessionService.getCurrentUser());
        });
        
    }]);
})();
