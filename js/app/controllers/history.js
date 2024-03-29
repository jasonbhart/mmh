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
            $('.loading-wrap').show();
            util.addEventToDataLayer('History Page', 'Show all activities', null, null);
            historyService.getLastHistory($scope.currentUser.id, 100).then(function(history) {
                $scope.history = categoryHistoryByDate(history);
                $scope.showedAll = true;
            });
            $('.loading-wrap').hide();
            
        }
        
        $scope.isToday = function (isoString) {
            return moment().format('YYYYMMDD') <= moment(isoString).format('YYYYMMDD');
        };
        
        $scope.createActivity = function (meetId) {
            util.addEventToDataLayer('History Page', 'Create Activity', null, meetId);
            $window.$('.loading-wrap').show();
            meetingService.getRaw(meetId).$loaded(function(meetData) {
                var times   = getTimeFromTemplate(meetData.when);
                var places  = getPlaceFromTemplate(meetData.where);
                var users = {};
                if ($scope.currentUser && $scope.currentUser.id) {
                    users[$scope.currentUser.id] = {
                        joined: true,
                        creator: true,
                        where: util.getFirebaseKeys(places),
                        when: util.getFirebaseKeys(times)
                    };
                }
                var timeTitle = times[Object.keys(times)[0]] || changeDateToToday(meetData.timeTitle);
                var data = {
                    name: meetData.name,
                    createdDate: moment().utc().toISOString(),
                    when: times,
                    where: places,
                    users: users,
                    timeTitle: timeTitle,
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
            
            var minTime =   moment()
                            .add(15, 'minutes')
                            .subtract(moment().minute()%15, 'minutes')
                            .seconds(0).millisecond(0)
                            .utc().toISOString();
           
            for (var i in times) {
                var key = util.generateKey();
                var newTime = changeDateToToday(times[i]);
                if (minTime <= newTime) {
                    result[key] = newTime;
                }
            }
            if (_.isEmpty(result)) {
                var key = util.generateKey();
                result[key] = minTime;
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
        
        $scope.formatTime = function (isoString) {
            return moment(isoString).format('h:mm A');
        }
        
        $scope.startTutorial = function() {
            util.addEventToDataLayer('Tutorial', 'Start', 'History', null);
            
            $window.$('#joyRideTipContent').joyride({
                autoStart: true,
                postStepCallback: function (index, tip) {
                },
                postRideCallback: function() {
                    util.addEventToDataLayer('Tutorial', 'Cancel', 'History', null);
                },
                modal: true,
                expose: true
            });
        }
        
    }]);
})();
