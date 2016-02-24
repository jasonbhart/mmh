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
        $scope.profileImages = [];
        
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
                var userId = $.cookie('guid');
                var userMeetingRef = new Firebase(appConfig.firebaseUrl + '/users/' + userId + '/meetings');
                var userMeetingList = $firebaseObject(userMeetingRef);
                userMeetingList.$loaded().then(function(data) {
                    $scope.rsvpMeetingList = [];
                    for (var i in data) {
                        if (!data[i] || !data[i].id) {
                            continue;
                        }
                        
                        var meetId = data[i].id;
                        if (!$scope.lastMeetings || !$scope.lastMeetings[meetId]) {
                            continue;
                        }
                        
                        var meetingInfo = $scope.lastMeetings[meetId];

                        var finished = meetingService.checkIfFinished(meetingInfo.when);
                        if (finished) {
                            continue;
                        }
                        
                        if (meetingInfo.users[userId] && meetingInfo.users[userId].group) {
                            var placeId = meetingInfo.users[userId].group.where;
                            var timeId  = meetingInfo.users[userId].group.when;
                            
                            meetingInfo.chosenLocation = meetingInfo.where[placeId];
                            meetingInfo.chosenTime     = meetingInfo.when[timeId];
                            
                            meetingInfo.joinedUser = [];
                            for (var j in meetingInfo.users) {
                                var group = meetingInfo.users[j].group;
                                if (group && group.where === placeId && group.when === timeId) {
                                    meetingInfo.joinedUser.push(j);
                                }
                            }
                            
                            meetingInfo.usersCount = meetingInfo.joinedUser.length;
                            meetingService.getProfileImages(meetingInfo.joinedUser).then(function(profileImages) {
                                _.forEach(profileImages, function(profileImage) {
                                    $scope.profileImages[profileImage.userId] = profileImage.profile;
                                });
                            });
                            $scope.rsvpMeetingList.push(meetingInfo);
                        }
                    }
                    $window.$('.loading-wrap').hide();
                    clearTimeout(reloadTimeout);
                });
            }
            
            var getMapAndLocalEvents = function () {

                drawMap().then(function(mapOptions) {
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
                        var result = {
                            coords: locality.coords,
                            shortName: locality.shortName
                        };
                        $.cookie('currentLocation', JSON.stringify(result), {path: '/', expires: 0.05})
                        $window.$('.search-box').val(result.shortName);
                        
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
        
        var getActivityByCategory = function () {
            var categories = categoryService.getCategories();
            categories.$loaded().then(function(data) { 
                categoryService.removePassedActivity(categories);
                $scope.cateogries = [];
                for (var i in data) {
                    if (data[i] && data[i].meetings) {
                        var meetings = [];
                        for (var j in data[i].meetings) {
                            if (isLocalActivity(data[i].meetings[j].id)) {
                                meetings.push(data[i].meetings[j]);
                            }
                        }
                        
                        if (meetings.length) {
                            data[i].meetings = meetings;
                            $scope.categories.push(data[i]);
                        }
                        
                    }
                    
                }
            });
        }
        
        var isLocalActivity = function (meetId) {
            return ($scope.localEventIds.indexOf(meetId) !== -1);
        }
        
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
            geoLocation.getCurrentLocation(true).then(
                function(location) {
                    $scope.map.setCenter(location.coords.lat, location.coords.lng);
                    $window.$('.search-box').val(location.shortName);
                    
                    
                    util.addEventToDataLayer('Local Settings', 'Geo', 'Auto Detect', location.shortName);

                }, function(error) {
                    $window.alert('Failed to change location: ' + error);
                    console.log('geoLocation error', error);
                });
                
        };
        
        $scope.getCorrectProtocolUrl = function(url) {
            return util.getCorrectProtocolUrl(url);
        };
           
        var drawMap = function () {
            var defer = $q.defer();
            
            var mapElement = $window.$('.your-location');
            var options = {
                radius: util.convertMilesToKms(10),
                count: 2
            };
            
            var locationPromise = geoLocation.getCurrentLocation();
            locationPromise.then(function(position) {
                options.coords = position.coords;
                $scope.locationName = position.shortName;
                $scope.map = googleMap.drawMap(mapElement, options.coords, util.convertMilesToKms(1));

                util.addEventToDataLayer('Local Settings', 'Geo', 'Auto Detect', $scope.locationName);

                defer.resolve(options);
            }, function (error) {
                $window.alert('Cannot detect current location. Set to default value');
                options.coords = {lat: 37.7749295, lng: -122.4194155};

                $scope.map = googleMap.drawMap(mapElement, options.coords, util.convertMilesToKms(1));
                $scope.locationName = 'SF, US';

                defer.resolve(options);
            });
            
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
            getActivityByCategory();
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
