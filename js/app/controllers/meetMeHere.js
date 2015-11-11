;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('MeetMeHereController', ['$scope', 'dataProvider', 'dialogs', '$log', 'meetingService', 'geoLocation', '$window', 'sessionService', 'util', 'categoryService', 'userService','gatheringService',
        function($scope, dataProvider, dialogs, $log, meetingService, geoLocation, $window, sessionService, util, categoryService, userService, gatheringService) {

        $scope.suggestions = {};
        $scope.timeFormat = 'h:mmA';
        $scope.times = [roundTime(moment().add(15, 'minutes'))];
        $scope.meetingId = '';
        $scope.radius = 10;
        $scope.currentUser = null;
        $scope.places = [];
        $scope.noSuggestionLabel = '';
        $scope.currentPage = util.getCurrentPage();
        $scope.establishment = 'other';
        
        var defaultManualBusinessLabel = "Doesn't see your place? Enter a specific business";
        $scope.manualBusinessLabel = defaultManualBusinessLabel;
        $scope.manualBusinessInfo = {};
        
        $window.$('.loading-wrap').show();
        
        sessionService.ready.then(function() {
            $scope.currentUser = sessionService.getCurrentUser();
            getFormatedEstablishmentAndCreateMeeting();
        });
        
        function roundTime(moment) {
            return moment.subtract(moment.minute()%15, 'minutes');
        }
        
        function getISOFormatedTimes() {
            return $scope.times.map(function(time){
                return time.utc().toISOString();
            });
        }
        
        function getFormatedEstablishmentAndCreateMeeting() {
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

                    dataProvider.getSuggestions(options).then(function(suggestions) {
                        $scope.suggestions = suggestions;
                        $('#contents').show();
                        $window.$('.loading-wrap').hide();
                    }, function (error){
                        $scope.noSuggestionLabel = 'Sorry, we were unable to find an establishment in your location. Try searching the place';
                        $('#contents').show();
                        $window.$('.loading-wrap').hide();
                    });
                }
                
            }, function() {
                $scope.noSuggestionLabel = 'Sorry, we were unable to detect your current location. Try searching the place';
                $('#contents').show();
                $window.$('.loading-wrap').hide();
            });
        }
        
        $scope.addManualBusiness = function() {
            var dialog = dialogs.addManualBusiness({});
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
                name: getMeetingName(),
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
        
        var getMeetingName = function () {
            return 'MEET ME HERE';
        };
    }]);
})();