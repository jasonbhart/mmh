;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('MeetMeHereController', ['$scope', 'dataProvider', 'dialogs', '$log', 'meetingService', 'geoLocation', '$window', 'sessionService', 'util', 'categoryService', 'userService','gatheringService',
        function($scope, dataProvider, dialogs, $log, meetingService, geoLocation, $window, sessionService, util, categoryService, userService, gatheringService) {

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
        
        var defaultManualBusinessLabel = "Enter a specific business";
        $scope.manualBusinessLabel = defaultManualBusinessLabel;
        $scope.manualBusinessInfo = {};
        
        $window.$('.loading-wrap').show();
        
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
            return moment.subtract(moment.minute()%15, 'minutes');
        }
        
        function getISOFormatedTimes() {
            return $scope.times.map(function(time){
                return time.utc().toISOString();
            });
        }
        
        function getPlaceSuggestions() {
            var options = {
                'sort' : '2',
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
                    }, function (error){
                        $('#no-suggestion').show();
                        $('#contents').show();
                        $window.$('.loading-wrap').hide();
                    });
                }
                
            }, function() {
                $('#contents').show();
                $window.$('.loading-wrap').hide();
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
            var options = {};
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
                $scope.manualBusinessLabel = defaultManualBusinessLabel + ' (' + establishment.name + ' - ' + establishment.location.display_address + ')';
                $scope.manualBusinessInfo = establishment;
            });
        };
        
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
                    categories: establishment.categories || {}
                }];
            } catch (e) {
                return [];
            }
        }
        
        $scope.createMeeting = function() {
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
                    where: Object.keys(places),
                    when: Object.keys(times)
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
                $window.location = 'activity.html?act=' + meetingId;
            });
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