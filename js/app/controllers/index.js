;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('IndexController', ['$q', '$scope', 'localMeetingsInfo', 'userService', 'sessionService', 'util',
            function ($q, $scope, localMeetingsInfo, userService, sessionService, util) {
        $scope.currentUser = null;
        
        sessionService.ready.then(function() {
            var initAuth = function(user) {
                $scope.currentUser = user;
            };
            
            initAuth(sessionService.getCurrentUser());

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
            } else {
                // load default or latest events instead if location is not available
            }
            
            // listen for the future auth change events
            $scope.$on('auth.changed', function(evt, user) {
                initAuth(user);
            });        
        });
        
        
    }]);
})();
