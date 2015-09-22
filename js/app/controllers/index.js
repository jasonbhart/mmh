;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('IndexController', ['$scope', 'meetingInfo', 'sessionService', 'util', 'geoLocation','$window', 'googleMap','categoryService', 'appConfig',
            function ($scope, meetingInfo, sessionService, util, geoLocation, $window, googleMap, categoryService, appConfig) {
        $scope.currentUser = null;
        $scope.locationName = '';
        $scope.categories = [];
        $scope.baseUrl = 'https://www.socialivo.com/';
        var ref = new Firebase(appConfig.firebaseUrl + '/meets');
        
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
                    var userGroupRef = ref.child($scope.meeting.id).child('users').child($scope.currentUser.id).child('group');
                    $scope.meeting.joinedGroup = false;
                    
                    userGroupRef.once('value', function(snapshot) {
                        if (snapshot.val() !== null) {
                            $scope.meeting.joinedGroup = true;
                        }
                        $scope.$apply();
                    });
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
        
        $window.$(document).ready(function() {
            $window.$('.categories-nav ul').on('click', 'li.level-0', function() {
                $window.$('.categories-nav ul li.level-0.active').removeClass('active');
                $window.$(this).addClass('active');
            });
        });
    }]);
})();
