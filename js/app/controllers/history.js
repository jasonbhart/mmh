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
        $scope.numberOfItem = 10;
        $scope.showedAll = false;
        
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
                
                historyService.getLastHistory(user.id, $scope.numberOfItem).then(function(history) {
                    $scope.history = categoryHistoryByDate(history);
                    if (history.length < $scope.numberOfItem) {
                        $scope.showedAll = true;
                    }
                }); 
            }; 
            
            $scope.$on('auth.changed', function(evt, user) {
                initAuth(user);
            });

        });
        
        var categoryHistoryByDate = function (history) {
            var historyByDate = [];
            for (var i in history) {
                var date = moment(history[i].time).format('dddd MMMM, Do');
                history[i].date = date;

                historyByDate[date] || (historyByDate[date] = []);
                historyByDate[date].push(history[i]);
            }
            return Object.keys(historyByDate).map(function(date) {
                return historyByDate[date];
            }).reverse();
        }
        
        $scope.getMeetingName = function(meeting, includeTime) {
            return meetingService.getMeetingName(meeting, includeTime);
        };
        
        $scope.getDate = function (isoString) {
            return moment(isoString).format('MMMM Do YYYY');
        }
        
        $scope.showAllHistory = function () {
            historyService.getLastHistory($scope.currentUser.id, 100).then(function(history) {
                $scope.history = categoryHistoryByDate(history);
                $scope.showedAll = true;
            });
            
        }
        
    }]);
})();
