;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('MeetMeHereController', ['$scope', 'dataProvider', 'dialogs', '$log', 'meetingService', 'geoLocation', '$window', 'sessionService', 'util', 'categoryService', 'userService','gatheringService','errorLoggingService',
        function($scope, dataProvider, dialogs, $log, meetingService, geoLocation, $window, sessionService, util, categoryService, userService, gatheringService, errorLoggingService) {

        $scope.suggestions = {};
        $scope.timeFormat = 'h:mmA';
        $scope.times = [roundTime(moment().add(15, 'minutes'))];
        $scope.meetingId = '';
        $scope.coords = null;
        $scope.radius = 1;
        $scope.currentUser = null;
        $scope.places = [];
        $scope.currentPage = util.getCurrentPage();
        $scope.establishment = 'other';
        
        $scope.showManualBusiness = false;
        $scope.manualBusinessInfo = {};
        
        $window.$('.loading-wrap').show();
        var reloadTimeout = setTimeout(function() {
            if (confirm('This page is not fully loaded due to slow internet connection. Do you want to reload now?')) {
                $window.location.reload();
            }
        }, 30000);
        
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
                
            getPlaceSuggestions();
        });
        
        function roundTime(moment) {
            return moment.subtract(moment.minute()%15, 'minutes').seconds(0).millisecond(0);
        }
        
        function getISOFormatedTimes() {
            var result = {};
            
            for (var i in $scope.times) {
                var key = util.generateKey();
                var time = angular.copy($scope.times[i])
                result[key] = time.utc().toISOString();
            }
            return result;
        }
        
        function getPlaceSuggestions() {
            var options = {
                'sort' : 'distance',
                'limit': '3',
                'radius': util.convertMilesToKms($scope.radius)
            };
            
            var currentLocation = geoLocation.getPosition();
            currentLocation.then(function(position) {
                if (position.coords.latitude && position.coords.longitude) {
                        options.coords = {lat: position.coords.latitude, lng: position.coords.longitude};
                    // Boston location for testing purpose
//                        options.coords = {lat: '42.3133735', lng: '-71.0571571,12'};

                    $scope.coords = options.coords;
                    dataProvider.getSuggestions(options).then(function(suggestions) {
                        $scope.suggestions = suggestions;
                        $('#contents').show();
                        $window.$('.loading-wrap').hide();
                        clearTimeout(reloadTimeout);
                    }, function (error){
                        $('#no-suggestion').show();
                        $('#contents').show();
                        $window.$('.loading-wrap').hide();
                        clearTimeout(reloadTimeout);
                    });
                }
                
            }, function() {
                $('#contents').show();
                $window.$('.loading-wrap').hide();
                clearTimeout(reloadTimeout);
            });
        }
        
        $scope.enterSpecificBusines = function() {
            $scope.establishment = 'manual';
            $scope.addManualBusiness();
        };
        
        $scope.getMeetingName = function(meeting, includeTime) {
            return meetingService.getMeetingName(meeting, includeTime);
        };
        
        $scope.addManualBusiness = function() {
            var options = {sort: 'distance'};
            if ($scope.coords) {
                options.coords = $scope.coords;
                options.radius = util.convertMilesToKms($scope.radius);
            }
            
            var dialog = dialogs.addManualBusiness(options);
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
                    categories: establishment.categories || {}
                };
                return result;
            } catch (e) {
                 var data = {
                    content: "unable to parse establishment",
                    message: e.message,
                    page: 'meet me here wizard',
                    _function: 'getFormatedEstablishment',
                    establishment: establishment
                };
                errorLoggingService.addLog(data);
                return [];
            }
        }
        
        $scope.createMeeting = function() {
            if ($scope.currentUser.isAnonymous()) {
                    alert('Please login so we can create this activity...');
                    dialogs.auth();
                    return;
                }
            
            if ($scope.establishment === 'manual' && Object.keys($scope.manualBusinessInfo).length === 0) {
                alert('Please select a business');
                $scope.addManualBusiness();
                return;
            }
            
            var times   = getISOFormatedTimes();
            var places  = getFormatedEstablishment();
            var users = {};
            if ($scope.currentUser && $scope.currentUser.id) {
                users[$scope.currentUser.id] = {
                    joined: true,
                    where: util.getFirebaseKeys(places),
                    when: util.getFirebaseKeys(times)
                };
            }
            var data = {
                name: getMeetingName(places),
                createdDate: moment().utc().toISOString(),
                when: times,
                where: places,
                users: users
            };
            var time = angular.copy($scope.times[0]);
            data['timeTitle'] = time ? time.utc().toISOString() : '';
            
            var meetingPromise = meetingService.create(data);
            meetingPromise.then(function(meeting) {
                var meetingId = meeting.refs.current.key();
                $scope.meetingId = meetingId;
                addMeetingToCategory(data);
                
                setTimeout(function() {
                    $window.location = 'activity.html?act=' + meetingId;
                }, 1000);
                
            });
            
            compareToDefaultSetting(data);
        };
        
        var addMeetingToCategory = function(data) {
            var categoryId = 'Others';
            
            for (var i in data.where) {
                if (data.where[i].type) {
                    categoryId = data.where[i].type;
                    break;
                }
            }
            
            var meetingData = {
                id: $scope.meetingId,
                name: data.name,
                createdDate: data.createdDate,
                timeTitle: data.timeTitle,
                expireTime: meetingService.getExpireTime(data.when)
            } ;
            categoryService.addMeetingToCategory(categoryId, categoryId, meetingData);
        }
        
        $scope.isToday = function (isoString) {
            return moment().format('YYYYMMDD') <= moment(isoString).format('YYYYMMDD');
        };
        
        var compareToDefaultSetting = function() {
            
            if ($scope.meeting_name) {
                util.addEventToDataLayer('Meet Me Here Wizard', 'Step 1', 'Set Custom Title', $scope.meeting_name);
            }
            
            var establishment = getFormatedEstablishment();
            if ($scope.establishment === 'manual') {
                if (typeof establishment === 'object' && establishment.length) {
                    util.addEventToDataLayer('Meet Me Here Wizard', 'Step 1', 'Specific Business', establishment[0].name);
                }
            } else {
                if (typeof establishment === 'object' && establishment.length) {
                    util.addEventToDataLayer('New Activity Wizard', 'Step 1', 'Select Venue', establishment[0].name);
                }
            }
        };
        
        var getMeetingName = function (places) {
            if ($scope.meeting_name) {
                return $scope.meeting_name;
            }
            
            if (places[0] && places[0].name) {
                return "Meet Me at " + places[0].name;
            }
            return 'Meet Me Here';
        };
    }]);
})();