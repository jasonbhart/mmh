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
                console.log(user);
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
                userService.get($scope.currentUser.id).then(function(userObj) {
                    userObj.saveDistanceUnit($scope.distance_unit);
                });
            }
            
            $scope.setDisableEmailNotiConfig = function(value) {
                userService.get($scope.currentUser.id).then(function(userObj) {
                    userObj.setDisableEmailNoti(value);
                    $scope.disableEmailNoti = value;
                });
            };
        });
    }]);
})();
