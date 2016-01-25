;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('SettingController', ['$scope', 'sessionService', 'util','$window', 'appConfig', 'userService', '$firebaseObject', '$q',
            function ($scope, sessionService, util, $window, appConfig, userService, $firebaseObject, $q) {
        $scope.currentUser = null;
        $scope.disableEmailNoti = false;
        
        $window.$('.loading-wrap').show();
        
        sessionService.ready.then(function() {
            var initAuth = function(user) {
                $scope.currentUser = user;
                $scope.disableEmailNoti = user.getDisableEmailNoti();
                $scope.distance_unit = user.user.distance_unit || 'foot';
                $window.$('.loading-wrap').hide();
                userService.get(user.id).then(function(userObj) {
                    userObj.meetingList.$loaded().then(function(data) {
                        userObj.removePassedActivities();
                        userObj.removeUnusedActivities(user.id);
                        $scope.meetingList = data;
                    });
                });
            }; 
            
            initAuth(sessionService.getCurrentUser());
            
            $scope.$on('auth.changed', function(evt, user) {
                initAuth(user);
            });
            
            $scope.changeDistanceUnit = function() {
                $window.$('.loading-wrap').show();
                util.addEventToDataLayer('Setting Page', 'Change distance unit', $scope.distance_unit, null);
                showSuccessMessage('Distance unit has been changed to ' + $scope.distance_unit);
                userService.get($scope.currentUser.id).then(function(userObj) {
                    userObj.saveDistanceUnit($scope.distance_unit);
                    $window.$('.loading-wrap').hide();
                });
            }
            
            $scope.setDisableEmailNotiConfig = function(value) {
                $window.$('.loading-wrap').show();
                if (value) {
                    util.addEventToDataLayer('Setting Page', 'Change email notification setting', 'Off', null);
                    showSuccessMessage('Email Notification has been disabled');
                } else {
                    util.addEventToDataLayer('Setting Page', 'Change email notification setting', 'On', null);
                    showSuccessMessage('Email Notification has been enabled');
                }
                userService.get($scope.currentUser.id).then(function(userObj) {
                    userObj.setDisableEmailNoti(value);
                    $scope.disableEmailNoti = value;
                    $window.$('.loading-wrap').hide();
                });
            };
        });
        
        var showSuccessMessage = function(message) {
            $('.alert-success span').text(message);
            $('.alert-success').show().fadeOut(10000);
        }
    }]);
})();
