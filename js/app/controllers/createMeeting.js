;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('CreateMeetingController', ['$scope', 'dataProvider', 'dialogs', '$log', 'meetingService', 'geoLocation', '$window', 'sessionService', 'util', 'categoryService', 'userService','gatheringService',
        function($scope, dataProvider, dialogs, $log, meetingService, geoLocation, $window, sessionService, util, categoryService, userService, gatheringService) {
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
        $scope.times = [roundTime(moment().add(1, 'hours'))];
        $scope.meetingId = '';
        $scope.meeting = null;
        $scope.redirectUrl = '';
        $scope.shareUrl = '';
        $scope.currentUser = null;
        $scope.meetingList = {};
        $scope.gatheringTypes = [];
        
        var defaultManualBusinessLabel = 'Enter a specific business';
        $scope.manualBusinessLabel = defaultManualBusinessLabel;
        $scope.manualBusinessInfo = {};
        
        sessionService.ready.then(function() {
            var initAuth = function(user) {
                $scope.currentUser = user;
                userService.get($scope.currentUser.id).then(function(userObj) {
                    userObj.meetingList.$loaded().then(function(data) {
                        $scope.meetingList = data;
                    });
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
            
            if ($scope.stage === 3 && $scope.establishment === 'manual' && !$scope.manualBusinessInfo.name) {
                alert('Please enter business name');
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
        
        var resetSelectedCategory = function () {
            $scope.selectedCategory = {};
            for (var i in $scope.gatheringTypes) {
                $scope.selectedCategory[$scope.gatheringTypes[i].alias] = true;
            }
        };
        
        var getSelectedCategory = function () {
            return Object.keys($scope.selectedCategory).filter(function(value){return $scope.selectedCategory[value];}).join(',');
        }
        
        $scope.$watch('what', function (newValue, oldValue) {
            var term = ($scope.what !== 'other') ? $scope.what : $scope.term;
            $scope.gatheringTypes = gatheringService.getCommonGatheringTypes(term);
            resetSelectedCategory();
        });
        $scope.$watch('term', function (newValue, oldValue) {
            var term = ($scope.what !== 'other') ? $scope.what : $scope.term;
            $scope.gatheringTypes = gatheringService.getCommonGatheringTypes(term);
            resetSelectedCategory();
        });
        
        $scope.$watch('when', function (newValue, oldValue) {
            if (newValue === 'one_hour_later') {
                $scope.times = [roundTime(moment().add(1, 'hours'))];
            } else if (newValue === 'two_hours_later') {
                $scope.times = [roundTime(moment().add(2, 'hours'))]
            } else if (newValue === 'four_hours_later') {
                $scope.times = [roundTime(moment().add(4, 'hours'))]
            } else if (newValue === 'other') {
                $scope.times = [];
                $scope.addTimes();
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
            var dialog = dialogs.addManualBusiness($scope.manualBusinessInfo);
            dialog.result.then(function(business) {
                if (!business.name) {
                    alert('Please enter business name');
                    $scope.addManualBusiness();
                }
                $scope.manualBusinessLabel = defaultManualBusinessLabel + getBusinessPlace(business);
                $scope.manualBusinessInfo = business;
            });
        };
        
        function getBusinessPlace(business) {
            var place = '';
            if (business.name) {
                place = business.name;
                if (business.city) {
                    place += ', ' + business.city;
                }
            }
            
            if (place) {
                place = ' (' + place + ')'; 
            }
            return place;
        }
        
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
                'limit': '3',
                'category_filter': getSelectedCategory()
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
                name: getMeetingName(),
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
                $scope.shareUrl = meetingService.getSharingUrl(meetingId);
                activateFacebookSDK();
                activateTwitterSDK();
                
                addMeetingToCategory(data);
                addMeetingToUser(data);
            });
        };
        
        var getMeetingName = function () {
            if ($scope.meeting_name) {
                return $scope.meeting_name;
            }
            
            var name = '';
            
            //what
            if ($scope.what === 'restaurants') {
                name += "Having a meal ";
            } else if ($scope.what === 'shopping') {
                name += "Go shopping ";
            } else {
                name += toTitleCase($scope.term) + ' ';
            }
            
            // where
//            if ($scope.establishment === 'manual' && getBusinessPlace($scope.manualBusinessInfo)) {
//                name += 'at ' + getBusinessPlace($scope.manualBusinessInfo) + ' ';
//            }
//            else if ($scope.establishment !== 'other') {
//                try {
//                    name += 'at ' + JSON.parse($scope.establishment).name + ' ';
//                } catch (e) {
//                    console.log('unable to parse establishment');
//                }
//            } else if ($scope.where == '1') {
//                name += 'within 1 mile ';
//            } else if ($scope.where == '10') {
//                name += 'within 10 miles ';
//            } else if ($scope.other_location) {
//                name += 'in ' + $scope.other_location + ' ';
//            }
            
            // when
            if (typeof $scope.times[0] === 'object') {
                name += 'at ' + $scope.times[0].format($scope.timeFormat);
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
            return meetingService.getFacebookSharingUrl($scope.meetingId, getMeetingName())
        };
        
        $scope.getShareEmailSubject = function() {
            return "MEET ME HERE: " + getMeetingName();
        };
        
         $scope.getShareEmailBody = function() {
            return "Click the link to view activity details: \r\n" + meetingService.getSharingUrl($scope.meetingId);
        };
        
        $scope.showHideProgressBar = function() {
            if ($window.$(window).width() < 800) {
                $window.$(".checkout-wrap").fadeOut();
            }else{
                $window.$(".checkout-wrap").fadeIn();
            }
        }    
        
        var addMeetingToUser = function(data) {
            var userId = $scope.currentUser.id;
            var meetingData = {
                id: $scope.meetingId,
                name: data.name,
                createdDate: data.createdDate
            };
            userService.addMeetingToUser(userId, meetingData).then(function(error){
                if (error) {
                    console.log('Can not add meeting to User. Error: ' + error);
                } else {
                    console.log('Meeting added to User: ' + userId);
                }
            });
        }
        
        var addMeetingToCategory = function(data) {
            var categoryId = ($scope.what !== 'other') ? $scope.what : $scope.term;
            var categoryName = getCategoryName(categoryId);
            
            var meetingData = {
                id: $scope.meetingId,
                name: data.name,
                createdDate: data.createdDate
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