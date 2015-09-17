;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('IndexController', ['$scope', 'meetingInfo', 'sessionService', 'util', 'geoLocation','$window', 'googleMap','categoryService',
            function ($scope, meetingInfo, sessionService, util, geoLocation, $window, googleMap, categoryService) {
        $scope.currentUser = null;
        $scope.locationName = '';
        $scope.categories = [];

        sessionService.ready.then(function() {

            var initAuth = function(user) {
                $scope.currentUser = user;
            };
            
            initAuth(sessionService.getCurrentUser());

            $scope.locationName = $scope.currentUser.getLocationName();
            var userLocation = $scope.currentUser.getLocation();
            if (userLocation) {
                var options = {
                    coord: userLocation.coords, 
                    radius: util.convertMilesToKms(userLocation.radius),
                    count: 3
                };

                meetingInfo.getLatest().then(function(info) {
                    $scope.meeting = info;
                });

                meetingInfo.getLocal(options).then(function(results) {
                    $scope.otherMeetings = results;
                });
                
                var mapElement = $window.$('.your-location');
                googleMap.drawMap(mapElement, options.coord, options.radius);
            } else {
                var locationPromise = geoLocation.getCurrentLocation();
                locationPromise.then(function(position) {
                    var options = {
                        coord: position.coords, 
                        radius: util.convertMilesToKms(1),
                        count: 5
                    };
                    $scope.locationName = position.shortName;
                    var mapElement = $window.$('.your-location');
                    googleMap.drawMap(mapElement, options.coord, options.radius);
                });
                
                
                // load default or latest events instead if location is not available
            }
            
            // draw map
//            var mapElement = $window.$('.your-location');
//            googleMap.drawMap(mapElement, options.coord, options.radius);
//            console.log(options);
//            
            // listen for the future auth change events
            $scope.$on('auth.changed', function(evt, user) {
                initAuth(user);
            });        
        });
        
        var categories = categoryService.getCategories();
        categories.$loaded().then(function(data) {
            $scope.categories = data;
        });
    }]);
})();
