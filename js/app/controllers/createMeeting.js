;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('CreateMeetingController', ['$scope', 'dataProvider', 'dialogs', '$log', 'meetingService', 'geoLocation', '$window', 'sessionService', 'util',
        function($scope, dataProvider, dialogs, $log, meetingService, geoLocation, $window, sessionService, util) {
        $scope.MAX_STAGE = 4;
        $scope.stage = 1; 
        $scope.what = 'restaurants';
        $scope.when = 'one_hour_later';
        $scope.where = 1;
        $scope.establishment = 'other';
        $scope.share = 1;
        $scope.terms = dataProvider.getTerms();
        $scope.term = 'restaurants';
        $scope.suggestions = {};
        $scope.timeFormat = 'h:mmA';
        $scope.times = [moment({hour: moment().hour() + 1, minute: moment().minute() - moment().minute() % 15})];
        $scope.meeingId = '';
        $scope.meeting = null;
        $scope.redirectUrl = '';
        $scope.shareUrl = '';
        $scope.currentUser = null;
        
        sessionService.ready.then(function() {
            var initAuth = function(user) {
                $scope.currentUser = user;
                console.log('CURRENT USER:');
                console.log($scope.currentUser);
            };
            
            initAuth(sessionService.getCurrentUser());

            // listen for the future auth change events
            $scope.$on('auth.changed', function(evt, user) {
                initAuth(user);
            });     
        });
        
        $scope.next = function() {
            if ($scope.stage === 2 && $scope.times.length === 0) {
                alert('Please select a time');
                return;
            }
            
            $scope.stage ++;
            
            if ($scope.stage === 3) {
                $scope.updatePlaceSuggestion();
            }
            
            if ($scope.stage === $scope.MAX_STAGE) {
                createMeeting();
            }
        };
        
        $scope.back = function() {
            if ($scope.stage > 1) {
                $scope.stage --;
            }  
        };
        
        $scope.finish = function() {
            redirectToMeetingPage();
        };
        
        $scope.getVisitedStatus = function (elementIndex) {
            if (elementIndex < $scope.stage) {
                return 'visited';
            } else if (elementIndex == $scope.stage) {
                return 'active';
            } else if (elementIndex == $scope.stage + 1) {
                return 'next';
            } else {
                return '';
            }
        };
              
        
        var timesProvider = {
            getTimes: function() {
                return [].concat($scope.times);
            },
            format: function(time) {
                return time.format($scope.timeFormat);
            }
        };
        
        $scope.addTimes = function() {
            var dialog = dialogs.userMeetingTimes(timesProvider);
            dialog.result.then(function(times) {
                $log.log('Show times result:', times);
                $scope.times = times;
            });
        };
        
        $scope.removeTime = function (time) {
            _.remove($scope.times, function(t) {
                return t.isSame(time);
            });
            
            if ($scope.times.length === 0) {
                if ($scope.when === 'other') {
                    $scope.addTimes();
                } else {
                    $scope.when = 'other';
                }
            }
        };
        
        $scope.$watch('when', function (newValue, oldValue) {
            if (newValue === 'one_hour_later') {
                $scope.times = [moment({hour: moment().hour() + 1, minute: moment().minute() - moment().minute() % 15})]
            } else if (newValue === 'two_hours_later') {
                $scope.times = [moment({hour: moment().hour() + 2, minute: moment().minute() - moment().minute() % 15})]
            } else if (newValue === 'four_hours_later') {
                $scope.times = [moment({hour: moment().hour() + 4, minute: moment().minute() - moment().minute() % 15})]
            } else if (newValue === 'other') {
                $scope.times = [];
                $scope.addTimes();
            }
        });
        
        function getISOFormatedTimes() {
            return $scope.times.map(function(time){
                return time.utc().toISOString();
            });
        }
        
        function getFormatedEstablishment() {
            var establishment = $scope.establishment;
            if ($scope.establishment === 'other') {
                if (typeof $scope.suggestions[0] === 'object') {
                    establishment = JSON.stringify($scope.suggestions[0]);
                } else {
                    return [];
                }
            }
            try {
                establishment = JSON.parse(establishment);
                return [{
                    name: establishment.name || "Unknown",
                    url: establishment.url || "Unknown",
                    rating_url: establishment.rating_url || "Unknown",
                    city: establishment.city || "Unknown",
                    country_code: establishment.country_code || "Unknown",
                    type: establishment.type || "Unknown",
                    location: establishment.location || {},
                }];
            } catch (e) {
                return [];
            }
        }
        
        $scope.updatePlaceSuggestion = function() {
            var options = {
                'term' : ($scope.what !== 'other') ? $scope.what : $scope.term,
                'sort' : '2',
                'limit': '3'
            };
            var timeout = 0;

            if ($scope.where !== 'other') {
                timeout = 1000;
                var currentLocation = geoLocation.getPosition();
                currentLocation.then(function(position) {
                    if (position.coords.latitude && position.coords.longitude) {
                            options.coords = {lat: position.coords.latitude, lng: position.coords.longitude};
                        // Boston location for testing purpose
//                        options.coords = {lat: '42.3133735', lng: '-71.0571571,12'};
                    }
                }, function() {
                    $log.log('Can not find current location');
                });

                options.radius = util.convertMilesToKms($scope.where);
            } else {
                options.location = $scope.other_location;
            }


            setTimeout(function(){
                dataProvider.getSuggestions(options).then(function(suggestions) {
                    $scope.suggestions = suggestions;
                });
            }, timeout);
        };
        
        var createMeeting = function() {
            var times   = getISOFormatedTimes();
            var places  = getFormatedEstablishment();
            var users = {};
            if ($scope.currentUser && $scope.currentUser.id) {
                users[$scope.currentUser.id] = {
                    joined: true,
                    where: Object.keys(places),
                    when: Object.keys(times)
                };
            }
            var data = {
                name: $scope.meeting_name || "New Meeting",
                createdDate: moment().utc().toISOString(),
                when: times,
                where: places,
                users: users
            };
            var meetingPromise = meetingService.create(data);
            meetingPromise.then(function(meeting) {
                var meetingId = meeting.refs.current.key();
                $scope.meetingId = meetingId;
                $scope.meeting = meeting;
                $scope.redirectUrl = 'meeting.html?meet=' + meetingId;
                $scope.shareUrl = meetingService.getSharingUrl(meetingId)
                activateFacebookSDK();
                activateTwitterSDK();
            });
        };
        
        var activateFacebookSDK = function () {
            $window.$('body').append('<script src="//connect.facebook.net/en_US/sdk.js#xfbml=1&version=v2.4"></script>');
        };
        
        var activateTwitterSDK = function() {
            $window.$('body').append('<script src="//platform.twitter.com/widgets.js"></script>');
            
        }
        
        var redirectToMeetingPage = function() {
            $window.location = $scope.redirectUrl;
        }
        
        $scope.getFacebookSharingUrl = function() {
            return meetingService.getFacebookSharingUrl($scope.meetingId, $scope.meeting_name || "New Meeting")
        };
        
        $scope.getShareEmailSubject = function() {
            return "MEET ME HERE: " + ($scope.meeting_name || "New Meeting");
        };
        
        $scope.showHideProgressBar = function() {
            if ($window.$(window).width() < 800) {
                $window.$(".checkout-wrap").fadeOut();
            }else{
                $window.$(".checkout-wrap").fadeIn();
            }
        }

        $window.$(document).ready(function () {
            //on load
            $scope.showHideProgressBar();

            //on resize
            $(window).resize(function(){
                $scope.showHideProgressBar();
            });
            $window.$('#contents').show();
        });

    }]);
})();