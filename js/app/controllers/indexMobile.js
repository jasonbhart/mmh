;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('IndexMobileController', ['$scope', 'meetingInfo', 'sessionService', 'util', 'geoLocation','$window', 'googleMap','categoryService', 'appConfig', 'userService', 'meetingService', '$firebaseObject', '$q','errorLoggingService',
            function ($scope, meetingInfo, sessionService, util, geoLocation, $window, googleMap, categoryService, appConfig, userService, meetingService, $firebaseObject, $q, errorLoggingService) {
        if ($window.$(window).width() > 760) {
            $window.location = '/index.html?callback=1';
        }
        $scope.currentUser = null;
        $scope.locationName = '';
        $scope.baseUrl = 'https://www.socialivo.com/';
        var ref = new Firebase(appConfig.firebaseUrl + '/meets');
        $scope.otherMeetings = [];
        $scope.currentPage = util.getCurrentPage();
        $scope.lastMeetings = null;
        $scope.localEventIds = [];
        
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
            
            var getLocalEventsByMapOptions = function () {
                var options = {
                    radius: util.convertMilesToKms(10),
                    count: 3
                };
                var userLocation = $scope.currentUser.getLocation();
                
                if (shouldUseSavedLocation(userLocation)) {
                    options.coords = userLocation.coords;
                    getLocalEvents(options);
                    $window.$('.loading-wrap').hide();
                    clearTimeout(reloadTimeout);
                } else {
                    var locationPromise = geoLocation.getCurrentLocation();
                    locationPromise.then(function(position) {
                        options.coords = position.coords;
                        getLocalEvents(options);
                        $window.$('.loading-wrap').hide();
                        clearTimeout(reloadTimeout);
                    });
                }
            }
            
            initAuth(sessionService.getCurrentUser());
            
            // listen for the future auth change events
            $scope.$on('auth.changed', function(evt, user) {
                initAuth(user);
                getLocalEventsByMapOptions();
            });
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
            
            if ($scope.otherMeetings.length == 0) {
                $window.location = '/index.html?callback=1';
            } else {
                $window.$('#contents').show();
                setTimeout(function(){
                    $scope.fireSwipeEvent();
                }, 100);
            }
            $window.$.cookie('local_events', JSON.stringify($scope.localEventIds), {expire: 0.05});
        };
        
        
        $window.$(document).bind('mobileinit', function () {
            $.mobile.pushStateEnabled = false;
        });
        
        $scope.fireSwipeEvent = function() {
            $(".buddy").on("swiperight", function () {
                $('#yes').addClass('yes');
                $(this).addClass('rotate-left').delay(700).fadeOut(1);
                $('.buddy').find('.status').remove();

                $(this).append('<div class="status like">Like!</div>');
                if ($(this).is(':last-child')) {
                    $('.buddy:nth-child(1)').removeClass('rotate-left rotate-right').fadeIn(300);
                    $(".box").hide();
                } else {
                    $(".box").show();
                }
                var meetId = this.id;
                setTimeout(function () {
                    $window.location = meetingService.getActivityUrl(meetId) + '&rsvp=1';
                    $('#yes').removeClass('yes');
                }, 500);
            });
            
            $(".buddy").on("swipeleft", function () {
                $('#no').addClass('no');
                $(this).addClass('rotate-right').delay(700).fadeOut(1);
                $('.buddy').find('.status').remove();
                $(this).append('<div class="status dislike">Dislike!</div>');

                if ($(this).is(':last-child')) {
                    $('.buddy:nth-child(1)').removeClass('rotate-left rotate-right').fadeIn(300);
                    $("#left-right").show();
                } else {
                    $("#left-right").hide();
                }

                if (this.id == 0) {
                    $window.location = '/index.html?callback=1';
                }

                setTimeout(function () {
                    $('#no').removeClass('no');
                }, 500);
            });
            
            $('#yes').click(function(){
                var activeBuddy = findActiveBuddyId();
                $("#" + activeBuddy).swiperight();
            });
            
            $('#no').click(function(){
                var activeBuddy = findActiveBuddyId();
                $("#" + activeBuddy).swipeleft();
            });
        }
        
        var findActiveBuddyId = function() {
            var max = 0;
            $(".buddy").each(function() {
                if ($(this).is(":visible") && this.id > max){
                   max = this.id;
                }
            });
            
            return max;
        }
        
        $window.$(document).ready(function() {
            $.mobile.ajaxEnabled = false;
            $scope.fireSwipeEvent();
        });
        
        $scope.formatTime = function (isoString) {
            return moment(isoString).format('h:mm A');
        }
    }]);
})();
