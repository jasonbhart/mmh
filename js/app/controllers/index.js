;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('IndexController', ['$scope', 'meetingInfo', 'sessionService', 'util', 'geoLocation','$window', 'googleMap','categoryService', 'appConfig', 'userService', 'meetingService', '$firebaseObject', '$q',
            function ($scope, meetingInfo, sessionService, util, geoLocation, $window, googleMap, categoryService, appConfig, userService, meetingService, $firebaseObject, $q) {
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
                        $scope.startTutorial();
                        sessionService.setViewedTutorialStatus();
                    }
                });
            };
            
            initAuth(sessionService.getCurrentUser());
            
            $window.$('.loading-wrap').show();
            
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
                                    
                                    $window.$('.loading-wrap').hide();
                                });
                            } else {
                                $window.$('.loading-wrap').hide();
                            }
                        });
                    });
                });
            });
                
            $scope.locationName = $scope.currentUser.getLocationName();
            
            var userLocation = $scope.currentUser.getLocation();
            
            drawMap(userLocation).then(function(mapOptions) {
                getLocalEvents(mapOptions);
            });
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
                            shortName: locality.shortName,
                            type: 'manual',
                            saveTime: moment().utc().toISOString()
                        };
                        $scope.currentUser.updateLocation(location);
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
            if (sessionService.getViewedTutorialStatus()) {
                $window.$('.first-greeting-bubble').remove();
            }
            
            $window.$('#joyRideTipContent').joyride({
                autoStart: true,
                postStepCallback: function (index, tip) {
                },
                postRideCallback: function() {
                },
                modal: true,
                expose: true
            });
        };
        
        $scope.autoDetectLocation = function () {
            geoLocation.getCurrentLocation().then(
                function(location) {
                    $scope.map.setCenter(location.coords.lat, location.coords.lng);
                    $window.$('.search-box').val(location.shortName);
                    
                    location.radius = $scope.mapLocation.radius || 1;
                    location.type = 'auto';
                    location.saveTime = moment().utc().toISOString();
                    $scope.currentUser.updateLocation(location);

                }, function(error) {
                    $window.alert('Failed to change location: ' + error);
                    console.log('geoLocation error', error);
                });
                
        };
        
        var shouldUseSavedLocation = function (userLocation) {
            var useSavedLocation = true;
            if (!userLocation) {
                useSavedLocation = false;
            } else if (!userLocation.saveTime) {
                useSavedLocation = false;
            } else if (userLocation.type === 'auto') {
                var diff = moment().diff(moment(userLocation.saveTime));
                if (diff > 1000 * 3600) {
                    useSavedLocation = false;
                }
            } else {
                var diff = moment().diff(moment(userLocation.saveTime));
                if (diff > 24 * 1000 * 3600) {
                    useSavedLocation = false;
                }
            }
            return useSavedLocation;
        };
        
        var drawMap = function (userLocation) {
            var defer = $q.defer();
            
            var mapElement = $window.$('.your-location');
            var options = {
                radius: util.convertMilesToKms(10),
                count: 3
            };
            
            
            if (shouldUseSavedLocation(userLocation)) {
                options.coords = userLocation.coords;
                $scope.map = googleMap.drawMap(mapElement, options.coords, util.convertMilesToKms(1));
                
                defer.resolve(options);
            } else {
                var locationPromise = geoLocation.getCurrentLocation();
                locationPromise.then(function(position) {
                    options.coords = position.coords;
                    $scope.locationName = position.shortName;
                    $scope.map = googleMap.drawMap(mapElement, options.coords, util.convertMilesToKms(1));
                    
                    var location = angular.extend(options, {
                        type: 'auto', 
                        saveTime:  moment().utc().toISOString(),
                        shortName: position.shortName
                    });
                    $scope.currentUser.updateLocation(location);
                    
                    defer.resolve(options);
                }, function (error) {
                    $window.alert('Cannot detect current location. Set to default value');
                    options.coords = {lat: 40.71875890364503, lng: -74.00626673281249};
                    
                    $scope.map = googleMap.drawMap(mapElement, options.coords, util.convertMilesToKms(1));
                    $scope.locationName = 'NY, US';
                    
                    var location = angular.extend(options, {
                        type: 'auto', 
                        saveTime:  moment().utc().toISOString(),
                        shortName: 'NY, US'
                    });
                    $scope.currentUser.updateLocation(location);
                    
                    defer.resolve(options);
                });
                
                // load default or latest events instead if location is not available
            }
            
            return defer.promise;
        };
        
        var getLocalEvents = function(mapOptions) {
            meetingInfo.getLocal(mapOptions).then(function(results) {
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

                            $window.$('.loading-wrap').hide();
                        });
                    });
                } else {
                    $window.$('.loading-wrap').hide();
                }
            });
        };
        
        $window.$(document).ready(function() {
            $window.$('.categories-nav ul').on('click', 'li.level-0', function() {
                $window.$('.categories-nav ul li.level-0.active').removeClass('active');
                $window.$(this).addClass('active');
            });
        });
    }]);
})();
