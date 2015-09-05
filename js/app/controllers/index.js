;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('IndexController', ['$q', '$scope', 'localMeetingsInfo', 'userService', 'sessionService', 'util', 'geoLocation','$window', 'googleMap',
            function ($q, $scope, localMeetingsInfo, userService, sessionService, util, geoLocation, $window, googleMap) {
        $scope.currentUser = null;
        $scope.locationName = '';
        
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
                    count: 5
                };
                
                localMeetingsInfo.get(options).then(function(results) {
                    var meeting = results.shift();
                    if (meeting) {
                        var deferreds = [];
                        // get user photos
                        _.forEach(meeting.users, function(id) {
                            var defer = $q.defer();
                            userService.get(id).then(function(user) {
                                defer.resolve(user.getProfileImageURL());
                            }, function() {
                                defer.resolve();
                            });
                            deferreds.push(defer.promise);
                        })

                        $q.all(deferreds).then(function(images) {
                            images = _.filter(images);
                            $scope.meeting = meeting;
                            $scope.meeting.usersCount = images.length;
                            $scope.meeting.userImages = images;
                        });
                    }

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
        
        
    }]);
})();
