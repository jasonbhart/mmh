;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('CreateMeetingController', ['$scope', 'dataProvider', 'dialogs', '$log', 'meetingService', 'geoLocation', '$window', 'sessionService', 'util', 'categoryService', 'userService','gatheringService',
        function($scope, dataProvider, dialogs, $log, meetingService, geoLocation, $window, sessionService, util, categoryService, userService, gatheringService) {
        $scope.MAX_STAGE = 4;
        $scope.stage = 1; 
        $scope.what = 'restaurants';
        $scope.when = 'now';
        $scope.where = 1;
        $scope.establishment = 'other';
        $scope.share = 1;
        $scope.terms = dataProvider.getActivities();
        $scope.term = 'restaurants';
        $scope.suggestions = {};
        $scope.timeFormat = 'h:mmA';
        $scope.times = [roundTime(moment().add(15, 'minutes'))];
        $scope.meetingId = '';
        $scope.meeting = null;
        $scope.redirectUrl = '';
        $scope.shareUrl = '';
        $scope.currentUser = null;
        $scope.meetingList = {};
        $scope.gatheringTypes = [];
        $scope.allSubCategory = true;
        $scope.currentPage = util.getCurrentPage();
        $scope.share = 1;
        $scope.noSuggestionLabel = '';
        
        var defaultManualBusinessLabel = 'Enter a specific business';
        
        $scope.manualBusinessLabel = defaultManualBusinessLabel;
        $scope.manualBusinessInfo = {};
        
        sessionService.ready.then(function() {
            var initAuth = function(user) {
                $scope.currentUser = user;
                userService.get($scope.currentUser.id).then(function(userObj) {
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
            
            if ($scope.stage === 3 && $scope.establishment === 'manual' && Object.keys($scope.manualBusinessInfo).length === 0) {
                alert('Please select a business');
                $scope.addManualBusiness();
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
        
        var resetSelectedCategory = function (defaultValue) {
            $scope.selectedCategory = {};
            for (var i in $scope.gatheringTypes) {
                $scope.selectedCategory[$scope.gatheringTypes[i].alias] = defaultValue;
            }
        };
        
        var getSelectedCategory = function () {
            return Object.keys($scope.selectedCategory).filter(function(value){return $scope.selectedCategory[value];}).join(',');
        };
        
        $scope.$watch('allSubCategory', function(newValue, oldValue) {
            resetSelectedCategory(newValue);
        });
        
        $scope.$watch('what', function (newValue, oldValue) {
            var term = ($scope.what !== 'other') ? $scope.what : $scope.term;
            $scope.gatheringTypes = gatheringService.getCommonGatheringTypes(term);
            $scope.allSubCategory = true;
            resetSelectedCategory(true);
        });
        $scope.$watch('term', function (newValue, oldValue) {
            var term = ($scope.what !== 'other') ? $scope.what : $scope.term;
            $scope.gatheringTypes = gatheringService.getCommonGatheringTypes(term);
            resetSelectedCategory(true);
        });
        
        $scope.$watch('when', function (newValue, oldValue) {
            if (newValue === 'now') {
                $scope.times = [roundTime(moment().add(15, 'minutes'))];
            } else if (newValue === 'one_hour_later') {
                $scope.times = [roundTime(moment().add(1, 'hours'))]
            } else if (newValue === 'two_hours_later') {
                $scope.times = [roundTime(moment().add(2, 'hours'))]
            } else if (newValue === 'four_hours_later') {
                $scope.times = [roundTime(moment().add(4, 'hours'))]
            } else if (newValue === 'other') {
                $scope.times = [];
                $scope.addTimes();
            }
        });
        
        $scope.$watch('share', function (newValue, oldValue) {
            if (newValue === '0') {
                $scope.finish();
            }
        });
        
        $scope.$watch('share_social', function (newValue, oldValue) {
            if (newValue === 'facebook') {
                document.getElementById("fb-share").click()
            } else if (newValue === 'twitter') {
                document.getElementById("twitter-share").click()
            } else if (newValue === 'email') {
                document.getElementById("sharing_email").click()
            } else if (newValue === 'copy'){
                document.getElementById("sharing_url").style.display = 'block';
                document.getElementById("sharing_url").select();
                document.execCommand('copy');
                document.getElementById("sharing_url").style.display = 'none';
                alert(meetingService.getSharingUrl($scope.meetingId) + '\n copied to clipboard');
            }
        });
        
        function roundTime(moment) {
            return moment.subtract(moment.minute()%15, 'minutes');
        }
        
        $scope.$watch('establishment', function (newValue, oldValue) {
            if (newValue === 'manual') {
                $scope.addManualBusiness();
            }
        });
        
        $scope.addManualBusiness = function() {
            var dialog = dialogs.addManualBusiness($scope.getWhereQueryOptions({}, true));
            dialog.result.then(function(business) {
                if (Object.keys(JSON.parse(business)).length === 0) {
                    alert('Please select a business');
                    $scope.addManualBusiness();
                    return;
                }
                var establishment = JSON.parse(business);
                $scope.manualBusinessLabel = defaultManualBusinessLabel + ' (' + establishment.name + ' - ' + establishment.location.display_address + ')';
                $scope.manualBusinessInfo = establishment;
            });
        };
        
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
            } else if ($scope.establishment === 'manual') {
                establishment = JSON.stringify($scope.manualBusinessInfo);
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
                    image_url: establishment.image_url || "",
                    location: establishment.location || {},
                }];
            } catch (e) {
                return [];
            }
        }
        
        $scope.updatePlaceSuggestion = function() {
            $scope.noSuggestionLabel = '';
            var options = {
                'term' : ($scope.what !== 'other') ? $scope.what : $scope.term,
                'sort' : '2',
                'limit': '3'
            };
            
            var isCategoryFilter = false;
            for (var i in $scope.selectedCategory) {
                if ($scope.selectedCategory[i] === false) {
                    isCategoryFilter = true;
                    break;
                }
            }
            
            if (isCategoryFilter) {
                options.category_filter = getSelectedCategory();
            }
            
            var timeout = ($scope.where !== 'other') ? 1000 : 0;
            
            options = $scope.getWhereQueryOptions(options, false);

            setTimeout(function(){
                dataProvider.getSuggestions(options).then(function(suggestions) {
                    $scope.suggestions = suggestions;
                }, function (error){
                    $scope.suggestions = {};
                    if ($scope.establishment != 'manual') {
                        $scope.establishment = 'other';
                    }
                    $scope.noSuggestionLabel = 'Sorry, we were unable to find an establishment in your area. Try changing locations.';
                });
            }, timeout);
        };
        
        $scope.getWhereQueryOptions = function(options, manualBusinessFlag) {
            if ($scope.where !== 'other') {
                if ($scope.currentUser.user.location.coords) {
                    options.coords = $scope.currentUser.user.location.coords;
                } else {
                    var currentLocation = geoLocation.getPosition();
                    currentLocation.then(function(position) {
                        if (position.coords.latitude && position.coords.longitude) {
                                options.coords = {lat: position.coords.latitude, lng: position.coords.longitude};
                            // Boston location for testing purpose
//                            options.coords = {lat: '42.3133735', lng: '-71.0571571,12'};
                        }
                    }, function() {
                        $log.log('Can not find current location');
                    });
                }

                options.radius = util.convertMilesToKms($scope.where);
            } else {
                options.location = $scope.other_location;
            }
            
            return options;
        }
        
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
                name: getMeetingName(),
                createdDate: moment().utc().toISOString(),
                when: times,
                where: places,
                users: users
            };
            var time = angular.copy($scope.times[0]);
            data['timeTitle'] = time ? time.utc().toISOString() : '';
            
            if (!$scope.meetingId) {
                var meetingPromise = meetingService.create(data);
                meetingPromise.then(function(meeting) {
                    var meetingId = meeting.refs.current.key();
                    $scope.meetingId = meetingId;
                    $scope.meeting = meeting;
                    $scope.redirectUrl = 'activity.html?act=' + meetingId;
                    $scope.shareUrl = meetingService.getSharingUrl(meetingId);
                    activateFacebookSDK();
                    activateTwitterSDK();

                    addMeetingToCategory(data);
                    addMeetingToUser(data);
                });
            } else {
                meetingService.update($scope.meetingId, data);
            }
            
        };
        
        var getMeetingName = function () {
            if ($scope.meeting_name) {
                return $scope.meeting_name;
            }
            
            var yelpTerm = ($scope.what !== 'other') ? $scope.what : $scope.term;
            var name = '';
            
            for (var i in $scope.terms) {
                if ($scope.terms[i].id === yelpTerm) {
                    name += $scope.terms[i].name + ' ';
                    break;
                }
            }
            
            return name;
        };
        
        var toTitleCase = function (str)
        {
            return str.replace(/\w+/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
        }
        
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
            var time = angular.copy($scope.times[0]);
            var meetingData = {
                name: getMeetingName(),
                timeTitle: time ? time.utc().toISOString() : ''
            };
            return encodeURIComponent(meetingService.getFacebookSharingUrlWithoutEncode($scope.meetingId, $scope.getMeetingName(meetingData, true)));
        };
        
        $scope.getShareEmailSubject = function() {
            var time = angular.copy($scope.times[0]);
            var meetingData = {
                name: getMeetingName(),
                timeTitle: time ? time.utc().toISOString() : ''
            };
            return "MEET ME HERE: " + $scope.getMeetingName(meetingData, true);
        };
        
         $scope.getShareEmailBody = function() {
            return "Click the link to view activity details: \r\n" + meetingService.getSharingUrl($scope.meetingId);
        };
        
        $scope.getMeetingName = function(meeting, includeTime) {
            return meetingService.getMeetingName(meeting, includeTime);
        };
        
        var addMeetingToUser = function(data) {
            var userId = $scope.currentUser.id;
            var meetingData = {
                id: $scope.meetingId,
                name: data.name,
                createdDate: data.createdDate,
                timeTitle: data.timeTitle
            };
            userService.addMeetingToUser(userId, meetingData).then(function(error){
                if (error) {
                    console.log('Can not add activity to User. Error: ' + error);
                } else {
                    console.log('Activity added to User: ' + userId);
                }
            });
        }
        
        var addMeetingToCategory = function(data) {
            var categoryId = ($scope.what !== 'other') ? $scope.what : $scope.term;
            var categoryName = getCategoryName(categoryId);
            
            var meetingData = {
                id: $scope.meetingId,
                name: data.name,
                createdDate: data.createdDate,
                timeTitle: data.timeTitle
            } ;
            categoryService.addMeetingToCategory(categoryId, categoryName, meetingData);
        }
        
        var getCategoryName = function (categoryId) {
            for (var i in $scope.terms) {
                if ($scope.terms[i].id == categoryId) {
                    return $scope.terms[i].name;
                }
            }
            return 'No category';
        }

        $scope.startTutorial = function() {
            $scope.stage = 1;
            $scope.$apply();
            
            $window.$('#joyRideTipContent').joyride({
                autoStart: true,
                postStepCallback: function (index, tip) {
                    switch(index) {
                        case 3:
                            $scope.stage = 2;
                            $scope.$apply();
                            break;
                        case 5:
                            $scope.stage = 3;
                            $scope.$apply();
                            break;
                        case 10:
                            $scope.stage = 4;
                            $scope.$apply();
                            break;
                        default:
                            break;
                    }
                    
                    $scope.$apply();
                },
                postRideCallback: function() {
                    $scope.stage = 1;
                    $scope.$apply();
                },
                modal: true,
                expose: true
            });
        }
        
        $window.$(document).ready(function () {
            $window.$('#contents').show();
            
            $window.$('.fb-share').click(function(e) {
                e.preventDefault();
                window.open($(this).attr('href'), 'fbShareWindow', 'height=450, width=550, top=' + ($(window).height() / 2 - 275) + ', left=' + ($(window).width() / 2 - 225) + ', toolbar=0, location=0, menubar=0, directories=0, scrollbars=0');
                return false;
            });
            
            $window.$('.twitter-share').click(function(e) {
                e.preventDefault();
                window.open($(this).attr('href'), 'twitterShareWindow', 'height=450, width=550, top=' + ($(window).height() / 2 - 275) + ', left=' + ($(window).width() / 2 - 225) + ', toolbar=0, location=0, menubar=0, directories=0, scrollbars=0');
                return false;
            });
        });

    }]);
})();