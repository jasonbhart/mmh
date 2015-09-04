;(function () {
    "use strict";

    var app = angular.module('mmh.controllers');

    // get data from yelp
    app.controller('IndexController', ['$q', '$scope', 'localMeetingsInfo', 'userService', function ($q, $scope, localMeetingsInfo, userService) {
        localMeetingsInfo
            .get({
                // placeholder for real data
                coord: { lat: 42.31, lng: -71.06 },
                radius: 10,
                count: 5
            })
            .then(function(results) {
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
                        $scope.meeting = meeting;
                        $scope.meeting.usersCount = images.length;
                        $scope.meeting.userImages = images;
                    });
                }

                $scope.otherMeetings = results;
            });
    }]);
})();
