;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('CreateMeetingController', ['$scope', 'dataProvider', 'dialogs', '$log', 'meetingService', 'geoLocation', '$window', 'sessionService', 'util', 'categoryService', 'userService','gatheringService','localMeetingService','googleMap','errorLoggingService','historyService',
        function($scope, dataProvider, dialogs, $log, meetingService, geoLocation, $window, sessionService, util, categoryService, userService, gatheringService, localMeetingService, googleMap, errorLoggingService, historyService) {
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
        $scope.suggestionTimeout = null;
        $scope.suggestionCache = {};
        $scope.locationName = '';
        $scope.showTip = false;
        $scope.currentPosition = null;
        $scope.browserPosition = null;
        
        $scope.showManualBusiness = false;
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
            
            switch ($scope.stage) {
                case 1:
                    fireStep1Events();
                    break;
                case 2:
                    fireStep2Events();
                    break;
                case 3:
                    fireStep3Events();
                    break;
                default:
                    break;
            }
            
            $scope.stage ++;
            
            if ($scope.stage === 3) {
                $scope.suggestionCache = {};
                $scope.updatePlaceSuggestion();
            }
            
            if ($scope.stage === $scope.MAX_STAGE) {
                if ($scope.currentUser.isAnonymous()) {
                    $scope.stage --;
                    alert('Please login so we can create this activity...');
                    dialogs.auth();
                    return;
                }
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
                return [];
            },
            format: function(time) {
                return time.format($scope.timeFormat);
            }
        };
        
        $scope.addTimes = function() {
            var dialog = dialogs.userMeetingTimes(timesProvider);
            dialog.result.then(function(times) {
                _.forEach(times, function(newTime) {
                    var isNew = true;
                    _.forEach($scope.times, function (oldTime) {
                        if (newTime.diff(oldTime) === 0) {
                            isNew = false;
                        }
                    });
                    
                    if (isNew) {
                        $scope.times.push(newTime);
                    }
                });
//                $scope.times = times;
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
        
//        $scope.$watch('allSubCategory', function(newValue, oldValue) {
//            resetSelectedCategory(newValue);
//        });

        $scope.clickAllSubCategory = function() {
            resetSelectedCategory($scope.allSubCategory);
        }
        
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
            }
        });
        
        $scope.$watch('where', function (newValue, oldValue) {
            if (newValue !== 'other' && newValue != '1') {
                util.addEventToDataLayer('Local Settings', 'Geo', 'Change Search Radius', newValue);
            }
        });
        
        $scope.addOtherTimes = function() {
            $scope.times = [];
            $scope.addTimes();
        };
        
        $scope.$watch('share', function (newValue, oldValue) {
            if (newValue === '0') {
                util.addEventToDataLayer('New Activity Wizard', 'Step 4', 'Finish', 'Make New Friend');
                $scope.finish();
            }
        });
        
        $scope.$watch('share_social', function (newValue, oldValue) {
            if (newValue === 'facebook') {
                var callback = function(){
                    document.getElementById("fb-share").click();
                };
                $scope.startSharing(callback);
            } else if (newValue === 'twitter') {
                var callback = function(){
                    document.getElementById("twitter-share").click();
                };
                $scope.startSharing(callback);
                
            } else if (newValue === 'email') {
                var callback = function(){
                    document.getElementById("sharing_email").click();
                };
                $scope.startSharing(callback);
                
            } else if (newValue === 'copy'){
                var callback = function(){
                    document.getElementById("sharing_url").style.display = 'block';
                    document.getElementById("sharing_url").select();
                    document.execCommand('copy');
                    document.getElementById("sharing_url").style.display = 'none';
                    alert(meetingService.getSharingUrl($scope.meetingId) + '\n copied to clipboard');
                };
                $scope.startSharing(callback);
            }
        });
        
        $scope.startSharing = function(callback) {
            $window.$('.loading-wrap').show();
            var checkActCreated = setInterval(function(){
                if ($scope.meetingId !== '') {
                    clearInterval(checkActCreated);
                    $window.$('.loading-wrap').hide();
                    callback();
                }
            }, 50);
        }
        
        function roundTime(moment) {
            return moment.subtract(moment.minute()%15, 'minutes').seconds(0).millisecond(0);
        }
        
        $scope.addManualBusiness = function() {
            var options = {
                term: ($scope.what !== 'other') ? $scope.what : $scope.term,
                category_filter: ($scope.what !== 'other') ? $scope.what : $scope.term,
                distance_unit: $scope.currentUser.user.distance_unit || 'foot'
            };
            
            // #432 modify the filter so that "sports bars" and "pubs" subcategories are also include in Go eat
            if ($scope.what === 'restaurants') {
                options.category_filter = 'restaurants,sportsbars,pubs';
            }
                
                
            var dialog = dialogs.addManualBusiness($scope.getWhereQueryOptions(options, true));
            dialog.result.then(function(business) {
                if (Object.keys(JSON.parse(business)).length === 0) {
                    alert('Please select a business');
                    $scope.addManualBusiness();
                    return;
                }
                var establishment = JSON.parse(business);
                $scope.manualBusinessInfo = establishment;
                $scope.showManualBusiness = true;
            });
        };
        
        function getISOFormatedTimes() {
            var result = {};
            
            for (var i in $scope.times) {
                var key = util.generateKey();
                var time = angular.copy($scope.times[i])
                result[key] = time.utc().toISOString();
            }
            return result;
        }
        
        function getFormatedEstablishment() {
            var establishment = $scope.establishment;
            if ($scope.establishment === 'other') {
                if (typeof $scope.suggestions[0] === 'object') {
                    establishment = JSON.stringify($scope.suggestions[0]);
                } else if (Object.keys($scope.manualBusinessInfo).length > 0) {
                    establishment = JSON.stringify($scope.manualBusinessInfo);
                } else {
                    return [];
                }
            } else if ($scope.establishment === 'manual') {
                establishment = JSON.stringify($scope.manualBusinessInfo);
            }
            
            try {
                establishment = JSON.parse(establishment);
                var key = util.generateKey();
                var result = {};
                result[key] = {
                    name: establishment.name || "Unknown",
                    url: establishment.url || "Unknown",
                    rating_url: establishment.rating_url || "Unknown",
                    city: establishment.city || "Unknown",
                    country_code: establishment.country_code || "Unknown",
                    type: establishment.type || "Unknown",
                    image_url: establishment.image_url || "",
                    location: establishment.location || {},
                    categories: establishment.categories || {},
                    display_phone: establishment.display_phone || ""
                };
                return result;
            } catch (e) {
                var data = {
                    content: "unable to parse establishment",
                    message: e.message,
                    page: 'new activity wizard',
                    _function: 'getFormatedEstablishment',
                    establishment: establishment
                };
                errorLoggingService.addLog(data);
                return [];
            }
        }
        
        $scope.updatePlaceSuggestion = function() {
            $scope.other_location = $window.$('.location-autocomplete').val();
            if ($scope.suggestionCache[$scope.where]) {
                $scope.suggestions = $scope.suggestionCache[$scope.where];
                $scope.noSuggestionLabel = '';
                return true;
            }
            
            $window.$('.loading-wrap').show();
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
            } else if ($scope.what === 'bars') {
                // add category filter to avoid "barbecue" category when searching term = "bars"
                options.category_filter = 'bars';
            } else {
                options.category_filter = ($scope.what !== 'other') ? $scope.what : $scope.term
            }
            
            var timeout = ($scope.where !== 'other') ? 1000 : 0;
            
            options = $scope.getWhereQueryOptions(options, false);
            
            if ($scope.where === 'other' && !$scope.other_location) {
                $scope.suggestions = [];
                $scope.noSuggestionLabel = '';
                $window.$('.loading-wrap').hide();
                return false;
            }

            setTimeout(function(){
                dataProvider.getSuggestions(options).then(function(suggestions) {
                    $scope.suggestions = suggestions;
                    $scope.suggestionCache[$scope.where] = suggestions;
                    if (suggestions.length == 0) {
                        $scope.noSuggestionLabel = 'Sorry, we were unable to find an establishment in your area. Try changing locations.';
                        $scope.showTip = false;
                    } else if (suggestions.length < 3) {
                        $scope.showTip = true;
                    } else {
                        var showTip = true;
                        for (var i in suggestions) { 
                            if (suggestions[i].rating && suggestions[i].rating >= 4) {
                                showTip = false;
                                break;
                            }
                        }
                        $scope.showTip = showTip;
                    }
                    $window.$('.loading-wrap').hide();
                }, function (error){
                    $scope.suggestions = {};
                    if ($scope.establishment != 'manual') {
                        $scope.establishment = 'other';
                    }
                    $scope.noSuggestionLabel = 'Sorry, we were unable to find an establishment in your area. Try changing locations.';
                    $window.$('.loading-wrap').hide();
                });
            }, timeout);
        };
        
        $scope.setTimeoutForUpdatePlaceSuggestion = function() {
            clearTimeout($scope.suggestionTimeout);
            $scope.suggestionCache['other'] = null;
            $scope.suggestionTimeout = setTimeout($scope.updatePlaceSuggestion, 500);
        };
        
        $scope.$on('position.changed', function(evt, data) {
            clearTimeout($scope.suggestionTimeout);
            $scope.updatePlaceSuggestion();
        });
        
        $scope.getWhereQueryOptions = function(options, manualBusinessFlag) {
            if ($scope.where !== 'other') {
                if (
                    $scope.currentUser && 
                    $scope.currentUser.user && 
                    $scope.currentUser.user.location && 
                    $scope.currentUser.user.location.coords && 
                    $scope.currentUser.user.location.type !== 'auto'
                ) {
                    options.coords = $scope.currentUser.user.location.coords;
                    $scope.locationName = '(' + $scope.currentUser.user.location.shortName + ')';
                } else {
                    if ($scope.currentPosition && $scope.currentPosition.coords.lat && $scope.currentPosition.coords.lng) {
                        options.coords = {lat: $scope.currentPosition.coords.lat, lng: $scope.currentPosition.coords.lng};
                    } else if ($scope.browserPosition) {
                        options.coords = {lat: $scope.browserPosition.latitude, lng: $scope.browserPosition.longitude};
                    } else {
                        alert('Cannot detect location. Please enable GPS on you device.');
                    }
                    
                    if ($scope.currentPosition && $scope.currentPosition.shortName) {
                        $scope.locationName = '(' + $scope.currentPosition.shortName + ')';
                    }
                }

                options.radius = util.convertMilesToKms($scope.where);
            } else {
                options.location = $scope.other_location;
                if ($scope.other_location) {
                    $scope.locationName = '(' + $scope.other_location + ')';
                }
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
                    where: util.getFirebaseKeys(places),
                    when: util.getFirebaseKeys(times),
                    creator: true
                };
            }
            var data = {
                name: getMeetingName(),
                createdDate: moment().utc().toISOString(),
                when: times,
                where: places,
                users: users,
                category: ($scope.what !== 'other') ? $scope.what : $scope.term
            };
            var time = angular.copy($scope.times[0]);
            data['timeTitle'] = time ? time.utc().toISOString() : '';
            
            if ($scope.where === 'other' && $scope.other_location) {
                data['specific_location'] = $scope.other_location;
            }
            
            if (!$scope.meetingId) {
                $window.$('.loading-wrap').show();
                var meetingPromise = meetingService.create(data);
                meetingPromise.then(function(meeting) {
                    var meetingId = meeting.refs.current.key();
                    if (Object.keys(data.where).length > 0) {
                        // add place to the local Events
                        localMeetingService.add(meetingId, Object.keys(data.where)[0], data.where[Object.keys(data.where)[0]].location.coordinate, data.timeTitle).then(function() {
                            if ($.cookie('local_event_' + $scope.currentUser.id)) {
                                $.removeCookie('local_event_' + $scope.currentUser.id);
                            }
                        });
                    }
                            
                    $scope.meetingId = meetingId;
                    $scope.meeting = meeting;
                    $scope.redirectUrl = 'activity.html?act=' + meetingId;
                    $scope.shareUrl = meetingService.getSharingUrl(meetingId);
                    activateFacebookSDK();
                    activateTwitterSDK();

                    addMeetingToCategory(data);
                    addMeetingToUser(data);
                    addMeetingToHistory(data);
                    $window.$('.loading-wrap').hide();
                    
                    util.addEventToDataLayer('New Activity Wizard', 'Step 4', 'Create Meeting', meetingId);
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
            var name = 'Let\'s ';
            
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
            return encodeURIComponent(meetingService.getFacebookSharingUrl($scope.meetingId, $scope.getShareMeetingName(meetingData)));
        };
        
        $scope.getShareEmailSubject = function() {
            var time = angular.copy($scope.times[0]);
            var meetingData = {
                name: getMeetingName(),
                timeTitle: time ? time.utc().toISOString() : ''
            };
            return $scope.getShareMeetingName(meetingData);
        };
        
         $scope.getShareEmailBody = function() {
            return "Click the link to view activity details: \r\n" + meetingService.getSharingUrl($scope.meetingId);
        };
        
        $scope.getMeetingName = function(meeting, includeTime) {
            return meetingService.getMeetingName(meeting, includeTime);
        };
        
        $scope.getShareMeetingName = function (meeting) {
            if (!meeting || !meeting.name) {
                return '';
            }
            var time = '', place = '';
            if ($scope.times && $scope.times[0]) {
                time = $scope.times[0].format('h:mmA');
            }
            
            if ($scope.establishment === 'other') {
                place = '';
            } else if ($scope.establishment === 'manual') {
                place = $scope.manualBusinessInfo.name;
            } else if ($scope.establishment){
                try {
                    var establishment = JSON.parse($scope.establishment);
                    place = establishment.name;
                } catch (e) {
                    console.log(e);
                }
            }
            
            var metadata = '';
            if (place && time) {
                metadata = ' (' + place + ' @ ' +  time + ')';
            } else if (place) {
                metadata = ' (' + place + ')';
            } else if (time) {
                metadata = ' ('  +  time + ')';
            }
            
            var result = meeting.name  + metadata;     
            result = result.replace('&', 'and');
            
            return result;
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
                timeTitle: data.timeTitle,
                expireTime: meetingService.getExpireTime(data.when)
            } ;
            if (Object.keys(data.where).length > 0) {
                meetingData.place = data.where[Object.keys(data.where)[0]].name;
            }
            categoryService.addMeetingToCategory(categoryId, categoryName, meetingData);
        }
        
        var addMeetingToHistory = function(data) {
            var historyData = {
                id: $scope.meetingId,
                name: data.name,
                timeTitle: data.timeTitle,
                time: data.timeTitle,
                type: 'created'
            };
            if (Object.keys(data.where).length > 0) {
                historyData.place = data.where[Object.keys(data.where)[0]];
            }
            historyService.addHistoryToUser($scope.currentUser.id, $scope.meetingId, historyData);
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
            
            util.addEventToDataLayer('Tutorial', 'Start', 'New Activity', null);
            
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
                    util.addEventToDataLayer('Tutorial', 'Cancel', 'New Activity', null);
                },
                modal: true,
                expose: true
            });
        }
        
        var fireStep1Events = function () {
            if ($scope.meeting_name) {
                util.addEventToDataLayer('New Activity Wizard', 'Step 1', 'Set Custom Title', $scope.meeting_name);
            }
            
            if ($scope.what !== 'restaurants') {
                var eventValue = $scope.what !== 'other' ? $scope.what : $scope.term;
                util.addEventToDataLayer('New Activity Wizard', 'Step 1', 'Change Category', eventValue);
            }
        }
        
        var fireStep2Events = function () {
            if ($scope.when !== 'now') {
                util.addEventToDataLayer('New Activity Wizard', 'Step 2', 'Change Timeframe', $scope.when);
            }
        }
        
        var fireStep3Events = function () {
            if ($scope.where != '1') {
                util.addEventToDataLayer('New Activity Wizard', 'Step 3', 'Change Search Radius', $scope.where);
            }
            
            var establishment = getFormatedEstablishment();
            if (typeof establishment === 'object' && establishment.length) {
                util.addEventToDataLayer('New Activity Wizard', 'Step 3', 'Select Venue', establishment[0].name);
            }
            
            if ($scope.where === 'other' && $scope.other_location) {
                util.addEventToDataLayer('Local Settings', 'Geo', 'Manual Type-In', $scope.other_location);
            }
        }
   
        $scope.toggleSubcategory = function (subcategory) {
            if ($scope.selectedCategory[subcategory]) {
                util.addEventToDataLayer('New Activity Wizard', 'Step 1', 'Check Sub-category', subcategory);
            } else {
                util.addEventToDataLayer('New Activity Wizard', 'Step 1', 'Uncheck Sub-category', subcategory);
                $scope.allSubCategory = false;
            }
            
        }
        
        $scope.isToday = function (isoString) {
            return moment().format('YYYYMMDD') <= moment(isoString).format('YYYYMMDD');
        };
        
        var getCurrentLocation = function () {
            var browserLocation = geoLocation.getPosition();
            browserLocation.then(function(position) {
                $scope.browserPosition = position.coords;
            });
            
            var currentLocation = geoLocation.getCurrentLocation();
            currentLocation.then(function(position) {
                $scope.currentPosition = position;
            }, function() {
                $log.log('Can not find current location');
            });
        };
        
        getCurrentLocation();
        
        $window.$(document).ready(function () {
            $window.$('#contents').show();
            
            $window.$('.fb-share').click(function(e) {
                e.preventDefault();
                window.open($(this).attr('href'), 'fbShareWindow', 'height=450, width=550, top=' + ($(window).height() / 2 - 275) + ', left=' + ($(window).width() / 2 - 225) + ', toolbar=0, location=0, menubar=0, directories=0, scrollbars=0');
                util.addEventToDataLayer('New Activity Wizard', 'Step 4', 'Share', 'Facebook');
                return false;
            });
            
            $window.$('.twitter-share').click(function(e) {
                e.preventDefault();
                window.open($(this).attr('href'), 'twitterShareWindow', 'height=450, width=550, top=' + ($(window).height() / 2 - 275) + ', left=' + ($(window).width() / 2 - 225) + ', toolbar=0, location=0, menubar=0, directories=0, scrollbars=0');
                util.addEventToDataLayer('New Activity Wizard', 'Step 4', 'Share', 'Twitter');
                return false;
            });
            
            $window.$('#email').click(function(e) {
                util.addEventToDataLayer('New Activity Wizard', 'Step 4', 'Share', 'Email');
            });
            
            $window.$('#copy').click(function(e) {
                util.addEventToDataLayer('New Activity Wizard', 'Step 4', 'Share', 'Copy');
            });
            
            $window.$('.finish-button').click(function(e) {
                util.addEventToDataLayer('New Activity Wizard', 'Step 4', 'Finish', 'Main Button');
            });
            
            $window.$('ul.best-places').on('click', 'li', function() {
                $scope.establishment = $(this).find('input[type=radio]').val();
                $scope.$apply();
            });
            
            googleMap.makeAutoComplete('location-autocomplete');
            
            sessionService.ready.then(function() {
                if (!sessionService.getViewedTutorialStatus()) {
                    setTimeout(function(){
                        $scope.startTutorial();
                        sessionService.setViewedTutorialStatus();
                    }, 100);
                }
            });
        });

    }]);
})();