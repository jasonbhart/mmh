;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('IndexMobileController', ['$scope', 'meetingInfo', 'sessionService', 'util', 'geoLocation','$window', 'googleMap','categoryService', 'appConfig', 'userService', 'meetingService', '$firebaseObject', '$q','errorLoggingService',
            function ($scope, meetingInfo, sessionService, util, geoLocation, $window, googleMap, categoryService, appConfig, userService, meetingService, $firebaseObject, $q, errorLoggingService) {
        if ($window.$(window).width() > 760) {
            $window.location = '/index.html';
        }
        $scope.currentUser = null;
        $scope.locationName = '';
        $scope.baseUrl = 'https://www.socialivo.com/';
        var ref = new Firebase(appConfig.firebaseUrl + '/meets');
        $scope.otherMeetings = [];
        $scope.currentPage = util.getCurrentPage();
        
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
                } else {
                    var locationPromise = geoLocation.getCurrentLocation();
                    locationPromise.then(function(position) {
                        options.coords = position.coords;
                        getLocalEvents(options);
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
            meetingInfo.getLocal(mapOptions).then(function(results) {
                if (results.length > 0) {
                    angular.forEach(results, function (meeting, key) {
                        var userGroupRef = ref.child(meeting.id).child('users').child($scope.currentUser.id).child('group');
                        userGroupRef.once('value', function(snapshot) {
                            if (snapshot.val() === null) {
                                if (typeof meeting.where.location !== 'undefined') {
                                    meeting.where.location.display_address = meeting.where.location.display_address.replace('undefined', '');
                                }
                                if (meeting.createdDate && $scope.isToday(meeting.createdDate)) {
                                    meeting.formatedTime = $scope.formatTime(meeting.when);
                                    $scope.otherMeetings.push(meeting);
                                    $scope.$apply();
                                    $scope.fireSwipeEvent();
                                }
                                
                            }
                            $window.$('.loading-wrap').hide();
                            clearTimeout(reloadTimeout);
                        });
                    });
                } else {
                    $window.$('.loading-wrap').hide();
                    $window.location = '/index.html';
                    clearTimeout(reloadTimeout);
                }
            });
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
                    $window.location = meetingService.getActivityUrl($scope.otherMeetings[meetId].id)
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
                    $window.location = '/index.html';
                }
                
                setTimeout(function () {
                    $('#no').removeClass('no');
                }, 500);
            });
        }
        
        $window.$(document).ready(function() {
            $scope.fireSwipeEvent();
        });
        
        $scope.formatTime = function (isoString) {
            return moment(isoString).format('h:mm A');
        }
    }]);
})();
