;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('HistoryController', ['$scope', 'meetingInfo', 'sessionService', 'util', 'geoLocation','$window', 'googleMap','historyService', 'appConfig', 'userService', 'meetingService', '$firebaseObject', '$q','categoryService',
            function ($scope, meetingInfo, sessionService, util, geoLocation, $window, googleMap, historyService, appConfig, userService, meetingService, $firebaseObject, $q, categoryService) {
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
        
        $scope.createActivity = function (meetId) {
            $window.$('.loading-wrap').show();
            meetingService.getRaw(meetId).$loaded(function(meetData) {
                var times   = getTimeFromTemplate(meetData.when);
                var places  = getPlaceFromTemplate(meetData.where);
                var users = {};
                if ($scope.currentUser && $scope.currentUser.id) {
                    users[$scope.currentUser.id] = {
                        joined: true,
                        where: util.getFirebaseKeys(places),
                        when: util.getFirebaseKeys(times)
                    };
                }
                var data = {
                    name: meetData.name,
                    createdDate: moment().utc().toISOString(),
                    when: times,
                    where: places,
                    users: users,
                    timeTitle: changeDateToToday(meetData.timeTitle || meetData.createdDate),
                    specific_location: meetData.specific_location || '',
                    category: meetData.category || 'Other'
                };
                
                var meetingPromise = meetingService.create(data);
                meetingPromise.then(function(meeting) {
                    var meetingId = meeting.refs.current.key();
                    
                    data.meetingId = meetingId;
                    $scope.redirectUrl = 'activity.html?act=' + meetingId;

                    addMeetingToCategory(data);
                    $window.$('.loading-wrap').hide();

                    setTimeout(function() {
                        $window.location.href = $scope.redirectUrl;
                    }, 1000);
                });
            });
        }
        
        var getTimeFromTemplate = function (oldTimes) {
            var result  = {};
            var times   = angular.copy(oldTimes);
           
            for (var i in times) {
                var key = util.generateKey();
                result[key] = changeDateToToday(times[i].$value);
            }
            return result;
        };
        
        var getPlaceFromTemplate = function (oldPlaces) {
            var result   = {};
            var places   = angular.copy(oldPlaces);
            for (var i in places) {
                var key = util.generateKey();
                result[key] = places[i];
            }
            return result;
        };
        
        var changeDateToToday = function (pastMoment) {
            var timeWithoutDate = moment(pastMoment).format('HH:mm:ss');
            return moment(timeWithoutDate, 'HH:mm:ss').utc().toISOString();
        };
        var addMeetingToCategory = function(data) {
            var categoryId = data.category;
            
            var meetingData = {
                id: data.meetingId,
                name: data.name,
                createdDate: data.createdDate,
                timeTitle: data.timeTitle
            } ;
            categoryService.addMeetingToCategory(categoryId, categoryId, meetingData);
        }
        
        
    }]);
})();
