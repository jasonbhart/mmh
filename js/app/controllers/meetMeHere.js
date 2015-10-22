;(function () {
    "use strict";
    var app = angular.module('mmh.controllers');
    app.controller('MeetMeHereController', ['$scope', 'dataProvider', 'dialogs', '$log', 'meetingService', 'geoLocation', '$window', 'sessionService', 'util', 'categoryService', 'userService','gatheringService',
        function($scope, dataProvider, dialogs, $log, meetingService, geoLocation, $window, sessionService, util, categoryService, userService, gatheringService) {

        $scope.suggestions = {};
        $scope.timeFormat = 'h:mmA';
        $scope.times = [roundTime(moment().add(1, 'hours'))];
        $scope.meetingId = '';
        $scope.radius = 10;
        $scope.currentUser = null;
        $scope.places = [];
        
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
            var establishment = null;
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

                    console.log('OPTIONS', options);
                    dataProvider.getSuggestions(options).then(function(suggestions) {
                        $scope.suggestions = suggestions;
                        $log.log('SUGGESTIONS', $scope.suggestions);

                        if (typeof $scope.suggestions[0] === 'object') {
                            establishment = JSON.stringify($scope.suggestions[0]);
                        } else {
                            return [];
                        }

                        try {
                            establishment = JSON.parse(establishment);
                            $log.log('establishment', establishment);
                            $scope.places = [{
                                name: establishment.name || "Unknown",
                                url: establishment.url || "Unknown",
                                rating_url: establishment.rating_url || "Unknown",
                                city: establishment.city || "Unknown",
                                country_code: establishment.country_code || "Unknown",
                                type: establishment.type || "Unknown",
                                image_url: establishment.image_url || "",
                                location: establishment.location || {},
                            }];
                        
                            createMeeting();
                        } catch (e) {
                            alert('Invalid suggesstion. Continuing...');
                            createMeeting();
                        }
                    }, function (error){
                        alert('Can not detect your current place. Continuing...');
                        createMeeting();
                    });
                }
            }, function() {
                alert('Can not detect your current location. Continuing...');
                createMeeting();
            });
        }
        
        var createMeeting = function() {
            var times   = getISOFormatedTimes();
            var places  = $scope.places;
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