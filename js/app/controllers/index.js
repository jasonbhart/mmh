;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('IndexController', ['$scope', 'meetingInfo', 'sessionService', 'util', 'geoLocation','$window', 'googleMap','categoryService', 'appConfig', 'userService', 'meetingService', '$firebaseObject',
            function ($scope, meetingInfo, sessionService, util, geoLocation, $window, googleMap, categoryService, appConfig, userService, meetingService, $firebaseObject) {
        $scope.currentUser = null;
        $scope.locationName = '';
        $scope.categories = [];
        $scope.baseUrl = 'https://www.socialivo.com/';
        var ref = new Firebase(appConfig.firebaseUrl + '/meets');
        $scope.rsvpMeetingList = [];
        $scope.otherMeetings = [];
        $scope.currentPage = util.getCurrentPage();
        $scope.mapLocation = {};
        $scope.saveLocationTimeout = null;
        
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
                        sessionService.setViewedTutorialStatus();
                        $scope.startTutorial();
                    }
                });
            };
            
            initAuth(sessionService.getCurrentUser());
            
            userService.get($scope.currentUser.id).then(function(userObj) {
                userObj.meetingList.$loaded().then(function(data) {
                    angular.forEach(data, function (meeting, key) {
                        var userGroupRef = ref.child(meeting.id).child('users').child($scope.currentUser.id).child('group');
                        userGroupRef.once('value', function(snapshot) {
                            if (snapshot.val() !== null) {
                                var groupInfo = snapshot.val();
                                var meetingRef = new Firebase(appConfig.firebaseUrl + '/meets/' + meeting.id);
                                var rsvpMeeting = $firebaseObject(meetingRef);
                                rsvpMeeting.$loaded().then(function(data) {
                                    var firstWhereId = groupInfo.where || Object.keys(data.where)[0];
                                    var passingData = {meetingId: meeting.id, whereId: firstWhereId};

                                    meetingInfo.getMeetingInfo(passingData).then(function(meetingInfo) {
                                        if (typeof meetingInfo.where.location !== 'undefined') {
                                            meetingInfo.where.location.display_address = meetingInfo.where.location.display_address.replace('undefined', '');
                                        }
                                        if ($scope.rsvpMeetingList.indexOf(meetingInfo) === -1) {
                                            $scope.rsvpMeetingList.push(meetingInfo);
                                        }
                                    });
                                });
                            }
                        });
                    });
                });
            });
                
            $scope.locationName = $scope.currentUser.getLocationName();
            var userLocation = $scope.currentUser.getLocation();
            if (userLocation) {
                var options = {
                    coord: userLocation.coords, 
                    radius: util.convertMilesToKms(10),
                    count: 3
                };

//                meetingInfo.getLatest().then(function(info) {
//                    $scope.meeting = info;
//                    var userGroupRef = ref.child($scope.meeting.id).child('users').child($scope.currentUser.id).child('group');
//                    $scope.meeting.joinedGroup = false;
//                    
//                    userGroupRef.once('value', function(snapshot) {
//                        if (snapshot.val() !== null) {
//                            $scope.meeting.joinedGroup = true;
//                        }
//                        $scope.$apply();
//                    });
//                });

                meetingInfo.getLocal(options).then(function(results) {
                    if (results.length > 0) {
                        angular.forEach(results, function (meeting, key) {
                            var userGroupRef = ref.child(meeting.id).child('users').child($scope.currentUser.id).child('group');
                            userGroupRef.once('value', function(snapshot) {
                                if (snapshot.val() === null) {
                                    if (typeof meeting.where.location !== 'undefined') {
                                        meeting.where.location.display_address = meeting.where.location.display_address.replace('undefined', '');
                                    }
                                    $scope.otherMeetings.push(meeting);
                                    $scope.$apply();
                                }
                            });
                        });
                    }
                });
                
                var mapElement = $window.$('.your-location');
                googleMap.drawMap(mapElement, options.coord, options.radius);
            } else {
                var locationPromise = geoLocation.getCurrentLocation();
                locationPromise.then(function(position) {
                    var options = {
                        coord: position.coords, 
                        radius: util.convertMilesToKms(1),
                        count: 5
                    };
                    $scope.locationName = position.shortName;
                    var mapElement = $window.$('.your-location');
                    googleMap.drawMap(mapElement, options.coord, options.radius);
                });
                
                
                // load default or latest events instead if location is not available
            }
            
            // draw map
//            var mapElement = $window.$('.your-location');
//            googleMap.drawMap(mapElement, options.coord, options.radius);
//            console.log(options);
//            
            // listen for the future auth change events
            $scope.$on('auth.changed', function(evt, user) {
                initAuth(user);
            });
            $scope.$on('position.changed', function(evt, result) {
                $scope.mapLocation = result;    
                clearTimeout($scope.saveLocationTimeout);
                $scope.saveLocationTimeout = setTimeout($scope.saveLocation, 1000);
            });
            
            $scope.saveLocation = function() {
                try {
                    geoLocation.getLocality($scope.mapLocation.position.lat, $scope.mapLocation.position.lng).then(
                    function(locality) {
                        var location = {
                            coords: locality.coords,
                            radius: $scope.mapLocation.radius,
                            shortName: locality.shortName
                        };
                        $scope.currentUser.updateLocation(location);
//                        $scope.locationName = location.shortName;
                        $window.$('.search-box').val(location.shortName);
                    }, function(error) {
                        $window.alert('Failed to change location: ' + error);
                        console.log('geoLocation error', error);
                    });
                } catch (e) {
                    console.log("unable to save location", e);
                }
            };
        });
        
        var categories = categoryService.getCategories();
        categories.$loaded().then(function(data) { 
            categoryService.removePassedActivity(categories);
            $scope.categories = data;
        });
        
        $scope.getMeetingName = function(meeting, includeTime) {
            return meetingService.getMeetingName(meeting, includeTime);
        };
        
        $scope.startTutorial = function() {
            $window.$('#joyRideTipContent').joyride({
                autoStart: true,
                postStepCallback: function (index, tip) {
                },
                postRideCallback: function() {
                },
                modal: true,
                expose: true
            });
        }
        
        $window.$(document).ready(function() {
            $window.$('.categories-nav ul').on('click', 'li.level-0', function() {
                $window.$('.categories-nav ul li.level-0.active').removeClass('active');
                $window.$(this).addClass('active');
            });
        });
    }]);
})();
