;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('IndexController', ['$scope', '$cookies', 'meetingInfo', 'sessionService', 'util', 'geoLocation','$window', 'googleMap','categoryService', 'appConfig', 'userService', 'meetingService', '$firebaseObject', '$q','errorLoggingService',
            function ($scope, $cookies, meetingInfo, sessionService, util, geoLocation, $window, googleMap, categoryService, appConfig, userService, meetingService, $firebaseObject, $q, errorLoggingService) {
        if (!util.getUrlParams('callback') && $window.$(window).width() < 760) {
            $window.location = '/index_mobile.html';
        }
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
        $scope.lastMeetings = null;
        $scope.localEventIds = [];
        
        var time = new Date().getTime();
        
        var startAt = $.cookie('oldestActiveMeeting');
        meetingService.getLastMeetings(50,startAt).$loaded(function(lastMeetings) {
            $scope.lastMeetings = lastMeetings;
            util.saveOldestActiveMeeting(lastMeetings);
        });
        
        $window.$('.loading-wrap').show();
        var reloadTimeout = setTimeout(function() {
            if (confirm('This page is not fully loaded due to slow internet connection. Do you want to reload now?')) {
                $window.location.reload();
            }
        }, 30000);
        
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
            };
            
            var getRsvpedActivity = function () {
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
                                        var firstWhenId = groupInfo.when || '0';
                                        var passingData = {meetingId: meeting.id, whereId: firstWhereId, whenId: firstWhenId};

                                        meetingInfo.getMeetingInfo(passingData).then(function(meetingInfo) {
                                            if (typeof meetingInfo.where.location !== 'undefined') {
                                                meetingInfo.where.location.display_address = meetingInfo.where.location.display_address.replace('undefined', '');
                                            }
                                            if (
                                                $scope.rsvpMeetingList.indexOf(meetingInfo) === -1
                                                && $scope.isToday(meetingInfo.timeTitle)
                                                && moment().diff(moment(meetingInfo.timeTitle)) < 3600 * 1000
                                            ) {
                                                meetingInfo.formatedTime = $scope.formatTime(meetingInfo.when);
                                                $scope.rsvpMeetingList.push(meetingInfo);
                                            }
                                        });

                                        $window.$('.loading-wrap').hide();
                                        clearTimeout(reloadTimeout);
                                    });
                                } else {
                                    $window.$('.loading-wrap').hide();
                                    clearTimeout(reloadTimeout);
                                }
                            });
                        });
                    });
                });
            }
            
            var getMapAndLocalEvents = function () {
                $scope.locationName = $scope.currentUser.getLocationName();
            
                var userLocation = $scope.currentUser.getLocation();

                drawMap(userLocation).then(function(mapOptions) {
                    getLocalEvents(mapOptions);
                    $window.$('.loading-wrap').hide();
                    clearTimeout(reloadTimeout);
                });
                
            }
            
            initAuth(sessionService.getCurrentUser());

          // listen for the future auth change events
            $scope.$on('auth.changed', function(evt, user) {
                initAuth(user);
                getMapAndLocalEvents();
                getRsvpedActivity();
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
                        
                        util.addEventToDataLayer('Local Settings', 'Geo', 'Change Search Location', locality.shortName);
                    }, function(error) {
                        $window.alert('Failed to change location: ' + error);
                        console.log('geoLocation error', error);
                    });
                } catch (e) {
                    var data = {
                        content: "unable to save location",
                        message: e.message,
                        page: 'homepage',
                        _function: 'save location',
                        position: $scope.mapLocation.position
                    };
                    errorLoggingService.addLog(data);
                    console.log("unable to save location", e);
                }
            };
        });
        
        var categories = categoryService.getCategories();
        categories.$loaded().then(function(data) { 
            categoryService.removePassedActivity(categories);
            $scope.categories = data;
        });
        
        $scope.isToday = function (isoString) {
            return moment().format('YYYYMMDD') <= moment(isoString).format('YYYYMMDD');
        };
        
        $scope.getMeetingName = function(meeting, includeTime) {
            return meetingService.getMeetingName(meeting, includeTime);
        };
        
        $scope.getShareMeetingName = function (meeting) {
            var metadata = '';
            var place = meeting.place;
            var time = meeting.timeTitle;
            if (place && time) {
                metadata = ' (' + place + ' @ ' +  moment(time).format('h:mmA') + ')';
            } else if (place) {
                metadata = ' (' + place + ')';
            } else if (time) {
                metadata = ' ('  +  moment(time).format('h:mmA') + ')';
            }
            return meeting.name + metadata;
        }
        
        $scope.startTutorial = function() {
            util.addEventToDataLayer('Tutorial', 'Start', 'Homepage', null);
            
            if (sessionService.getViewedTutorialStatus(1) || sessionService.getViewedTutorialStatus(2)) {
                // if viewed homepage or index page, remove common tutorial
                $window.$('.common-tooltip').remove();
                if (!$window.$('.going').length) {
                    $window.$('.going-activity').remove();
                }
            }
            
            $window.$('#joyRideTipContent').joyride({
                autoStart: true,
                postStepCallback: function (index, tip) {
                },
                postRideCallback: function() {
                    util.addEventToDataLayer('Tutorial', 'Cancel', 'Homepage', null);
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
                    
                    util.addEventToDataLayer('Local Settings', 'Geo', 'Auto Detect', location.shortName);

                }, function(error) {
                    $window.alert('Failed to change location: ' + error);
                    console.log('geoLocation error', error);
                });
                
        };
        
        $scope.getCorrectProtocolUrl = function(url) {
            return util.getCorrectProtocolUrl(url);
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
                count: 2
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
                    
                    util.addEventToDataLayer('Local Settings', 'Geo', 'Auto Detect', $scope.locationName);
                    
                    defer.resolve(options);
                }, function (error) {
                    $window.alert('Cannot detect current location. Set to default value');
                    options.coords = {lat: 37.7749295, lng: -122.4194155};
                    
                    $scope.map = googleMap.drawMap(mapElement, options.coords, util.convertMilesToKms(1));
                    $scope.locationName = 'SF, US';
                    
                    var location = angular.extend(options, {
                        type: 'auto', 
                        saveTime:  moment().utc().toISOString(),
                        shortName: 'SF, US'
                    });
                    $scope.currentUser.updateLocation(location);
                    
                    defer.resolve(options);
                });
                
                // load default or latest events instead if location is not available
            }
            
            return defer.promise;
        }; 
        
        var getLocalEvents = function(mapOptions) {
            if ($scope.lastMeetings === null) {
                setTimeout(function() {
                    getLocalEvents(mapOptions);
                }, 1000);
                return false;
            }
            
            $scope.otherMeetings = [];
            
            for (var i in $scope.lastMeetings) {
                if (typeof $scope.lastMeetings[i] === 'object' && $scope.lastMeetings[i] && $scope.lastMeetings[i].name) {
                    var distance = meetingService.calculateDistanceToMeeting($scope.lastMeetings[i], mapOptions);
                    if (distance < mapOptions.radius) {
                        $scope.lastMeetings[i].id = i;
                        $scope.lastMeetings[i].url = 'activity.html?act=' + i;
                        $scope.lastMeetings[i].formatedTime = $scope.formatTime($scope.lastMeetings[i].timeTitle);
                        
                        var finished = meetingService.checkIfFinished($scope.lastMeetings[i].when);
                        var creatorId = meetingService.getCreatorId($scope.lastMeetings[i].users);
                        var userId = $scope.currentUser.id;
                        var joined = $scope.lastMeetings[i].users && 
                                     $scope.lastMeetings[i].users[userId] &&
                                     $scope.lastMeetings[i].users[userId].group;
                                     
                        if (!finished && !joined && creatorId !== userId) {
                            $scope.otherMeetings.push($scope.lastMeetings[i]);
                            $scope.localEventIds.push(i);
                        }                      
                    }
                }
            }
            $window.$.cookie('local_events', JSON.stringify($scope.localEventIds), {expire: 0.05});
        };
        
        $window.$(document).ready(function() {
            $window.$('.categories-nav ul').on('click', 'li.level-0', function() {
                $window.$('.categories-nav ul li.level-0.active').removeClass('active');
                $window.$(this).addClass('active');
            });
            
            sessionService.ready.then(function() {
                if (!sessionService.getViewedTutorialStatus()) {
                    setTimeout(function(){
                        $scope.startTutorial();
                        sessionService.setViewedTutorialStatus();
                    }, 100);
                }
            });
        });
        
        $scope.formatTime = function (isoString) {
            return moment(isoString).format('h:mm A');
        }
    }]);
})();
